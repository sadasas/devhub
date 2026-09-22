import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { pool } from "../../../../db/pool.js";
import { config } from "../../../../config.js";
import { ApiError } from "../../../../shared/errors.js";
import { parseOrThrow } from "../../../../shared/db.js";
import { getBaseUrl } from "../../../../shared/baseUrl.js";
import { logger } from "../../../../shared/logger.js";
import { SESSION_COOKIE } from "../../../../shared/http.js";
import { requireAuth, getUserId } from "../../../auth/middleware/requireAuth.js";
import { verifySession } from "../../../auth/infrastructure/jwt.js";
import {
  assertWrite,
  getProjectWithRole,
} from "../../../authorization/application/authz.js";
import { gcalCallbackQuerySchema } from "../domain/gcal.js";
import {
  buildGcalAuthUrl,
  ensureCalendar,
  exchangeGcalCode,
} from "../infrastructure/google-oauth.js";
import { sealToken } from "../infrastructure/token-vault.js";

export const gcalRouter = Router();

const gcalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: "RATE_LIMITED", message: "Too many Calendar requests" } },
});

const GCAL_STATE_COOKIE = "devhub_oauth_state_gcal";
const GCAL_STATE_TTL_MS = 10 * 60 * 1000;

const gcalStatePayloadSchema = z.object({
  state: z.string().min(1).max(500),
  codeVerifier: z.string().min(1).max(500),
  returnTo: z.string().max(2000).nullable().optional(),
});

function frontendOrigin(): string {
  if (config.APP_PUBLIC_URL) {
    try {
      return new URL(config.APP_PUBLIC_URL).origin;
    } catch {
      // fallthrough
    }
  }
  return "http://localhost:5173";
}

// Allowlist sama dengan social login (anti open-redirect): localhost:5173,
// APP_PUBLIC_URL, OAUTH_REDIRECT_ORIGINS. Selain itu → fallback origin frontend.
function resolveReturnTo(raw: string | null): string {
  const fallback = `${frontendOrigin()}/`;
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.origin === "http://localhost:5173") return raw;
    const allowed = new Set<string>();
    if (config.APP_PUBLIC_URL) {
      try {
        allowed.add(new URL(config.APP_PUBLIC_URL).origin);
      } catch {
        // abaikan
      }
    }
    for (const o of config.OAUTH_REDIRECT_ORIGINS) {
      try {
        allowed.add(new URL(o).origin);
      } catch {
        // abaikan
      }
      if (o.startsWith("https://") || o.startsWith("http://")) {
        try {
          allowed.add(new URL(o).origin);
        } catch {
          // abaikan
        }
      }
    }
    if (allowed.has(url.origin)) return raw;
    return fallback;
  } catch {
    return fallback;
  }
}

function withFlag(dest: string, key: "gcal" | "gcal_error", value: string): string {
  try {
    const url = new URL(dest);
    url.searchParams.set(key, value);
    return url.toString();
  } catch {
    return `${frontendOrigin()}/?${key}=${encodeURIComponent(value)}`;
  }
}

function setGcalStateCookie(res: Response, state: string, codeVerifier: string, returnTo: string | null): void {
  const payload = Buffer.from(JSON.stringify({ state, codeVerifier, returnTo })).toString("base64url");
  res.cookie(GCAL_STATE_COOKIE, payload, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.COOKIE_SECURE,
    maxAge: GCAL_STATE_TTL_MS,
    path: "/",
  });
}

function getGcalStateCookie(req: Request): { state: string; codeVerifier: string; returnTo: string | null } | null {
  const raw = (req.cookies as Record<string, string | undefined> | undefined)?.[GCAL_STATE_COOKIE];
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = parseOrThrow(gcalStatePayloadSchema, JSON.parse(json), "Invalid OAuth state");
    return { state: parsed.state, codeVerifier: parsed.codeVerifier, returnTo: parsed.returnTo ?? null };
  } catch {
    return null;
  }
}

function clearGcalStateCookie(res: Response): void {
  res.clearCookie(GCAL_STATE_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.COOKIE_SECURE,
  });
}

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vary", "Cookie");
}

