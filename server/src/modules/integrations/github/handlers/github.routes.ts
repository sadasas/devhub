import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../../../config.js";
import { ApiError } from "../../../../shared/errors.js";
import { parseOrThrow } from "../../../../shared/db.js";
import { requireAuth, getUserId } from "../../../auth/middleware/requireAuth.js";
import {
  assertAdmin,
  getProjectWithRole,
} from "../../../authorization/application/authz.js";
import { githubAutomationSchema } from "../../../projects/domain/state.js";
import {
  githubConnectBodySchema,
  githubSetupQuerySchema,
} from "../domain/github.js";
import {
  assertGithubConfigured,
  handleSetupCallback,
  ensureInstallationToken,
} from "../application/install-service.js";
import { drainOutbox } from "../application/webhook-service.js";
import { importRepoIssues } from "../application/import-service.js";
import {
  listInstallationRepos,
} from "../infrastructure/github-app.js";
import {
  getInstallation as getInstallationRow,
  getProjectRepo as getRepoRow,
  connectProjectRepo as connectRepoRow,
  disconnectProjectRepo as disconnectRepoRow,
  listInstallations as listInstallationRows,
  updateProjectAutomation as updateAutomationRow,
} from "../infrastructure/github-repository.js";

export const githubRouter = Router();

const githubLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: "RATE_LIMITED", message: "Too many GitHub requests" } },
});

githubRouter.use(githubLimiter);

async function requireProjectAdmin(req: Request, projectId: string) {
  const userId = getUserId(req);
  const project = await getProjectWithRole(userId, projectId);
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  assertAdmin(project.role);
  return { userId, project };
}

/** Link install App (frontend tombol Connect). 503 bila App belum dikonfigurasi. */
githubRouter.get("/install-url", requireAuth, (req: Request, res: Response) => {
  assertGithubConfigured();
  if (!config.GITHUB_APP_SLUG) {
    throw new ApiError(503, "GITHUB_NOT_CONFIGURED", "GitHub App slug is not configured");
  }
  res.json({ installUrl: `https://github.com/apps/${config.GITHUB_APP_SLUG}/installations/new` });
});

/**
 * Callback Setup URL GitHub (`?installation_id=&setup_action=`): catat instalasi.
 * Dipanggil frontend setelah redirect GitHub (user sudah login DevHub).
 */
githubRouter.get("/setup", requireAuth, async (req: Request, res: Response) => {
  const query = parseOrThrow(githubSetupQuerySchema, req.query, "Invalid setup query");
  const row = await handleSetupCallback(query.installation_id);
  res.json({
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    accountType: row.accountType,
    setupAction: query.setup_action,
  });
});

/** Daftar instalasi yang dikenal DevHub (untuk picker repo tanpa redirect). */
githubRouter.get("/installations", requireAuth, async (_req: Request, res: Response) => {
  const installations = await listInstallationRows();
  res.json({ installations });
});

/** Daftar repo dalam 1 instalasi (untuk picker repo di Settings). */
githubRouter.get("/installations/:installationId/repos", requireAuth, async (req: Request, res: Response) => {
  const installationId = Number(req.params.installationId);
  if (!Number.isInteger(installationId) || installationId <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid installation id");
  }
  const token = await ensureInstallationToken(installationId);
  const repos = await listInstallationRepos(token);
  res.json({ repos });
});

/** Hubungkan 1 project <-> 1 repo (admin only, keputusan per-project). */
githubRouter.post("/repos", requireAuth, async (req: Request, res: Response) => {
  const body = parseOrThrow(githubConnectBodySchema, req.body, "Invalid connect body");
  const { userId } = await requireProjectAdmin(req, body.projectId);
  // Cek instalasi dulu (DB lokal, tanpa butuh App): 404 beraksi bahkan saat
  // App belum dikonfigurasi — instalasi tak dikenal berarti memang belum ada.
  const installation = await getInstallationRow(body.installationId);
  if (!installation) {
    throw new ApiError(
      404,
      "NOT_FOUND",
      "GitHub installation not found. Install the App first (Connect button) or pick an existing installation from GET /installations",
    );
  }
  assertGithubConfigured();
  const mapping = await connectRepoRow({
    projectId: body.projectId,
    installationId: body.installationId,
    owner: body.owner,
    repo: body.repo,
    connectedBy: userId,
  });
  res.status(201).json({ mapping });
});

