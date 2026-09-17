import { pool } from "../../../../db/pool.js";
import { config } from "../../../../config.js";
import { ApiError } from "../../../../shared/errors.js";
import { logger } from "../../../../shared/logger.js";
import {
  GCAL_AUTH_URL,
  GCAL_CALENDAR_BASE,
  GCAL_SCOPE,
  GCAL_TOKEN_URL,
} from "../domain/gcal.js";
import { openToken, sealToken } from "./token-vault.js";

/**
 * Google OAuth + Calendar HTTP (fetch native, tanpa dependency baru).
 * Tanpa log token — hanya status code & presence flag.
 */

export interface GcalTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string | null;
  expiry: Date;
}

function tokenExpiry(expiresIn: number): Date {
  const secs = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
  return new Date(Date.now() + secs * 1000);
}

export function buildGcalAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: GCAL_SCOPE,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  return `${GCAL_AUTH_URL}?${q.toString()}`;
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function exchangeGcalCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<GcalTokenSet> {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new ApiError(500, "OAUTH_NOT_CONFIGURED", "Google OAuth not configured");
  }
  const res = await fetch(GCAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
      code_verifier: params.codeVerifier,
    }).toString(),
  });
  const json = await parseJsonSafe(res);
  const accessToken = json?.["access_token"];
  if (!res.ok || typeof accessToken !== "string" || accessToken.length === 0) {
    const desc =
      typeof json?.["error_description"] === "string"
        ? (json["error_description"] as string)
        : typeof json?.["error"] === "string"
          ? (json["error"] as string)
          : "Failed to exchange code";
    logger.warn("gcal exchange failed", { status: res.status, hasToken: false });
    throw new ApiError(500, "OAUTH_EXCHANGE_FAILED", desc);
  }
  const refreshToken =
    typeof json?.["refresh_token"] === "string" ? (json["refresh_token"] as string) : null;
  const expiresIn =
    typeof json?.["expires_in"] === "number" ? (json["expires_in"] as number) : 3600;
  const scope = typeof json?.["scope"] === "string" ? (json["scope"] as string) : GCAL_SCOPE;
  logger.info("gcal exchange ok", { status: res.status, hasRefresh: Boolean(refreshToken) });
  return {
    accessToken,
    refreshToken,
    expiresIn,
    scope,
    expiry: tokenExpiry(expiresIn),
  };
}

export async function refreshGcalAccessToken(params: {
  refreshToken: string;
}): Promise<{ accessToken: string; expiresIn: number; expiry: Date }> {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new ApiError(500, "OAUTH_NOT_CONFIGURED", "Google OAuth not configured");
  }
  const res = await fetch(GCAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }).toString(),
  });
  const json = await parseJsonSafe(res);
  const accessToken = json?.["access_token"];
  if (!res.ok || typeof accessToken !== "string" || accessToken.length === 0) {
    logger.warn("gcal refresh failed", { status: res.status });
    throw new ApiError(502, "GCAL_REFRESH_FAILED", "Failed to refresh Google access token");
  }
  const expiresIn =
    typeof json?.["expires_in"] === "number" ? (json["expires_in"] as number) : 3600;
  return { accessToken, expiresIn, expiry: tokenExpiry(expiresIn) };
}

/** Ambil access token valid untuk user — refresh otomatis bila <5 menit / expired. */
export async function getValidAccessToken(userId: string): Promise<string> {
  const conn = await pool.query<{
    refresh_token_enc: string;
    access_token_enc: string | null;
    expiry: Date | null;
    status: string;
  }>("SELECT refresh_token_enc, access_token_enc, expiry, status FROM gcal_connections WHERE user_id = $1", [
    userId,
  ]);
  const row = conn.rows[0];
  if (!row || row.status !== "connected") {
    throw new ApiError(404, "GCAL_NOT_CONNECTED", "Google Calendar not connected");
  }
  const skewMs = 5 * 60 * 1000;
  if (row.access_token_enc && row.expiry && row.expiry.getTime() - Date.now() > skewMs) {
    try {
      return openToken(row.access_token_enc);
    } catch {
      // fallthrough ke refresh
      logger.warn("gcal access open failed, refreshing", { userId });
    }
  }
  let refreshToken: string;
  try {
    refreshToken = openToken(row.refresh_token_enc);
  } catch {
    await pool.query(
      "UPDATE gcal_connections SET status = 'error', last_error = 'Failed to decrypt refresh token', updated_at = now() WHERE user_id = $1",
      [userId],
    );
    throw new ApiError(500, "GCAL_TOKEN_INVALID", "Stored Google token is invalid, please reconnect");
  }
  const refreshed = await refreshGcalAccessToken({ refreshToken });
  await pool.query(
    "UPDATE gcal_connections SET access_token_enc = $2, expiry = $3, updated_at = now() WHERE user_id = $1",
    [userId, sealToken(refreshed.accessToken), refreshed.expiry.toISOString()],
  );
  return refreshed.accessToken;
}

function calendarSummary(projectName: string): string {
  const clean = projectName.trim().slice(0, 100) || "Untitled";
  return `DevHub - ${clean}`;
}

export async function createGcalCalendar(params: {
  accessToken: string;
  projectName: string;
}): Promise<string> {
  const res = await fetch(`${GCAL_CALENDAR_BASE}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ summary: calendarSummary(params.projectName) }),
  });
  const json = await parseJsonSafe(res);
  const calendarId = json?.["id"];
  if (!res.ok || typeof calendarId !== "string" || calendarId.length === 0) {
    // Catat reason Google (tanpa token) agar diagnosis tak tebak-tebakan:
    // insufficientPermissions = scope kurang, accessNotConfigured = API belum di-enable.
    const errObj = (json?.["error"] ?? null) as {
      message?: unknown;
      errors?: { reason?: unknown }[];
    } | null;
    const gcalReason =
      typeof errObj?.errors?.[0]?.reason === "string" ? (errObj.errors[0].reason as string) : null;
    logger.warn("gcal calendars.insert failed", { status: res.status, reason: gcalReason });
    throw new ApiError(502, "GCAL_CALENDAR_FAILED", "Failed to create Google calendar", {
      gcalStatus: res.status,
      gcalReason,
    });
  }
  return calendarId;
}

/**
 * Auto-create kalender per user+project.
 * - Bila settings sudah punya calendar_id → return langsung (idempotent).
 * - Bila belum → getValidAccessToken(userId) + POST calendars.insert
 *   `DevHub - <projectName>`, simpan calendar_id + owner.
 */
export async function ensureCalendar(
  userId: string,
  projectName: string,
  opts?: { projectId?: string },
): Promise<string> {
  const accessToken = await getValidAccessToken(userId);
  if (opts?.projectId) {
    const existing = await pool.query<{ calendar_id: string | null }>(
      "SELECT calendar_id FROM gcal_project_settings WHERE project_id = $1",
      [opts.projectId],
    );
    const cached = existing.rows[0]?.calendar_id;
    if (cached) return cached;
  }
  const calendarId = await createGcalCalendar({ accessToken, projectName });
  if (opts?.projectId) {
    await pool.query(
      `INSERT INTO gcal_project_settings (project_id, calendar_id, owner_user_id, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (project_id) DO UPDATE SET calendar_id = EXCLUDED.calendar_id, owner_user_id = EXCLUDED.owner_user_id, updated_at = now()`,
      [opts.projectId, calendarId, userId],
    );
  }
  return calendarId;
}
