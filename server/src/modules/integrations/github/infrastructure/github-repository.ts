/**
 * Repository GitHub (infrastructure, ADR-041): akses SQL parameterized ke
 * 4 tabel 046_github.sql. Token tersimpan sealed (AES-256-GCM via vault).
 *
 * Backoff retry outbox: 1m / 5m / 30m / 30m / 30m, max 5x (pola gcal-repository).
 */

import { pool } from "../../../../db/pool.js";

export const GITHUB_MAX_ATTEMPTS = 5;
export const GITHUB_BACKOFF_MINUTES = [1, 5, 30, 30, 30] as const;

export function computeNextRetry(attempts: number, now: Date = new Date()): Date {
  const idx = Math.min(Math.max(attempts, 1), GITHUB_BACKOFF_MINUTES.length) - 1;
  const minutes = GITHUB_BACKOFF_MINUTES[idx] ?? 30;
  return new Date(now.getTime() + minutes * 60_000);
}

export interface GithubInstallationRow {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  tokenBlob: string | null;
  tokenExpiresAt: Date | null;
  status: string;
  lastError: string | null;
}

export interface GithubProjectRepo {
  projectId: string;
  installationId: number;
  owner: string;
  repo: string;
  automation: { onPrOpened: string; onPrMerged: string };
}

export type GithubOutboxOp = "link" | "status" | "comment" | "import";

export interface GithubOutboxRow {
  id: string;
  projectId: string;
  taskId: string | null;
  op: GithubOutboxOp;
  attempts: number;
  nextRetryAt: Date | null;
  payload: unknown;
  createdAt: Date;
}

function toInstallation(row: {
  installation_id: string | number;
  account_login: string | null;
  account_type: string | null;
  token_blob: string | null;
  token_expires_at: Date | string | null;
  status: string;
  last_error: string | null;
}): GithubInstallationRow {
  return {
    installationId: Number(row.installation_id),
    accountLogin: row.account_login,
    accountType: row.account_type,
    tokenBlob: row.token_blob,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
    status: row.status,
    lastError: row.last_error,
  };
}

export async function upsertInstallation(input: {
  installationId: number;
  accountLogin: string;
  accountType: string;
}): Promise<GithubInstallationRow> {
  const res = await pool.query(
    `INSERT INTO github_installations (installation_id, account_login, account_type, status)
     VALUES ($1, $2, $3, 'connected')
     ON CONFLICT (installation_id) DO UPDATE SET
       account_login = EXCLUDED.account_login,
       account_type = EXCLUDED.account_type,
       status = 'connected',
       last_error = NULL,
       updated_at = now()
     RETURNING installation_id, account_login, account_type, token_blob,
               token_expires_at, status, last_error`,
    [input.installationId, input.accountLogin, input.accountType],
  );
  return toInstallation(res.rows[0] as Parameters<typeof toInstallation>[0]);
}

export async function getInstallation(installationId: number): Promise<GithubInstallationRow | null> {
  const res = await pool.query(
    `SELECT installation_id, account_login, account_type, token_blob,
            token_expires_at, status, last_error
     FROM github_installations WHERE installation_id = $1`,
    [installationId],
  );
  if (res.rows.length === 0) return null;
  return toInstallation(res.rows[0] as Parameters<typeof toInstallation>[0]);
}

export interface GithubInstallationSummary {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  status: string;
}

/**
 * Daftar instalasi untuk picker repo (State B tanpa redirect).
 * SENGAJA tanpa token_blob/token_expires_at — picker tidak butuh secret.
 */
export async function listInstallations(): Promise<GithubInstallationSummary[]> {
  const res = await pool.query(
    `SELECT installation_id, account_login, account_type, status
     FROM github_installations ORDER BY installation_id ASC`,
  );
  return (res.rows as Array<{ installation_id: string | number; account_login: string | null; account_type: string | null; status: string }>).map(
    (row) => ({
      installationId: Number(row.installation_id),
      accountLogin: row.account_login,
      accountType: row.account_type,
      status: row.status,
    }),
  );
}

export async function saveInstallationToken(
  installationId: number,
  tokenBlob: string,
  expiresAt: Date,
): Promise<void> {
  await pool.query(
    `UPDATE github_installations
     SET token_blob = $2, token_expires_at = $3, status = 'connected',
         last_error = NULL, updated_at = now()
     WHERE installation_id = $1`,
    [installationId, tokenBlob, expiresAt.toISOString()],
  );
}

export async function markInstallationStatus(
  installationId: number,
  status: string,
  lastError: string | null,
): Promise<void> {
  await pool.query(
    `UPDATE github_installations
     SET status = $2, last_error = $3, updated_at = now()
     WHERE installation_id = $1`,
    [installationId, status, lastError],
  );
}

export async function getProjectRepo(projectId: string): Promise<GithubProjectRepo | null> {
  const res = await pool.query(
    `SELECT project_id, installation_id, owner, repo, automation
     FROM github_project_repos WHERE project_id = $1`,
    [projectId],
  );
  const row = res.rows[0] as
    | { project_id: string; installation_id: string | number; owner: string; repo: string; automation: unknown }
    | undefined;
  if (!row) return null;
  const automation = (row.automation ?? {}) as { onPrOpened?: string; onPrMerged?: string };
  return {
    projectId: row.project_id,
    installationId: Number(row.installation_id),
    owner: row.owner,
    repo: row.repo,
    automation: {
      onPrOpened: automation.onPrOpened ?? "suggest",
      onPrMerged: automation.onPrMerged ?? "suggest",
    },
  };
}

