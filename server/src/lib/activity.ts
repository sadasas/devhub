import type { PoolClient } from 'pg';
import { newId } from './ids.js';

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
const VALUE_MAX_LEN = 300;

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
};

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

export function entitySummary(entity: string, row: Record<string, unknown> | undefined): string {
  if (!row) return entityLabel(entity);
  const title =
    typeof row.title === 'string' && row.title
      ? row.title
      : typeof row.name === 'string' && row.name
        ? row.name
        : typeof row.version === 'string' && row.version
          ? `v${row.version}`
          : '';
  return title ? String(title) : entityLabel(entity);
}

function truncate(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v))
      .join(', ')
      .slice(0, VALUE_MAX_LEN);
  }
  if (typeof value === 'string' && value.length > VALUE_MAX_LEN) {
    return `${value.slice(0, VALUE_MAX_LEN)}…`;
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
): Record<string, { from: unknown; to: unknown }> {
  if (!before || !after) return {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (SKIP_FIELDS.has(key)) continue;
    const a = before[key];
    const b = after[key];
    if (normalize(a) === normalize(b)) continue;
    changes[key] = { from: truncate(a), to: truncate(b) };
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
): Promise<void> {
  const { projectId, draft, authorId, authorName } = params;
  const changes = diffEntities(draft.before, draft.after);
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
      return;
    }
  }

  await client.query(
    `INSERT INTO activity_log (id, project_id, entity, entity_id, action, author_id, author_name, summary, changes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      newId(),
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
