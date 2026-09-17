/**
 * Sync service GCal — push worker insert/patch/delete + retry kuota (T3).
 *
 * Kontrak locked:
 * - syncTaskCreated / syncTaskUpdated / syncTaskDeleted(projectId, task[, userId])
 * - processOutbox() — worker retry backoff 1m/5m/30m max 5x
 * - 429/403 rateLimitExceeded → gcal_outbox (retry); 401/invalid_grant →
 *   gcal_connections.status='needs_reconnect' (stop retry, tanpa enqueue).
 * - Idempoten via gcal_event_map + extendedProperties (TIDAK search by title).
 * - sync_enabled=false → skip (termasuk delete).
 *
 * Cara trigger worker (tanpa cron lib baru):
 * 1) Interval in-process di server/src/index.ts:
 *      setInterval(() => void processOutbox().catch(...), 60_000).unref()
 *    (di-skip saat NODE_ENV=test). Aman untuk single-instance; untuk multi-instance
 *    tetap aman karena SELECT due + DELETE/UPDATE per-row bersifat idempoten dan
 *    Sólo satu baris pending per task (coalescing di repository).
 * 2) Endpoint internal manual: POST /api/v1/integrations/gcal/outbox/process
 *    (auth required) — untuk trigger manual / scheduler eksternal / runbook.
 *
 * Anti-duplikat edit cepat beruntun:
 * - In-memory task lock (per project+task) menyerikan panggilan konkuren dalam
 *   satu proses sehingga insert kedua melihat map dari insert pertama.
 * - enqueueOutbox coalescing (satu pending per task) + cek event_map sebelum
 *   insert (insert berubah menjadi patch bila map sudah ada).
 * - Hook entity-router bersifat fire-and-forget (tidak memblokir respons HTTP).
 *
 * Keamanan: TIDAK pernah me-log token / blob *_enc (coding-standards §7).
 */

import { config } from '../../../../config.js';
import { logger } from '../../../../shared/logger.js';
import {
  taskToEvent,
  isRelevantTaskChange,
  type GcalTaskInput,
} from './mapping.js';
import {
  insertGcalEvent,
  patchGcalEvent,
  deleteGcalEvent,
  refreshAccessToken,
  isRateLimited,
  isInvalidGrant,
  isGone,
  isExpired,
  GcalApiError,
  type FetchImpl,
} from '../infrastructure/gcal-client.js';
import {
  pgGcalStore,
  computeNextRetry,
  GCAL_MAX_ATTEMPTS,
  type GcalStore,
} from '../infrastructure/gcal-repository.js';
import { encryptKey, decryptKey } from '../../../keys/infrastructure/key-crypto.js';

export interface SyncDeps {
  store?: GcalStore;
  fetchImpl?: FetchImpl;
  now?: () => Date;
  clientId?: string;
  clientSecret?: string;
  encrypt?: (raw: string) => string;
  decrypt?: (enc: string) => string;
}

interface ResolvedDeps {
  store: GcalStore;
  fetchImpl: FetchImpl | undefined;
  now: () => Date;
  clientId: string;
  clientSecret: string;
  encrypt: (raw: string) => string;
  decrypt: (enc: string) => string;
}

function resolveDeps(deps?: SyncDeps): ResolvedDeps {
  return {
    store: deps?.store ?? pgGcalStore,
    fetchImpl: deps?.fetchImpl,
    now: deps?.now ?? (() => new Date()),
    clientId: deps?.clientId ?? config.GOOGLE_CLIENT_ID ?? '',
    clientSecret: deps?.clientSecret ?? config.GOOGLE_CLIENT_SECRET ?? '',
    encrypt: deps?.encrypt ?? encryptKey,
    decrypt: deps?.decrypt ?? decryptKey,
  };
}

export type SyncStatus =
  | 'skipped'
  | 'no-dates'
  | 'inserted'
  | 'patched'
  | 'deleted'
  | 'queued'
  | 'needs-reconnect';

export interface SyncResult {
  status: SyncStatus;
  reason?: string;
  eventId?: string;
}

class NeedsReconnectError extends Error {
  readonly userId: string;
  constructor(userId: string) {
    super('Google connection needs reconnect');
    this.name = 'NeedsReconnectError';
    this.userId = userId;
  }
}