export async function connectProjectRepo(input: {
  projectId: string;
  installationId: number;
  owner: string;
  repo: string;
  connectedBy: string | null;
}): Promise<GithubProjectRepo> {
  const res = await pool.query(
    `INSERT INTO github_project_repos (project_id, installation_id, owner, repo, connected_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (project_id) DO UPDATE SET
       installation_id = EXCLUDED.installation_id,
       owner = EXCLUDED.owner,
       repo = EXCLUDED.repo,
       connected_by = EXCLUDED.connected_by,
       updated_at = now()
     RETURNING project_id, installation_id, owner, repo, automation`,
    [input.projectId, input.installationId, input.owner, input.repo, input.connectedBy],
  );
  const row = res.rows[0] as { project_id: string; installation_id: string | number; owner: string; repo: string; automation: unknown };
  const automation = (row.automation ?? {}) as { onPrOpened?: string; onPrMerged?: string };
  return {
    projectId: row.project_id,
    installationId: Number(row.installation_id),
    owner: row.owner,
    repo: row.repo,
    automation: {
      onPrOpened: automation.onPrOpened ?? "suggest",
      onPrMerged: automation.onPrMerged ?? "suggest",
    },
  };
}

export async function disconnectProjectRepo(projectId: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM github_project_repos WHERE project_id = $1`, [projectId]);
  return (res.rowCount ?? 0) > 0;
}

export async function updateProjectAutomation(
  projectId: string,
  automation: { onPrOpened: string; onPrMerged: string },
): Promise<boolean> {
  const res = await pool.query(
    `UPDATE github_project_repos SET automation = $2::jsonb, updated_at = now() WHERE project_id = $1`,
    [projectId, JSON.stringify(automation)],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Routing webhook: semua project DevHub yang memetakan repo ini (monorepo boleh >1). */
export async function findProjectsByRepo(owner: string, repo: string): Promise<GithubProjectRepo[]> {
  const res = await pool.query(
    `SELECT project_id, installation_id, owner, repo, automation
     FROM github_project_repos WHERE owner = $1 AND repo = $2`,
    [owner, repo],
  );
  return (res.rows as Array<{ project_id: string; installation_id: string | number; owner: string; repo: string; automation: unknown }>).map(
    (row) => {
      const automation = (row.automation ?? {}) as { onPrOpened?: string; onPrMerged?: string };
      return {
        projectId: row.project_id,
        installationId: Number(row.installation_id),
        owner: row.owner,
        repo: row.repo,
        automation: {
          onPrOpened: automation.onPrOpened ?? "suggest",
          onPrMerged: automation.onPrMerged ?? "suggest",
        },
      };
    },
  );
}

/**
 * Idempotency webhook: true = baru diproses; false = delivery duplikat (skip).
 * `projectId` nullable — event instalasi tidak terikat project.
 */
export async function insertWebhookDelivery(input: {
  deliveryId: string;
  event: string;
  action: string | null;
  repo: string | null;
  projectId: string | null;
}): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO github_webhook_events (delivery_id, event, action, repo, project_id)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (delivery_id) DO NOTHING`,
    [input.deliveryId, input.event, input.action, input.repo, input.projectId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function enqueueOutbox(input: {
  projectId: string;
  taskId: string | null;
  op: GithubOutboxOp;
  payload: unknown;
}): Promise<void> {
  await pool.query(
    `INSERT INTO github_outbox (project_id, task_id, op, payload) VALUES ($1, $2, $3, $4::jsonb)`,
    [input.projectId, input.taskId, input.op, JSON.stringify(input.payload ?? {})],
  );
}

export async function listDueOutbox(limit: number, now: Date): Promise<GithubOutboxRow[]> {
  const res = await pool.query(
    `SELECT id, project_id, task_id, op, attempts, next_retry_at, payload, created_at
     FROM github_outbox
     WHERE (next_retry_at IS NULL OR next_retry_at <= $2) AND attempts < $3
     ORDER BY created_at ASC LIMIT $1`,
    [limit, now.toISOString(), GITHUB_MAX_ATTEMPTS],
  );
  return (res.rows as Array<{ id: string; project_id: string; task_id: string | null; op: string; attempts: number; next_retry_at: Date | null; payload: unknown; created_at: Date }>).map(
    (r) => ({
      id: r.id,
      projectId: r.project_id,
      taskId: r.task_id,
      op: r.op as GithubOutboxOp,
      attempts: r.attempts,
      nextRetryAt: r.next_retry_at,
      payload: r.payload,
      createdAt: r.created_at,
    }),
  );
}

export async function markOutboxForRetry(id: string, attempts: number, nextRetryAt: Date): Promise<void> {
  await pool.query(`UPDATE github_outbox SET attempts = $2, next_retry_at = $3 WHERE id = $1`, [
    id,
    attempts,
    nextRetryAt.toISOString(),
  ]);
}

export async function deleteOutbox(id: string): Promise<void> {
  await pool.query(`DELETE FROM github_outbox WHERE id = $1`, [id]);
}
