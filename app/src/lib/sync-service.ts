import type { State } from './types';
import type { PendingMutation } from './storage-provider';

/**
 * Last-write-wins reconciliation for pending mutations against a fresh server
 * snapshot (M11 sync service).
 *
 * Policy per mutation (all entities carry `updatedAt`, ADR-009; compare ISO
 * timestamps lexicographically):
 * - `delete` — always kept; deletes are final (delete-wins).
 * - `create` — entity already exists on the server: keep local as an
 *   `update` when the local entity is strictly newer, otherwise drop it.
 *   Entity absent on the server: keep the create.
 * - `update` — keep when the local entity is strictly newer than the server
 *   entity; drop when the server is newer or equal (converge on server), or
 *   when the entity no longer exists on the server (deleted elsewhere).
 *
 * "Local entity" is resolved from `localState` (the reducer state), falling
 * back to `payload.updatedAt` for mutations whose payload carries the full
 * entity (e.g. creates). Update payloads are patches and do not carry
 * `updatedAt`, so they depend on `localState`.
 */
export function reconcileQueue(
  pending: PendingMutation[],
  serverState: State,
  localState?: State | null,
): { keep: PendingMutation[]; dropped: string[] } {
  const keep: PendingMutation[] = [];
  const dropped: string[] = [];
  const serverEntities = serverState as unknown as Record<
    string,
    Array<{ id: string; updatedAt: string }> | undefined
  >;
  const localEntities = (localState ?? undefined) as
    | Record<string, Array<{ id: string; updatedAt: string }> | undefined>
    | undefined;

  const localUpdatedAt = (mutation: PendingMutation): string | undefined => {
    const local = localEntities?.[mutation.entity]?.find((e) => e.id === mutation.id);
    const payload = mutation.payload?.updatedAt;
    return typeof local?.updatedAt === 'string'
      ? local.updatedAt
      : typeof payload === 'string'
        ? payload
        : undefined;
  };

  for (const mutation of pending) {
    if (mutation.op === 'delete') {
      keep.push(mutation);
      continue;
    }
    const serverEntity = serverEntities[mutation.entity]?.find((e) => e.id === mutation.id);
    const localUpdated = localUpdatedAt(mutation);

    if (mutation.op === 'create') {
      if (!serverEntity) {
        keep.push(mutation);
      } else if (localUpdated && localUpdated > serverEntity.updatedAt) {
        keep.push({ ...mutation, op: 'update' });
      } else {
        dropped.push(mutation.key);
      }
      continue;
    }

    if (!serverEntity || !localUpdated || localUpdated <= serverEntity.updatedAt) {
      dropped.push(mutation.key);
    } else {
      keep.push(mutation);
    }
  }

  return { keep, dropped };
}