// --- In-flight lock per task (anti-duplikat edit cepat dalam satu proses) ---
const inflight = new Map<string, Promise<void>>();

/** Diekspor untuk test (reset antar case). */
export function __clearGcalInflightForTests(): void {
  inflight.clear();
}

async function withTaskLock<T>(projectId: string, taskId: string, fn: () => Promise<T>): Promise<T> {
  const key = `${projectId}:${taskId}`;
  const prev = inflight.get(key);
  if (prev) {
    try {
      await prev;
    } catch {
      // Abaikan — giliran ini tetap jalan dengan state terbaru.
    }
  }
  let release: () => void = () => {};
  const current = new Promise<void>((res) => {
    release = () => res();
  });
  inflight.set(key, current);
  try {
    return await fn();
  } finally {
    inflight.delete(key);
    release();
  }
}

/** Ambil access token valid (refresh bila expiry). Lempar NeedsReconnectError bila revoked. */
async function getValidAccessToken(userId: string, r: ResolvedDeps): Promise<string> {
  const conn = await r.store.getConnection(userId);
  if (!conn || conn.status === 'needs_reconnect') {
    throw new NeedsReconnectError(userId);
  }
  const now = r.now();
  if (conn.accessTokenEnc && conn.expiry && !isExpired(conn.expiry, now)) {
    try {
      return r.decrypt(conn.accessTokenEnc);
    } catch {
      await r.store.markNeedsReconnect(userId);
      throw new NeedsReconnectError(userId);
    }
  }
  let refreshToken: string;
  try {
    refreshToken = r.decrypt(conn.refreshTokenEnc);
  } catch {
    await r.store.markNeedsReconnect(userId);
    throw new NeedsReconnectError(userId);
  }
  if (!r.clientId || !r.clientSecret) {
    throw new GcalApiError(503, 'Google OAuth client is not configured');
  }
  try {
    const refreshed = await refreshAccessToken({
      refreshToken,
      clientId: r.clientId,
      clientSecret: r.clientSecret,
      fetchImpl: r.fetchImpl,
      now,
    });
    await r.store.updateConnectionTokens(userId, r.encrypt(refreshed.accessToken), refreshed.expiry);
    return refreshed.accessToken;
  } catch (err) {
    if (err instanceof GcalApiError && isInvalidGrant(err.status, err.gcalReason, err.message)) {
      await r.store.markNeedsReconnect(userId);
      throw new NeedsReconnectError(userId);
    }
    throw err;
  }
}

interface OutboxTaskPayload {
  task: GcalTaskInput;
  calendarId: string;
  userId: string;
}

function toOutboxPayload(task: GcalTaskInput, calendarId: string, userId: string): OutboxTaskPayload {
  return {
    task: {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      status: task.status,
      priority: task.priority,
      labels: Array.isArray(task.labels) ? [...task.labels] : undefined,
      startDate: task.startDate ?? null,
      dueDate: task.dueDate ?? null,
      description: (task.description ?? '').slice(0, 8000),
    },
    calendarId,
    userId,
  };
}

async function enqueueRateLimited(
  r: ResolvedDeps,
  projectId: string,
  taskId: string,
  op: 'upsert' | 'delete',
  payload: OutboxTaskPayload,
): Promise<SyncResult> {
  await r.store.enqueueOutbox({ projectId, taskId, op, payload, now: r.now() });
  return { status: 'queued', reason: 'rate-limited' };
}

function logWarn(op: string, projectId: string, taskId: string, reason: string, extra?: Record<string, unknown>): void {
  logger.warn(`gcal sync ${op} ${reason}`, { projectId, taskId, op, ...extra });
}