function generateState(): string {
  return randomBytes(16).toString("base64url");
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// GET /api/v1/integrations/gcal/connect — mulai OAuth (auth, rate-limited).
// Query opsional: ?projectId= (konteks UI) + ?returnTo= (tujuan redirect
// setelah callback, divalidasi allowlist). Dibuka via navigasi browser.
gcalRouter.get("/connect", gcalLimiter, requireAuth, (req, res) => {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new ApiError(500, "OAUTH_NOT_CONFIGURED", "Google OAuth not configured");
  }
  const state = generateState();
  const { verifier, challenge } = generatePkce();
  const returnToRaw = typeof req.query.returnTo === "string" ? req.query.returnTo : null;
  setGcalStateCookie(res, state, verifier, returnToRaw);
  const redirectUri = `${getBaseUrl(req)}/api/v1/integrations/gcal/callback`;
  const url = buildGcalAuthUrl({
    clientId: config.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
    codeChallenge: challenge,
  });
  logger.info("gcal connect start", { userId: req.userId });
  noStore(res);
  res.redirect(302, url);
});

// GET /api/v1/integrations/gcal/callback — tukar code → simpan refresh terenkripsi,
// lalu 302 kembali ke frontend (bukan JSON mentah — endpoint ini hanya dibuka
// via navigasi browser). Sukses → ?gcal=connected; gagal terduga → ?gcal_error=<CODE>.
gcalRouter.get("/callback", gcalLimiter, async (req, res) => {
  noStore(res);
  const stored = getGcalStateCookie(req);
  clearGcalStateCookie(res);
  const dest = resolveReturnTo(stored?.returnTo ?? null);
  const fail = (code: string) => res.redirect(302, withFlag(dest, "gcal_error", code));
  const query = z
    .object({
      code: z.string().min(1).max(2000).optional(),
      state: z.string().min(1).max(500).optional(),
      error: z.string().max(500).optional(),
    })
    .safeParse(req.query);
  const code = query.success ? query.data.code : undefined;
  const state = query.success ? query.data.state : undefined;
  const oauthError = query.success ? query.data.error : undefined;
  if (oauthError) {
    logger.warn("gcal callback provider error", { error: oauthError });
    return fail("OAUTH_PROVIDER_ERROR");
  }
  const parsed = gcalCallbackQuerySchema.safeParse({ code, state });
  if (!parsed.success || !stored || state !== stored.state) {
    logger.warn("gcal invalid state", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasStored: Boolean(stored),
      match: stored ? state === stored.state : false,
    });
    return fail("INVALID_STATE");
  }
  try {
    const sessionUserId = await verifySession(
      (req.cookies as Record<string, string | undefined> | undefined)?.[SESSION_COOKIE],
    );
    if (!sessionUserId) return fail("UNAUTHORIZED");

    const redirectUri = `${getBaseUrl(req)}/api/v1/integrations/gcal/callback`;
    const tokens = await exchangeGcalCode({
      code: parsed.data.code,
      codeVerifier: stored.codeVerifier,
      redirectUri,
    });
    if (!tokens.refreshToken) {
      // Google kadang tidak mengembalikan refresh_token bila consent lama;
      // pertahankan refresh lama bila ada, else minta reconnect.
      const existing = await pool.query<{ refresh_token_enc: string }>(
        "SELECT refresh_token_enc FROM gcal_connections WHERE user_id = $1",
        [sessionUserId],
      );
      if (!existing.rows[0]) {
        return fail("OAUTH_NO_REFRESH");
      }
      await pool.query(
        `INSERT INTO gcal_connections (user_id, refresh_token_enc, access_token_enc, expiry, scope, status, last_error, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'connected', NULL, now())
         ON CONFLICT (user_id) DO UPDATE SET access_token_enc = EXCLUDED.access_token_enc, expiry = EXCLUDED.expiry, scope = EXCLUDED.scope, status = 'connected', last_error = NULL, updated_at = now()`,
        [
          sessionUserId,
          existing.rows[0].refresh_token_enc,
          sealToken(tokens.accessToken),
          tokens.expiry.toISOString(),
          tokens.scope,
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO gcal_connections (user_id, refresh_token_enc, access_token_enc, expiry, scope, status, last_error, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'connected', NULL, now())
         ON CONFLICT (user_id) DO UPDATE SET refresh_token_enc = EXCLUDED.refresh_token_enc, access_token_enc = EXCLUDED.access_token_enc, expiry = EXCLUDED.expiry, scope = EXCLUDED.scope, status = 'connected', last_error = NULL, updated_at = now()`,
        [
          sessionUserId,
          sealToken(tokens.refreshToken),
          sealToken(tokens.accessToken),
          tokens.expiry.toISOString(),
          tokens.scope,
        ],
      );
    }
    logger.info("gcal connected", { userId: sessionUserId });
    return res.redirect(302, withFlag(dest, "gcal", "connected"));
  } catch (err) {
    if (err instanceof ApiError && err.code === "OAUTH_EXCHANGE_FAILED") {
      return fail("OAUTH_EXCHANGE_FAILED");
    }
    throw err;
  }
});

// GET /api/v1/integrations/gcal/status[?projectId=] — tanpa bocor token.
// Bentuk dasar (tanpa projectId) dipertahankan untuk kompatibilitas.
// Bila ?projectId= valid diberikan, respons diperkaya kontrak gabungan T4:
// { connected, expired, email, syncEnabled, calendarId, lastSyncAt, ...dasar }.
gcalRouter.get("/status", gcalLimiter, requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query<{
    scope: string | null;
    expiry: Date | null;
    status: string;
    updated_at: Date;
  }>("SELECT scope, expiry, status, updated_at FROM gcal_connections WHERE user_id = $1", [userId]);
  noStore(res);
  const row = result.rows[0];
  const base = !row || row.status !== "connected"
    ? { connected: false as const, status: row?.status ?? "disconnected", scope: null, expiry: null, updatedAt: null }
    : {
        connected: true as const,
        status: row.status,
        scope: row.scope,
        expiry: row.expiry ? row.expiry.toISOString() : null,
        updatedAt: row.updated_at.toISOString(),
      };

  const projectIdRaw = typeof req.query.projectId === "string" ? req.query.projectId : null;
  if (!projectIdRaw) {
    res.json(base);
    return;
  }
  const projectId = parseOrThrow(
    z.object({ projectId: z.string().uuid() }),
    { projectId: projectIdRaw },
    "Invalid project id",
  ).projectId;
  const membership = await getProjectWithRole(userId, projectId);
  if (!membership) throw new ApiError(404, "NOT_FOUND", "Project not found");

  const emailRes = await pool.query<{ email: string | null }>(
    "SELECT email FROM oauth_accounts WHERE user_id = $1 AND provider = 'google' ORDER BY created_at DESC LIMIT 1",
    [userId],
  );
  const settingsRes = await pool.query<{ calendar_id: string | null; sync_enabled: boolean }>(
    "SELECT calendar_id, sync_enabled FROM gcal_project_settings WHERE project_id = $1",
    [projectId],
  );
  const syncRes = await pool.query<{ last_sync_at: Date | null }>(
    "SELECT max(updated_at) AS last_sync_at FROM gcal_event_map WHERE project_id = $1",
    [projectId],
  );
  res.json({
    ...base,
    expired: base.connected ? false : row?.status === "needs_reconnect",
    email: emailRes.rows[0]?.email ?? null,
    syncEnabled: settingsRes.rows[0]?.sync_enabled ?? false,
    calendarId: settingsRes.rows[0]?.calendar_id ?? null,
    lastSyncAt: syncRes.rows[0]?.last_sync_at
      ? (syncRes.rows[0].last_sync_at as Date).toISOString()
      : null,
  });
});

const gcalSettingsBodySchema = z.object({
  projectId: z.string().uuid(),
  syncEnabled: z.boolean(),
});

// GET /api/v1/integrations/gcal/synced?projectId= — daftar taskId yang punya
// event di Google Calendar (dari gcal_event_map). Read-only: viewer boleh baca.
// Dipakai board untuk marker per-task + membedakan board terintegrasi.
gcalRouter.get("/synced", gcalLimiter, requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const projectIdRaw = typeof req.query.projectId === "string" ? req.query.projectId : null;
  if (!projectIdRaw) throw new ApiError(400, "INVALID_PAYLOAD", "projectId is required");
  const projectId = parseOrThrow(
    z.object({ projectId: z.string().uuid() }),
    { projectId: projectIdRaw },
    "Invalid project id",
  ).projectId;
  const membership = await getProjectWithRole(userId, projectId);
  if (!membership) throw new ApiError(404, "NOT_FOUND", "Project not found");
  noStore(res);
  const rows = await pool.query<{ task_id: string }>(
    "SELECT task_id FROM gcal_event_map WHERE project_id = $1",
    [projectId],
  );
  res.json({ taskIds: rows.rows.map((r) => r.task_id) });
});

// POST /api/v1/integrations/gcal/settings — toggle sync per-project (write role).
// Enable: butuh koneksi 'connected' milik aktor, lalu ensureCalendar (auto-create
// `DevHub - <project>`, idempotent). Disable: hanya set flag, tanpa call Google.
gcalRouter.post("/settings", gcalLimiter, requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { projectId, syncEnabled } = parseOrThrow(gcalSettingsBodySchema, req.body, "Invalid settings payload");
  const membership = await getProjectWithRole(userId, projectId);
  if (!membership) throw new ApiError(404, "NOT_FOUND", "Project not found");
  assertWrite(membership.role);

  let calendarId: string | null = null;
  if (syncEnabled) {
    const conn = await pool.query<{ status: string }>(
      "SELECT status FROM gcal_connections WHERE user_id = $1",
      [userId],
    );
    if (!conn.rows[0] || conn.rows[0].status !== "connected") {
      throw new ApiError(409, "NEEDS_RECONNECT", "Connect Google Calendar first");
    }
    try {
      calendarId = await ensureCalendar(userId, membership.name, { projectId });
    } catch (err) {
      if (err instanceof ApiError && (err.code === "GCAL_NOT_CONNECTED" || err.code === "GCAL_TOKEN_INVALID")) {
        await pool.query("UPDATE gcal_connections SET status = 'needs_reconnect', updated_at = now() WHERE user_id = $1", [userId]);
        throw new ApiError(409, "NEEDS_RECONNECT", "Google connection expired, please reconnect");
      }
      if (err instanceof ApiError && err.code === "GCAL_CALENDAR_FAILED") {
        const details = (err.details ?? {}) as { gcalReason?: unknown };
        // Token scope lama (calendar.events) tak bisa calendars.insert → Reconnect
        // agar token baru membawa scope calendar.app.created.
        if (details.gcalReason === "insufficientPermissions") {
          await pool.query("UPDATE gcal_connections SET status = 'needs_reconnect', updated_at = now() WHERE user_id = $1", [userId]);
          throw new ApiError(
            409,
            "NEEDS_RECONNECT",
            "Google Calendar needs additional permission, please reconnect",
          );
        }
        // API belum di-enable di Cloud project → pesan actionable, tanpa ubah status.
        if (details.gcalReason === "accessNotConfigured") {
          throw new ApiError(
            502,
            "GCAL_CALENDAR_FAILED",
            "Google Calendar API is not enabled for this Cloud project",
          );
        }
      }
      throw err;
    }
    await pool.query(
      `INSERT INTO gcal_project_settings (project_id, calendar_id, sync_enabled, owner_user_id, updated_at)
       VALUES ($1, $2, true, $3, now())
       ON CONFLICT (project_id) DO UPDATE SET calendar_id = EXCLUDED.calendar_id, sync_enabled = true, owner_user_id = EXCLUDED.owner_user_id, updated_at = now()`,
      [projectId, calendarId, userId],
    );
  } else {
    await pool.query(
      `INSERT INTO gcal_project_settings (project_id, sync_enabled, owner_user_id, updated_at)
       VALUES ($1, false, $2, now())
       ON CONFLICT (project_id) DO UPDATE SET sync_enabled = false, updated_at = now()`,
      [projectId, userId],
    );
    const existing = await pool.query<{ calendar_id: string | null }>(
      "SELECT calendar_id FROM gcal_project_settings WHERE project_id = $1",
      [projectId],
    );
    calendarId = existing.rows[0]?.calendar_id ?? null;
  }
  noStore(res);
  res.json({ syncEnabled, calendarId });
});

// POST /api/v1/integrations/gcal/disconnect[ {projectId?} ] — hapus token lokal + best-effort revoke.
// Bila projectId anggota diberikan, sync project itu ikut dimatikan agar badge UI konsisten.
gcalRouter.post("/disconnect", gcalLimiter, requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const body = (req.body ?? {}) as { projectId?: unknown };
  const existing = await pool.query<{ refresh_token_enc: string | null }>(
    "SELECT refresh_token_enc FROM gcal_connections WHERE user_id = $1",
    [userId],
  );
  await pool.query("DELETE FROM gcal_connections WHERE user_id = $1", [userId]);
  if (typeof body.projectId === "string") {
    try {
      const parsed = z.object({ projectId: z.string().uuid() }).safeParse({ projectId: body.projectId });
      if (parsed.success && (await getProjectWithRole(userId, parsed.data.projectId))) {
        await pool.query("UPDATE gcal_project_settings SET sync_enabled = false, updated_at = now() WHERE project_id = $1", [
          parsed.data.projectId,
        ]);
      }
    } catch {
      // best-effort: koneksi sudah terhapus, flag sync tidak fatal
    }
  }
  const enc = existing.rows[0]?.refresh_token_enc;
  if (enc) {
    try {
      const { openToken } = await import("../infrastructure/token-vault.js");
      const raw = openToken(enc);
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: raw }).toString(),
      }).catch(() => {});
    } catch {
      // best-effort: token sudah dihapus lokal, revoke gagal tidak fatal
    }
  }
  logger.info("gcal disconnected", { userId });
  noStore(res);
  res.json({ ok: true });
});
