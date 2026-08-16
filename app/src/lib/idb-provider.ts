import { ApiError } from './api';
import {
  apiProvider,
  type PendingMutation,
  type QueuedStorageProvider,
  type StorageProvider,
} from './storage-provider';
import {
  clearQueuedMutations,
  deleteQueuedMutation,
  getCachedProject,
  getQueuedMutations,
  putCachedProject,
  putQueuedMutation,
} from './idb';

/**
 * A `StorageProvider` that layers an IndexedDB offline cache and a persisted
 * pending-mutation queue over an inner provider (default: the REST API).
 *
 * - `loadState` is network-first: it serves the inner provider, writing a
 *   snapshot to the cache on success; on a network error it falls back to the
 *   last cached snapshot. Non-network errors (401/403/404/409...) propagate.
 * - Entity writes are journaled to IndexedDB before delegating to the inner
 *   provider; the journal entry is removed only on success, so mutations
 *   survive reloads and replay via `ProjectProvider`'s existing flush
 *   pipeline (queue hydrated from `listPendingMutations` on mount).
 *
 * All IndexedDB operations are best-effort: failures are swallowed so the
 * provider degrades gracefully to the inner provider's behavior.
 */
export function offlineProvider(inner: StorageProvider = apiProvider): QueuedStorageProvider {
  return {
    async loadState(projectId) {
      try {
        const result = await inner.loadState(projectId);
        await putCachedProject(projectId, result.state, result.version).catch(() => {});
        return result;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        const cached = await getCachedProject(projectId).catch(() => undefined);
        if (!cached) throw err;
        return { state: cached.state, version: cached.version };
      }
    },

    async createEntity(projectId, entity, payload) {
      const id = typeof payload.id === 'string' ? payload.id : '';
      return runWithJournal(
        projectId,
        { key: `${entity}:${id}`, entity, op: 'create', id, payload },
        () => inner.createEntity(projectId, entity, payload),
      );
    },

    async updateEntity(projectId, entity, entityId, payload, version, keepalive) {
      return runWithJournal(
        projectId,
        { key: `${entity}:${entityId}`, entity, op: 'update', id: entityId, payload },
        () => inner.updateEntity(projectId, entity, entityId, payload, version, keepalive),
      );
    },

    async deleteEntity(projectId, entity, entityId, version, keepalive) {
      return runWithJournal(
        projectId,
        { key: `${entity}:${entityId}`, entity, op: 'delete', id: entityId },
        () => inner.deleteEntity(projectId, entity, entityId, version, keepalive),
      );
    },

    async listPendingMutations(projectId) {
      const records = await getQueuedMutations(projectId);
      return records.map((r) => r.mutation);
    },

    enqueuePendingMutation: (projectId, mutation) => putQueuedMutation(projectId, mutation),

    removePendingMutation: (projectId, mutationKey) => deleteQueuedMutation(projectId, mutationKey),

    clearPendingMutations: (projectId) => clearQueuedMutations(projectId),
  };
}

/** Network-level failures are `ApiError` with `status 0` (fetch abort/timeout). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

async function runWithJournal<T>(
  projectId: string,
  mutation: PendingMutation,
  run: () => Promise<T>,
): Promise<T> {
  await putQueuedMutation(projectId, mutation).catch(() => {});
  const result = await run();
  await deleteQueuedMutation(projectId, mutation.key).catch(() => {});
  return result;
}