// ---------------------------------------------------------------------------
// syncTaskCreated(projectId, task[, userId[, deps]])
// ---------------------------------------------------------------------------
export async function syncTaskCreated(
  projectId: string,
  task: GcalTaskInput,
  userId?: string,
  deps?: SyncDeps,
): Promise<SyncResult> {
  const r = resolveDeps(deps);
  return withTaskLock(projectId, task.id, async () => {
    const settings = await r.store.getProjectSettings(projectId);
    if (!settings || !settings.syncEnabled) return { status: 'skipped', reason: 'sync-disabled' };

    const body = taskToEvent(task, projectId);
    if (!body) return { status: 'no-dates', reason: 'task-has-no-dates' };

    const resolvedUser = await r.store.resolveUserForProject(projectId, userId);
    if (!resolvedUser) return { status: 'skipped', reason: 'no-connection' };

    // Idempoten: map sudah ada (race insert ganda) → alihkan ke patch.
    const existing = await r.store.getEventMap(projectId, task.id);
    if (existing) {
      return doPatch(r, projectId, task, body, existing.eventId, existing.calendarId, resolvedUser);
    }

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(resolvedUser, r);
    } catch (err) {
      if (err instanceof NeedsReconnectError) return { status: 'needs-reconnect', reason: 'needs-reconnect' };
      if (err instanceof GcalApiError && isRateLimited(err.status, err.gcalReason)) {
        return enqueueRateLimited(r, projectId, task.id, 'upsert', toOutboxPayload(task, settings.calendarId, resolvedUser));
      }
      throw err;
    }

    try {
      const { id } = await insertGcalEvent({
        calendarId: settings.calendarId,
        accessToken,
        body,
        fetchImpl: r.fetchImpl,
      });
      await r.store.upsertEventMap(projectId, task.id, id, settings.calendarId);
      return { status: 'inserted', eventId: id };
    } catch (err) {
      if (err instanceof GcalApiError) {
        if (isInvalidGrant(err.status, err.gcalReason, err.message)) {
          await r.store.markNeedsReconnect(resolvedUser);
          return { status: 'needs-reconnect', reason: 'invalid-grant' };
        }
        if (isRateLimited(err.status, err.gcalReason)) {
          return enqueueRateLimited(r, projectId, task.id, 'upsert', toOutboxPayload(task, settings.calendarId, resolvedUser));
        }
        if (err.status >= 500) {
          return enqueueRateLimited(r, projectId, task.id, 'upsert', toOutboxPayload(task, settings.calendarId, resolvedUser));
        }
      }
      logWarn('insert', projectId, task.id, 'failed', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  });
}

async function doPatch(
  r: ResolvedDeps,
  projectId: string,
  task: GcalTaskInput,
  body: NonNullable<ReturnType<typeof taskToEvent>>,
  eventId: string,
  calendarId: string,
  resolvedUser: string,
): Promise<SyncResult> {
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(resolvedUser, r);
  } catch (err) {
    if (err instanceof NeedsReconnectError) return { status: 'needs-reconnect', reason: 'needs-reconnect' };
    if (err instanceof GcalApiError && (isRateLimited(err.status, err.gcalReason) || err.status >= 500)) {
      return enqueueRateLimited(r, projectId, task.id, 'upsert', toOutboxPayload(task, calendarId, resolvedUser));
    }
    throw err;
  }
  try {
    const { id } = await patchGcalEvent({ calendarId, eventId, accessToken, body, fetchImpl: r.fetchImpl });
    await r.store.upsertEventMap(projectId, task.id, id, calendarId);
    return { status: 'patched', eventId: id };
  } catch (err) {
    if (err instanceof GcalApiError) {
      if (isInvalidGrant(err.status, err.gcalReason, err.message)) {
        await r.store.markNeedsReconnect(resolvedUser);
        return { status: 'needs-reconnect', reason: 'invalid-grant' };
      }
      if (isRateLimited(err.status, err.gcalReason) || err.status >= 500) {
        return enqueueRateLimited(r, projectId, task.id, 'upsert', toOutboxPayload(task, calendarId, resolvedUser));
      }
      if (isGone(err.status)) {
        // Event dihapus manual di Google → recreate via insert sekali.
        const settings = await r.store.getProjectSettings(projectId);
        const targetCalendar = settings?.calendarId ?? calendarId;
        try {
          const token2 = await getValidAccessToken(resolvedUser, r);
          const created = await insertGcalEvent({
            calendarId: targetCalendar,
            accessToken: token2,
            body,
            fetchImpl: r.fetchImpl,
          });
          await r.store.upsertEventMap(projectId, task.id, created.id, targetCalendar);
          return { status: 'inserted', eventId: created.id };
        } catch (inner) {
          if (inner instanceof GcalApiError && (isRateLimited(inner.status, inner.gcalReason) || inner.status >= 500)) {
            return enqueueRateLimited(r, projectId, task.id, 'upsert', toOutboxPayload(task, targetCalendar, resolvedUser));
          }
          throw inner;
        }
      }
    }
    logWarn('patch', projectId, task.id, 'failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

async function doDelete(
  r: ResolvedDeps,
  projectId: string,
  taskId: string,
  eventId: string,
  calendarId: string,
  resolvedUser: string,
): Promise<SyncResult> {
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(resolvedUser, r);
  } catch (err) {
    if (err instanceof NeedsReconnectError) return { status: 'needs-reconnect', reason: 'needs-reconnect' };
    if (err instanceof GcalApiError && (isRateLimited(err.status, err.gcalReason) || err.status >= 500)) {
      return enqueueRateLimited(
        r,
        projectId,
        taskId,
        'delete',
        toOutboxPayload({ id: taskId, title: '', status: 'todo' }, calendarId, resolvedUser),
      );
    }
    throw err;
  }
  try {
    await deleteGcalEvent({ calendarId, eventId, accessToken, fetchImpl: r.fetchImpl });
    await r.store.deleteEventMap(projectId, taskId);
    return { status: 'deleted', eventId };
  } catch (err) {
    if (err instanceof GcalApiError) {
      if (isInvalidGrant(err.status, err.gcalReason, err.message)) {
        await r.store.markNeedsReconnect(resolvedUser);
        return { status: 'needs-reconnect', reason: 'invalid-grant' };
      }
      if (isRateLimited(err.status, err.gcalReason) || err.status >= 500) {
        return enqueueRateLimited(
          r,
          projectId,
          taskId,
          'delete',
          toOutboxPayload({ id: taskId, title: '', status: 'todo' }, calendarId, resolvedUser),
        );
      }
    }
    logWarn('delete', projectId, taskId, 'failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// syncTaskUpdated(projectId, task[, userId[, before[, deps]]])
// ---------------------------------------------------------------------------
export async function syncTaskUpdated(
  projectId: string,
  task: GcalTaskInput,
  userId?: string,
  before?: GcalTaskInput | null,
  deps?: SyncDeps,
): Promise<SyncResult> {
  const r = resolveDeps(deps);
  return withTaskLock(projectId, task.id, async () => {
    const settings = await r.store.getProjectSettings(projectId);
    if (!settings || !settings.syncEnabled) return { status: 'skipped', reason: 'sync-disabled' };

    if (before && !isRelevantTaskChange(before, task)) {
      return { status: 'skipped', reason: 'no-relevant-change' };
    }

    const body = taskToEvent(task, projectId);
    const existing = await r.store.getEventMap(projectId, task.id);
    const resolvedUser = await r.store.resolveUserForProject(projectId, userId);

    // Hapus tanggal (atau task tak bertanggal) + ada map → delete.
    if (!body) {
      if (!existing) return { status: 'no-dates', reason: 'task-has-no-dates' };
      if (!resolvedUser) return { status: 'skipped', reason: 'no-connection' };
      return doDelete(r, projectId, task.id, existing.eventId, existing.calendarId, resolvedUser);
    }

    // Dapat tanggal tapi belum ada map → insert (task baru diberi tanggal / map hilang).
    if (!existing) {
      if (!resolvedUser) return { status: 'skipped', reason: 'no-connection' };
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(resolvedUser, r);
      } catch (err) {
        if (err instanceof NeedsReconnectError) return { status: 'needs-reconnect', reason: 'needs-reconnect' };
        if (err instanceof GcalApiError && (isRateLimited(err.status, err.gcalReason) || err.status >= 500)) {
          return enqueueRateLimited(r, projectId, task.id, 'upsert', toOutboxPayload(task, settings.calendarId, resolvedUser));
        }
        throw err;
      }
      try {
        const { id } = await insertGcalEvent({
          calendarId: settings.calendarId,
          accessToken,
          body,
          fetchImpl: r.fetchImpl,
        });
        await r.store.upsertEventMap(projectId, task.id, id, settings.calendarId);
        return { status: 'inserted', eventId: id };
      } catch (err) {
        if (err instanceof GcalApiError) {
          if (isInvalidGrant(err.status, err.gcalReason, err.message)) {
            await r.store.markNeedsReconnect(resolvedUser);
            return { status: 'needs-reconnect', reason: 'invalid-grant' };
          }
          if (isRateLimited(err.status, err.gcalReason) || err.status >= 500) {
            return enqueueRateLimited(r, projectId, task.id, 'upsert', toOutboxPayload(task, settings.calendarId, resolvedUser));
          }
        }
        logWarn('insert', projectId, task.id, 'failed', { error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    }

    if (!resolvedUser) return { status: 'skipped', reason: 'no-connection' };
    return doPatch(r, projectId, task, body, existing.eventId, existing.calendarId, resolvedUser);
  });
}

// ---------------------------------------------------------------------------
// syncTaskDeleted(projectId, { id }[, userId[, deps]])
// ---------------------------------------------------------------------------
export async function syncTaskDeleted(
  projectId: string,
  taskRef: Pick<GcalTaskInput, 'id'>,
  userId?: string,
  deps?: SyncDeps,
): Promise<SyncResult> {
  const r = resolveDeps(deps);
  return withTaskLock(projectId, taskRef.id, async () => {
    const settings = await r.store.getProjectSettings(projectId);
    if (!settings || !settings.syncEnabled) return { status: 'skipped', reason: 'sync-disabled' };
    const existing = await r.store.getEventMap(projectId, taskRef.id);
    if (!existing) return { status: 'skipped', reason: 'no-event-map' };
    const resolvedUser = await r.store.resolveUserForProject(projectId, userId);
    if (!resolvedUser) return { status: 'skipped', reason: 'no-connection' };
    return doDelete(r, projectId, taskRef.id, existing.eventId, existing.calendarId, resolvedUser);
  });
}

// ---------------------------------------------------------------------------
// processOutbox([deps[, limit]]) — worker retry
// ---------------------------------------------------------------------------
export async function processOutbox(deps?: SyncDeps, limit = 50): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  pending: number;
}> {
  const r = resolveDeps(deps);
  const now = r.now();
  const rows = await r.store.listDueOutbox(limit, now);
  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    await withTaskLock(row.projectId, row.taskId, async () => {
      const settings = await r.store.getProjectSettings(row.projectId);
      if (!settings || !settings.syncEnabled) {
        // Sync dimatikan setelah enqueue → drop agar tidak retry selamanya.
        await r.store.deleteOutbox(row.id);
        succeeded += 1;
        return;
      }
      const payload = (row.payload ?? {}) as Partial<OutboxTaskPayload>;
      const payloadTask = payload.task as GcalTaskInput | undefined;
      const task: GcalTaskInput =
        payloadTask && typeof payloadTask.id === 'string'
          ? {
              id: row.taskId,
              projectId: typeof payloadTask.projectId === 'string' ? payloadTask.projectId : row.projectId,
              title: typeof payloadTask.title === 'string' ? payloadTask.title : '',
              status: typeof payloadTask.status === 'string' ? payloadTask.status : 'todo',
              priority: typeof payloadTask.priority === 'string' ? payloadTask.priority : undefined,
              labels: Array.isArray(payloadTask.labels)
                ? payloadTask.labels.filter((l): l is string => typeof l === 'string')
                : undefined,
              startDate: (payloadTask.startDate as string | null | undefined) ?? null,
              dueDate: (payloadTask.dueDate as string | null | undefined) ?? null,
              description: typeof payloadTask.description === 'string' ? payloadTask.description : '',
            }
          : { id: row.taskId, title: '', status: 'todo' };
      const calendarId =
        typeof payload.calendarId === 'string' && payload.calendarId.length > 0
          ? payload.calendarId
          : settings.calendarId;
      const preferredUser = typeof payload.userId === 'string' ? payload.userId : undefined;
      const resolvedUser = await r.store.resolveUserForProject(row.projectId, preferredUser);
      if (!resolvedUser) {
        await r.store.deleteOutbox(row.id);
        succeeded += 1;
        return;
      }
      const failOrRetry = async (err: unknown): Promise<void> => {
        if (err instanceof NeedsReconnectError) {
          // Stop retry permanen untuk baris ini (butuh reconnect manual).
          await r.store.deleteOutbox(row.id);
          failed += 1;
          return;
        }
        if (err instanceof GcalApiError) {
          if (isInvalidGrant(err.status, err.gcalReason, err.message)) {
            await r.store.markNeedsReconnect(resolvedUser);
            await r.store.deleteOutbox(row.id);
            failed += 1;
            return;
          }
          if (isRateLimited(err.status, err.gcalReason) || err.status >= 500) {
            const attempts = row.attempts + 1;
            if (attempts >= GCAL_MAX_ATTEMPTS) {
              // Dead-letter: biarkan baris dengan attempts=max agar tidak di-pickup
              // lagi (listDueOutbox filter attempts<5) tapi tetap bisa diaudit.
              await r.store.markOutboxForRetry(row.id, attempts, new Date('9999-01-01T00:00:00.000Z'));
              logWarn('outbox', row.projectId, row.taskId, 'dead-letter', { op: row.op, attempts });
              failed += 1;
              return;
            }
            await r.store.markOutboxForRetry(row.id, attempts, computeNextRetry(attempts + 1, r.now()));
            return;
          }
          if (isGone(err.status) && row.op === 'delete') {
            await r.store.deleteEventMap(row.projectId, row.taskId);
            await r.store.deleteOutbox(row.id);
            succeeded += 1;
            return;
          }
        }
        logWarn('outbox', row.projectId, row.taskId, 'failed', {
          op: row.op,
          error: err instanceof Error ? err.message : String(err),
        });
        failed += 1;
      };

      try {
        const accessToken = await getValidAccessToken(resolvedUser, r);
        if (row.op === 'upsert') {
          // Upsert mencakup insert (belum ada map) dan patch (sudah ada map).
          // Coalescing + cek map menjamin anti-duplikat edit cepat beruntun.
          const existing = await r.store.getEventMap(row.projectId, row.taskId);
          const body = taskToEvent(task, row.projectId);
          if (!body) {
            // Tanggal dihapus saat antre → konversi menjadi delete.
            if (existing) {
              await deleteGcalEvent({ calendarId: existing.calendarId, eventId: existing.eventId, accessToken, fetchImpl: r.fetchImpl });
              await r.store.deleteEventMap(row.projectId, row.taskId);
            }
            await r.store.deleteOutbox(row.id);
            succeeded += 1;
            return;
          }
          if (!existing) {
            const { id } = await insertGcalEvent({ calendarId, accessToken, body, fetchImpl: r.fetchImpl });
            await r.store.upsertEventMap(row.projectId, row.taskId, id, calendarId);
          } else {
            await patchGcalEvent({ calendarId: existing.calendarId, eventId: existing.eventId, accessToken, body, fetchImpl: r.fetchImpl });
            await r.store.upsertEventMap(row.projectId, row.taskId, existing.eventId, existing.calendarId);
          }
          await r.store.deleteOutbox(row.id);
          succeeded += 1;
        } else {
          const existing = await r.store.getEventMap(row.projectId, row.taskId);
          if (existing) {
            try {
              await deleteGcalEvent({ calendarId: existing.calendarId, eventId: existing.eventId, accessToken, fetchImpl: r.fetchImpl });
            } catch (err) {
              if (err instanceof GcalApiError && isGone(err.status)) {
                // Sudah hilang di Google → anggap sukses.
              } else {
                throw err;
              }
            }
            await r.store.deleteEventMap(row.projectId, row.taskId);
          }
          await r.store.deleteOutbox(row.id);
          succeeded += 1;
        }
      } catch (err) {
        await failOrRetry(err);
      }
    });
  }

  return { processed: rows.length, succeeded, failed, pending: rows.length - succeeded - failed };
}

/**
 * Helper fire-and-forget untuk hook entity-router: tidak pernah melempar ke
 * jalur HTTP (gagal sync → outbox / log, bukan 500 ke user).
 */
export function fireGcalSync(promise: Promise<SyncResult>, ctx: { op: string; projectId: string; taskId: string }): void {
  void promise.catch((err: unknown) => {
    logger.warn(`gcal sync ${ctx.op} background failed`, {
      projectId: ctx.projectId,
      taskId: ctx.taskId,
      op: ctx.op,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
