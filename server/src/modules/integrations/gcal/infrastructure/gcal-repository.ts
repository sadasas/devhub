/**
 * Repository GCal (infrastructure, ADR-041): akses SQL parameterized ke 4 tabel locked.
 *
 * Fondasi tabel milik Agent A (038_gcal.sql, T1+T2) — file ini HANYA consumer:
 * - gcal_connections(user_id, refresh_token_enc, access_token_enc, expiry, status, ...)
 *   status di Agent A: 'connected' vs lainnya ('error'/'revoked'/...). Lapisan ini
 *   menormalkan apa pun selain 'connected' menjadi 'needs_reconnect' agar T3
 *   (brief: 401 → needs_reconnect) dan fondasi tetap interoperabel.
 * - gcal_project_settings(project_id, calendar_id NULLABLE, sync_enabled, ...)
 *   calendar_id NULL → fallback 'primary'.
 * - gcal_event_map(project_id, task_id, event_id, calendar_id)
 * - gcal_outbox(id, project_id, task_id, op, attempts, next_retry_at, payload)
 *   op di fondasi: 'upsert' | 'delete' (domain/gcal.ts gcalOutboxOp). T3 memetakan
 *   insert/patch → 'upsert' (insert bila belum ada map, patch bila sudah ada),
 *   delete → 'delete'. Ini memenuhi CHECK 038_gcal.sql sekaligus kontrak fungsional
 *   "create→insert, reschedule→patch, delete→delete".
 *
 * Backoff retry kuota: 1m / 5m / 30m / 30m / 30m, max 5x (dead-letter setelah itu).
 * `GcalStore` adalah interface yang dipakai sync-service sehingga unit-test bisa
 * memakai fake in-memory tanpa DB.
 */

import { pool } from '../../../../db/pool.js';

export const GCAL_MAX_ATTEMPTS = 5;
/** Backoff per attempt ke-N (1-based): 1m, 5m, lalu 30m. */
export const GCAL_BACKOFF_MINUTES = [1, 5, 30, 30, 30] as const;

export function computeNextRetry(attempts: number, now: Date = new Date()): Date {
  const idx = Math.min(Math.max(attempts, 1), GCAL_BACKOFF_MINUTES.length) - 1;
  const minutes = GCAL_BACKOFF_MINUTES[idx] ?? 30;
  return new Date(now.getTime() + minutes * 60_000);
}

/** Op penyimpanan (sesuai CHECK 038_gcal.sql + domain gcalOutboxOp). */
export type GcalOp = 'upsert' | 'delete';
export type GcalConnectionStatus = 'connected' | 'needs_reconnect';

export const GCAL_FALLBACK_CALENDAR_ID = 'primary';

export interface GcalProjectSettings {
  calendarId: string;
  syncEnabled: boolean;
}

export interface GcalConnection {
  userId: string;
  refreshTokenEnc: string;
  accessTokenEnc: string | null;
  expiry: Date | null;
  status: GcalConnectionStatus;
}

export interface GcalEventMapEntry {
  eventId: string;
  calendarId: string;
}

export interface GcalOutboxRow {
  id: string;
  projectId: string;
  taskId: string;
  op: GcalOp;
  attempts: number;
  nextRetryAt: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  createdAt: Date;
}

export interface EnqueueOutboxInput {
  projectId: string;
  taskId: string;
  op: GcalOp;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  now?: Date;
}

export interface GcalStore {
  getProjectSettings(projectId: string): Promise<GcalProjectSettings | null>;
  getConnection(userId: string): Promise<GcalConnection | null>;
  updateConnectionTokens(userId: string, accessTokenEnc: string, expiry: Date): Promise<void>;
  markNeedsReconnect(userId: string): Promise<void>;
  getEventMap(projectId: string, taskId: string): Promise<GcalEventMapEntry | null>;
  upsertEventMap(projectId: string, taskId: string, eventId: string, calendarId: string): Promise<void>;
  deleteEventMap(projectId: string, taskId: string): Promise<void>;
  enqueueOutbox(input: EnqueueOutboxInput): Promise<void>;
  listDueOutbox(limit: number, now: Date): Promise<GcalOutboxRow[]>;
  markOutboxForRetry(id: string, attempts: number, nextRetryAt: Date): Promise<void>;
  deleteOutbox(id: string): Promise<void>;
  resolveUserForProject(projectId: string, preferredUserId?: string): Promise<string | null>;
}

function toConnection(row: {
  user_id: string;
  refresh_token_enc: string;
  access_token_enc: string | null;
  expiry: Date | string | null;
  status: string;
}): GcalConnection {
  return {
    userId: row.user_id,
    refreshTokenEnc: row.refresh_token_enc,
    accessTokenEnc: row.access_token_enc,
    expiry: row.expiry ? new Date(row.expiry) : null,
    // Fondasi Agent A memakai 'error'/'revoked' untuk gagal; T3 memakai
    // 'needs_reconnect'. Normalisasi: hanya 'connected' yang dianggap sehat.
    status: row.status === 'connected' ? 'connected' : 'needs_reconnect',
  };
}

