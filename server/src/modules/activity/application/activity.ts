import type { Pool, PoolClient } from 'pg';
import type { State } from '../../projects/domain/state.js';
import { newId } from '../../../shared/ids.js';

export type ActivityAction = 'created' | 'updated' | 'deleted';

export interface ActivityDraft {
  entity: string;
  entityId: string;
  action: ActivityAction;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface ActivityEntry {
  id: string;
  projectId: string;
  entity: string;
  entityId: string;
  action: ActivityAction;
  authorId: string | null;
  authorName: string;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

export const ACTIVITY_PER_PROJECT = 500;
export const ACTIVITY_PER_ENTITY = 50;
export const ACTIVITY_CLUSTER_MS = 60_000;
const VALUE_MAX_LEN = 2000;
const LONG_VALUE_MAX_LEN = 5000;
const LONG_VALUE_FIELDS = new Set(["description","reproduction","notes","steps","expected","context","decision","consequences","changelog","body","purpose","goals","features","scope","outOfScope"]);

const ENTITY_LABELS: Record<string, string> = {
  tasks: 'Task',
  issues: 'Issue',
  testCases: 'Test case',
  techEntries: 'Tech entry',
  tables: 'Table',
  relations: 'Relation',
  schemaVersions: 'Schema version',
  decisions: 'Decision',
  milestones: 'Milestone',
  apiCollections: 'API collection',
  apiEndpoints: 'API endpoint',
  whiteboards: 'Whiteboard',
};

/**
 * Entities whose diffed array fields should be recorded as element counts
 * instead of raw (truncated) JSON — avoids noisy 300-char dumps in activity.
 */
const COUNT_DIFF_FIELDS: Record<string, string[]> = {
  whiteboards: ['elements'],
};

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

const STATE_COLLECTIONS: (keyof State)[] = [
  'tasks',
  'issues',
  'testCases',
  'techEntries',
  'tables',
  'relations',
  'schemaVersions',
  'decisions',
  'milestones',
  'apiCollections',
  'apiEndpoints',
  'whiteboards',
];

export { STATE_COLLECTIONS };

type StateRow = Record<string, unknown> & { id: string };

/**
 * Derives per-entity activity drafts by diffing two full project states
 * (used by the MCP `saveState` path, which writes the whole state at once).
 * Summaries match the REST entity-router drafts exactly; `updated` drafts
 * whose field diff is empty (e.g. only an `updatedAt` bump) are skipped.
 */
export function diffStateDrafts(before: State, after: State): ActivityDraft[] {
  const drafts: ActivityDraft[] = [];
  for (const entity of STATE_COLLECTIONS) {
    const prevItems = (before[entity] as unknown as StateRow[] | undefined) ?? [];
    const nextItems = (after[entity] as unknown as StateRow[] | undefined) ?? [];
    const prevById = new Map(prevItems.map((i) => [i.id, i]));
    const nextById = new Map(nextItems.map((i) => [i.id, i]));
    for (const [id, item] of nextById) {
      if (!prevById.has(id)) {
        drafts.push({
          entity,
          entityId: id,
          action: 'created',
          summary: entitySummary(entity, item),
          after: item,
        });
      }
    }
    for (const [id, item] of prevById) {
      if (!nextById.has(id)) {
        drafts.push({
          entity,
          entityId: id,
          action: 'deleted',
          summary: entitySummary(entity, item),
          before: item,
        });
      }
    }
    for (const [id, prev] of prevById) {
      const next = nextById.get(id);
      if (!next) continue;
      if (JSON.stringify(prev) === JSON.stringify(next)) continue;
      if (Object.keys(diffEntities(prev, next, entity)).length === 0) continue;
      drafts.push({
        entity,
        entityId: id,
        action: 'updated',
        summary: entitySummary(entity, prev, prev, next),
        before: prev,
        after: next,
      });
    }
  }
  return drafts;
}

function fieldCount(entity: string, key: string, value: unknown): number | null {
  if (!COUNT_DIFF_FIELDS[entity]?.includes(key)) return null;
  return Array.isArray(value) ? value.length : 0;
}

export function entitySummary(
  entity: string,
  row: Record<string, unknown> | undefined,
  before?: Record<string, unknown> | undefined,
  after?: Record<string, unknown> | undefined,
): string {
  if (!row) return entityLabel(entity);
  const title =
    typeof row.title === 'string' && row.title
      ? row.title
      : typeof row.name === 'string' && row.name
        ? row.name
        : typeof row.version === 'string' && row.version
          ? `v${row.version}`
          : '';
  let summary = title ? String(title) : entityLabel(entity);
  if (before && after) {
    for (const key of COUNT_DIFF_FIELDS[entity] ?? []) {
      const from = fieldCount(entity, key, before[key]);
      const to = fieldCount(entity, key, after[key]);
      if (from !== null && from !== to) {
        summary += `, ${key}: ${from} → ${to}`;
      }
    }
  }
  return summary;
}

function truncate(value: unknown, field?: string): unknown {
  const limit = field && LONG_VALUE_FIELDS.has(field) ? LONG_VALUE_MAX_LEN : VALUE_MAX_LEN;
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v))
      .join(", ")
      .slice(0, limit);
  }
  if (typeof value === "string" && value.length > limit) {
    return `${value.slice(0, limit)}…`;
  }
  return value;
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return value;
}

