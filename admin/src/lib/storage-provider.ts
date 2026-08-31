import { api, type EntityResult, type GranularEntity } from './api';
import type { State } from './types';

/**
 * Persistence abstraction for project state.
 *
 * `ProjectProvider` talks exclusively to a `StorageProvider`; the default
 * implementation is the REST API (`apiProvider`). Future providers (e.g.
 * IndexedDB for offline/sync, roadmap Phase 3) implement the same surface
 * with zero changes in the UI layer.
 *
 * Error contract: implementations reject with an error exposing
 * `{ message, status?, details? }`. Consumers treat `status === 409` as an
 * optimistic-lock conflict; `details.current.version` carries the server's
 * latest version.
 */
export interface StorageProvider {
  loadState(projectId: string): Promise<{ state: State; version: number }>;
  createEntity(
    projectId: string,
    entity: GranularEntity,
    payload: Record<string, unknown>,
  ): Promise<EntityResult>;
  updateEntity(
    projectId: string,
    entity: GranularEntity,
    entityId: string,
    payload: Record<string, unknown>,
    version?: number,
    keepalive?: boolean,
  ): Promise<EntityResult>;
  deleteEntity(
    projectId: string,
    entity: GranularEntity,
    entityId: string,
    version?: number,
    keepalive?: boolean,
  ): Promise<{ ok: true; version: number }>;
}

/**
 * A pending granular mutation. `key` is `${entity}:${entityId}` and doubles as
 * the coalescing key in `ProjectProvider`'s in-memory queue and in the
 * IndexedDB journal.
 */
export interface PendingMutation {
  key: string;
  entity: GranularEntity;
  op: 'create' | 'update' | 'delete';
  id: string;
  payload?: Record<string, unknown>;
}

/**
 * Optional persistence surface for the pending-mutation queue. Providers
 * implementing it survive page reloads: `ProjectProvider` hydrates its
 * in-memory queue from `listPendingMutations` on mount and journals every
 * dispatched mutation via `enqueuePendingMutation`.
 */
export interface QueuedStorageProvider extends StorageProvider {
  listPendingMutations(projectId: string): Promise<PendingMutation[]>;
  enqueuePendingMutation(projectId: string, mutation: PendingMutation): Promise<void>;
  removePendingMutation(projectId: string, mutationKey: string): Promise<void>;
  clearPendingMutations(projectId: string): Promise<void>;
}

export function isQueuedStorageProvider(provider: StorageProvider): provider is QueuedStorageProvider {
  return (
    typeof (provider as QueuedStorageProvider).listPendingMutations === 'function' &&
    typeof (provider as QueuedStorageProvider).enqueuePendingMutation === 'function'
  );
}

export const apiProvider: StorageProvider = {
  loadState: (projectId) => api.getState(projectId),
  createEntity: (projectId, entity, payload) => api.createEntity(projectId, entity, payload),
  updateEntity: (projectId, entity, entityId, payload, version, keepalive) =>
    api.patchEntity(projectId, entity, entityId, payload, version, keepalive),
  deleteEntity: (projectId, entity, entityId, version, keepalive) =>
    api.deleteEntity(projectId, entity, entityId, version, keepalive),
};