/** Implementasi Postgres produksi (pool singleton). */
export const pgGcalStore: GcalStore = {
  async getProjectSettings(projectId: string): Promise<GcalProjectSettings | null> {
    const r = await pool.query<{ calendar_id: string | null; sync_enabled: boolean }>(
      'SELECT calendar_id, sync_enabled FROM gcal_project_settings WHERE project_id = $1',
      [projectId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { calendarId: row.calendar_id ?? GCAL_FALLBACK_CALENDAR_ID, syncEnabled: row.sync_enabled };
  },

  async getConnection(userId: string): Promise<GcalConnection | null> {
    const r = await pool.query<{
      user_id: string;
      refresh_token_enc: string;
      access_token_enc: string | null;
      expiry: Date | null;
      status: string;
    }>('SELECT user_id, refresh_token_enc, access_token_enc, expiry, status FROM gcal_connections WHERE user_id = $1', [userId]);
    const row = r.rows[0];
    if (!row) return null;
    return toConnection(row);
  },

  async updateConnectionTokens(userId: string, accessTokenEnc: string, expiry: Date): Promise<void> {
    await pool.query(
      "UPDATE gcal_connections SET access_token_enc = $2, expiry = $3, status = 'connected', updated_at = now() WHERE user_id = $1",
      [userId, accessTokenEnc, expiry.toISOString()],
    );
  },

  async markNeedsReconnect(userId: string): Promise<void> {
    // Nilai 'needs_reconnect' lolos (038_gcal.sql tanpa CHECK status) dan dibaca
    // fondasi sebagai disconnected (status !== 'connected').
    await pool.query(
      "UPDATE gcal_connections SET status = 'needs_reconnect', updated_at = now() WHERE user_id = $1",
      [userId],
    );
  },

  async getEventMap(projectId: string, taskId: string): Promise<GcalEventMapEntry | null> {
    const r = await pool.query<{ event_id: string; calendar_id: string | null }>(
      'SELECT event_id, calendar_id FROM gcal_event_map WHERE project_id = $1 AND task_id = $2',
      [projectId, taskId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { eventId: row.event_id, calendarId: row.calendar_id ?? GCAL_FALLBACK_CALENDAR_ID };
  },

  async upsertEventMap(projectId: string, taskId: string, eventId: string, calendarId: string): Promise<void> {
    await pool.query(
      `INSERT INTO gcal_event_map (project_id, task_id, event_id, calendar_id, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (project_id, task_id)
       DO UPDATE SET event_id = EXCLUDED.event_id, calendar_id = EXCLUDED.calendar_id, updated_at = now()`,
      [projectId, taskId, eventId, calendarId],
    );
  },

  async deleteEventMap(projectId: string, taskId: string): Promise<void> {
    await pool.query('DELETE FROM gcal_event_map WHERE project_id = $1 AND task_id = $2', [projectId, taskId]);
  },

  /**
   * Coalescing anti-duplikat edit cepat beruntun: satu task hanya punya SATU
   * baris pending. Op lama diganti op+payload terbaru dalam satu transaksi.
   */
  async enqueueOutbox(input: EnqueueOutboxInput): Promise<void> {
    const now = input.now ?? new Date();
    const nextRetry = computeNextRetry(1, now);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM gcal_outbox WHERE project_id = $1 AND task_id = $2 AND attempts < ${GCAL_MAX_ATTEMPTS}`,
        [input.projectId, input.taskId],
      );
      await client.query(
        'INSERT INTO gcal_outbox (project_id, task_id, op, attempts, next_retry_at, payload) VALUES ($1, $2, $3, 0, $4, $5::jsonb)',
        [input.projectId, input.taskId, input.op, nextRetry.toISOString(), JSON.stringify(input.payload ?? {})],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  async listDueOutbox(limit: number, now: Date): Promise<GcalOutboxRow[]> {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 200);
    const r = await pool.query<{
      id: string;
      project_id: string;
      task_id: string | null;
      op: string;
      attempts: number;
      next_retry_at: Date | string | null;
      payload: unknown;
      created_at: Date | string;
    }>(
      `SELECT id, project_id, task_id, op, attempts, next_retry_at, payload, created_at
       FROM gcal_outbox
       WHERE next_retry_at <= $1 AND attempts < ${GCAL_MAX_ATTEMPTS}
       ORDER BY next_retry_at ASC, created_at ASC
       LIMIT $2`,
      [now.toISOString(), safeLimit],
    );
    return r.rows
      .filter((row) => (row.op === 'upsert' || row.op === 'delete') && typeof row.task_id === 'string' && row.task_id.length > 0 && row.next_retry_at)
      .map((row) => ({
        id: row.id,
        projectId: row.project_id,
        taskId: row.task_id as string,
        op: row.op as GcalOp,
        attempts: row.attempts,
        nextRetryAt: new Date(row.next_retry_at as Date | string),
        payload: row.payload,
        createdAt: new Date(row.created_at),
      }));
  },

  async markOutboxForRetry(id: string, attempts: number, nextRetryAt: Date): Promise<void> {
    await pool.query('UPDATE gcal_outbox SET attempts = $2, next_retry_at = $3 WHERE id = $1', [
      id,
      attempts,
      nextRetryAt.toISOString(),
    ]);
  },

  async deleteOutbox(id: string): Promise<void> {
    await pool.query('DELETE FROM gcal_outbox WHERE id = $1', [id]);
  },

  /**
   * Resolusi koneksi untuk sebuah project:
   * 1) preferredUserId (aktor edit) bila ia punya koneksi connected → pakai itu.
   * 2) fallback: satu member tim project yang koneksinya connected.
   */
  async resolveUserForProject(projectId: string, preferredUserId?: string): Promise<string | null> {
    if (preferredUserId) {
      const r = await pool.query<{ user_id: string }>(
        "SELECT user_id FROM gcal_connections WHERE user_id = $1 AND status = 'connected'",
        [preferredUserId],
      );
      if (r.rows[0]) return preferredUserId;
    }
    const r = await pool.query<{ user_id: string }>(
      `SELECT c.user_id
       FROM gcal_connections c
       JOIN team_members tm ON tm.user_id = c.user_id
       JOIN projects p ON p.team_id = tm.team_id
       WHERE p.id = $1 AND c.status = 'connected'
       LIMIT 1`,
      [projectId],
    );
    return r.rows[0]?.user_id ?? null;
  },
};