const SKIP_FIELDS = new Set(['id', 'createdAt', 'updatedAt']);

export function diffEntities(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  entity?: string,
): Record<string, { from: unknown; to: unknown }> {
  if (!before || !after) return {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (SKIP_FIELDS.has(key)) continue;
    const a = before[key];
    const b = after[key];
    if (normalize(a) === normalize(b)) continue;
    const from = fieldCount(entity ?? '', key, a);
    const to = fieldCount(entity ?? '', key, b);
    changes[key] = from !== null ? { from, to } : { from: truncate(a, key), to: truncate(b, key) };
  }
  return changes;
}

interface ClusterCandidate {
  id: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

export async function insertActivity(
  client: PoolClient,
  params: {
    projectId: string;
    draft: ActivityDraft;
    authorId: string | null;
    authorName: string;
  },
): Promise<ActivityEntry | null> {
  const { projectId, draft, authorId, authorName } = params;
  const changes = diffEntities(draft.before, draft.after, draft.entity);
  const now = new Date();

  if (draft.action === 'updated') {
    const result = await client.query<ClusterCandidate>(
      `SELECT id, changes, created_at AS "createdAt"
       FROM activity_log
       WHERE project_id = $1 AND entity = $2 AND entity_id = $3
         AND action = 'updated' AND author_id IS NOT DISTINCT FROM $4
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId, draft.entity, draft.entityId, authorId],
    );
    const last = result.rows[0];
    if (last && now.getTime() - new Date(last.createdAt).getTime() <= ACTIVITY_CLUSTER_MS) {
      const merged: Record<string, { from: unknown; to: unknown }> = { ...last.changes };
      for (const [field, change] of Object.entries(changes)) {
        merged[field] = {
          from: merged[field]?.from ?? change.from,
          to: change.to,
        };
      }
      await client.query(
        'UPDATE activity_log SET changes = $2::jsonb, created_at = now() WHERE id = $1',
        [last.id, JSON.stringify(merged)],
      );
      return {
        id: last.id,
        projectId,
        entity: draft.entity,
        entityId: draft.entityId,
        action: draft.action,
        authorId,
        authorName,
        summary: draft.summary,
        changes: merged,
        createdAt: now.toISOString(),
      };
    }
  }

  const id = newId();
  await client.query(
    `INSERT INTO activity_log (id, project_id, entity, entity_id, action, author_id, author_name, summary, changes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      id,
      projectId,
      draft.entity,
      draft.entityId,
      draft.action,
      authorId,
      authorName,
      draft.summary,
      JSON.stringify(changes),
    ],
  );
  return {
    id,
    projectId,
    entity: draft.entity,
    entityId: draft.entityId,
    action: draft.action,
    authorId,
    authorName,
    summary: draft.summary,
    changes,
    createdAt: now.toISOString(),
  };
}

export async function pruneActivity(client: PoolClient, projectId: string): Promise<void> {
  await client.query(
    `DELETE FROM activity_log
     WHERE id IN (
       SELECT id FROM (
         SELECT id,
                ROW_NUMBER() OVER (PARTITION BY entity, entity_id ORDER BY created_at DESC) AS rn_entity,
                ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn_project
         FROM activity_log
         WHERE project_id = $1
       ) ranked
       WHERE rn_entity > $2 OR rn_project > $3
     )`,
    [projectId, ACTIVITY_PER_ENTITY, ACTIVITY_PER_PROJECT],
  );
}

/**
 * Catat aktivitas diff (before → after) dalam satu transaksi, termasuk prune.
 * Dipakai jalur REST legacy (put /state, import) — setara MCP diffStateDrafts
 * (audit 2026-08b, REST-5).
 */
export async function recordActivity(
  pool: Pool,
  projectId: string,
  userId: string,
  before: State,
  after: State,
): Promise<void> {
  const drafts = diffStateDrafts(before, after);
  if (drafts.length === 0) return;
  const authorResult = await pool.query<{ displayName: string }>(
    'SELECT display_name AS "displayName" FROM users WHERE id = $1',
    [userId],
  );
  const authorName = authorResult.rows[0]?.displayName ?? '';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const draft of drafts) {
      await insertActivity(client, { projectId, draft, authorId: userId, authorName });
    }
    await pruneActivity(client, projectId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
