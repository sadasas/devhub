import { RoomRegistry } from './rooms.js';

/**
 * Bridge between HTTP write paths and the real-time room registry.
 *
 * The registry is attached once at boot (`attachRoomRegistry`) so the REST
 * layer can broadcast granular state diffs to everyone in a project room
 * without importing the WebSocket server. When no registry is attached
 * (unit tests, standalone HTTP runs) the helpers are safe no-ops.
 *
 * Protocol (consumed by the M12 client task):
 * - `state:diff` — one or more entity-level changes with the full `after`
 *   entity for created/updated ops; clients apply them without refetching.
 * - `state:sync` — coarse signal (bulk PUT /state, MCP saveState) after a
 *   whole-state write; clients should refetch the state.
 */
export interface StateDiffOp {
  entity: string;
  id: string;
  op: 'created' | 'updated' | 'deleted';
  after?: unknown;
}

export interface StateDiff {
  type: 'state:diff';
  projectId: string;
  version: number;
  ops: StateDiffOp[];
}

export interface StateSync {
  type: 'state:sync';
  projectId: string;
  version: number;
}

let registry: RoomRegistry | null = null;

export function attachRoomRegistry(rooms: RoomRegistry): void {
  registry = rooms;
}

export function broadcastDiff(projectId: string, diff: StateDiff): void {
  registry?.broadcast(`project:${projectId}`, diff);
}

export function broadcastSync(projectId: string, version: number): void {
  registry?.broadcast(`project:${projectId}`, {
    type: 'state:sync',
    projectId,
    version,
  } satisfies StateSync);
}

export function broadcastTeamMessage(teamId: string, payload: unknown): void {
  registry?.broadcast(`team:${teamId}`, payload);
}

export function broadcastActivity(projectId: string, entry: unknown): void {
  registry?.broadcast(`project:${projectId}`, {
    type: 'activity:new',
    projectId,
    entry,
  });
}