/** Status koneksi 1 project (member boleh baca — untuk badge/settings). */
githubRouter.get("/status", requireAuth, async (req: Request, res: Response) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const userId = getUserId(req);
  const project = await getProjectWithRole(userId, projectId);
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  const mapping = await getRepoRow(projectId);
  if (!mapping) {
    return res.json({
      connected: false,
      owner: null,
      repo: null,
      installationId: null,
      accountLogin: null,
      automation: null,
    });
  }
  const installation = await getInstallationRow(mapping.installationId);
  res.json({
    connected: installation?.status === "connected",
    owner: mapping.owner,
    repo: mapping.repo,
    installationId: mapping.installationId,
    accountLogin: installation?.accountLogin ?? null,
    automation: mapping.automation,
  });
});

/** Ubah aturan automation project (admin only). */
githubRouter.patch("/repos", requireAuth, async (req: Request, res: Response) => {
  const bodySchema = githubConnectBodySchema
    .pick({ projectId: true })
    .extend({ automation: githubAutomationSchema });
  const body = parseOrThrow(bodySchema, req.body, "Invalid automation body");
  await requireProjectAdmin(req, body.projectId);
  const ok = await updateAutomationRow(body.projectId, body.automation);
  if (!ok) throw new ApiError(404, "NOT_FOUND", "GitHub repo mapping not found");
  res.json({ automation: body.automation });
});

/**
 * Disconnect project (admin only): hapus mapping repo. Link di tasks/issues
 * SENGAJA dipertahankan sebagai riwayat (badge tampil "disconnected");
 * purge penuh butuh 1 txn state — defer ke F6 bila ada demand.
 */
githubRouter.delete("/repos", requireAuth, async (req: Request, res: Response) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  await requireProjectAdmin(req, projectId);
  const removed = await disconnectRepoRow(projectId);
  if (!removed) throw new ApiError(404, "NOT_FOUND", "GitHub repo mapping not found");
  res.json({ ok: true });
});

/**
 * Drain antrean outbox jatuh tempo untuk 1 project (admin only).
 * Tanpa worker dedicated: dipicu manual + oportunistik dari Settings (F5).
 */
githubRouter.post("/outbox/drain", requireAuth, async (req: Request, res: Response) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  await requireProjectAdmin(req, projectId);
  const result = await drainOutbox(projectId);
  res.json(result);
});

/**
 * One-time import issues repo -> tasks (admin only, Pro-gated di UI).
 * Idempoten via label `gh:owner/repo#N`; PR di-skip; cap 300 (truncated flag).
 */
githubRouter.post("/import", requireAuth, async (req: Request, res: Response) => {
  const bodySchema = githubConnectBodySchema.pick({ projectId: true }).extend({
    owner: githubConnectBodySchema.shape.owner.optional(),
    repo: githubConnectBodySchema.shape.repo.optional(),
  });
  const body = parseOrThrow(bodySchema, req.body, "Invalid import body");
  const { userId } = await requireProjectAdmin(req, body.projectId);
  assertGithubConfigured();
  const mapping = await getRepoRow(body.projectId);
  const owner = body.owner ?? mapping?.owner;
  const repo = body.repo ?? mapping?.repo;
  if (!owner || !repo) throw new ApiError(400, "VALIDATION_ERROR", "No repository mapped to this project");
  const installationId = mapping?.installationId;
  if (!installationId) throw new ApiError(404, "NOT_FOUND", "GitHub installation not found");
  const token = await ensureInstallationToken(installationId);
  const result = await importRepoIssues({ projectId: body.projectId, actorId: userId, token, owner, repo });
  res.status(201).json(result);
});
