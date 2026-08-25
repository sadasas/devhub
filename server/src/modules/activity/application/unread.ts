import { pool } from '../../../db/pool.js';

/**
 * Unread badge server-side (ADR M32 — revisi M38): watermark baca per user/project/tab
 * disimpan di tab_read_watermarks, hitungan via agregasi SQL terhadap activity_log.
 * M38: hanya hitung `created` (new) & `deleted`, `updated` diabaikan; banner deleted per tab.
 */

/** Key khusus untuk dismissedUntil banner deleted — sekarang per tab. */
export const DISMISS_KEY = '__deleted_dismiss__';
export const DISMISS_PREFIX = '__deleted_dismiss__:';

export function dismissKeyForTab(tab: string): string {
  return `${DISMISS_PREFIX}${tab}`;
}

const IDS_PER_ENTITY = 100;
const DELETED_LIMIT = 20;

/** Mirror dari app/src/lib/deep-link.ts ENTITY_TAB — jaga sinkron. */
const ENTITY_TAB: Record<string, string> = {
  tasks: 'board',
  issues: 'issues',
  testCases: 'tests',
  techEntries: 'stack',
  tables: 'schema',
  relations: 'schema',
  schemaVersions: 'schema',
  decisions: 'decisions',
  milestones: 'releases',
  apiCollections: 'api',
  apiEndpoints: 'api',
  whiteboards: 'whiteboard',
};

const BASE_TABS = [
  'board',
  'issues',
  'tests',
  'stack',
  'schema',
  'decisions',
  'releases',
  'api',
  'whiteboard',
] as const;

export const READABLE_TABS = [
  ...BASE_TABS,
  DISMISS_KEY,
  ...BASE_TABS.map((t) => dismissKeyForTab(t)),
] as const;

export interface UnreadDeletedEntry {
  id: string;
  entity: string;
  entityId: string;
  authorName: string;
  summary: string;
  createdAt: string;
  tab: string;
}

export interface UnreadCounts {
  new: number;
  deleted: number;
  total: number;
}

export interface UnreadIds {
  new: string[];
  deleted: string[];
}

export interface UnreadSummary {
  counts: Record<string, UnreadCounts>;
  ids: Record<string, UnreadIds>;
  deleted: UnreadDeletedEntry[];
  watermarks: Record<string, string>;
}

const MAP_VALUES = Object.entries(ENTITY_TAB)
  .map(([entity, tab]) => `('${entity}', '${tab}')`)
  .join(', ');

interface CountRow {
  tab: string;
  new_count: number;
  deleted_count: number;
  total: number;
}
interface IdRow {
  entity: string;
  entity_id: string;
  action: string;
  latest: Date;
}

export async function getWatermarks(
  userId: string,
  projectId: string,
): Promise<Record<string, string>> {
  const res = await pool.query<{ tab: string; last_read: Date }>(
    'SELECT tab, last_read FROM tab_read_watermarks WHERE user_id = $1 AND project_id = $2',
    [userId, projectId],
  );
  const out: Record<string, string> = {};
  for (const r of res.rows) out[r.tab] = r.last_read.toISOString();
  return out;
}

export async function setWatermark(userId: string, projectId: string, tab: string): Promise<void> {
  await pool.query(
    `INSERT INTO tab_read_watermarks (user_id, project_id, tab, last_read)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, project_id, tab) DO UPDATE SET last_read = now()`,
    [userId, projectId, tab],
  );
}

export async function getUnreadSummary(userId: string, projectId: string): Promise<UnreadSummary> {
  const [countsRes, idsRes, deletedRes, marks] = await Promise.all([
    pool.query<CountRow>(
      `WITH map(entity, tab) AS (VALUES ${MAP_VALUES})
       SELECT m.tab AS tab,
              count(*) FILTER (WHERE a.action = 'created')::int AS new_count,
              count(*) FILTER (WHERE a.action = 'deleted')::int AS deleted_count,
              count(*) FILTER (WHERE a.action IN ('created','deleted'))::int AS total
       FROM activity_log a
       JOIN map m ON m.entity = a.entity
       LEFT JOIN tab_read_watermarks w
              ON w.user_id = $2 AND w.project_id = a.project_id AND w.tab = m.tab
       WHERE a.project_id = $1
         AND a.action IN ('created','deleted')
         AND a.created_at > COALESCE(w.last_read, 'epoch'::timestamptz)
       GROUP BY m.tab`,
      [projectId, userId],
    ),
    pool.query<IdRow>(
      `WITH map(entity, tab) AS (VALUES ${MAP_VALUES})
       SELECT a.entity AS entity, a.entity_id AS entity_id, a.action AS action, max(a.created_at) AS latest
       FROM activity_log a
       JOIN map m ON m.entity = a.entity
       LEFT JOIN tab_read_watermarks w
              ON w.user_id = $2 AND w.project_id = a.project_id AND w.tab = m.tab
       WHERE a.project_id = $1
         AND a.action IN ('created','deleted')
         AND a.created_at > COALESCE(w.last_read, 'epoch'::timestamptz)
       GROUP BY a.entity, a.entity_id, a.action
       ORDER BY latest DESC`,
      [projectId, userId],
    ),
    pool.query<UnreadDeletedEntry>(
      `WITH map(entity, tab) AS (VALUES ${MAP_VALUES})
       SELECT a.id AS id, a.entity AS entity, a.entity_id AS "entityId", a.author_name AS "authorName", a.summary AS summary,
              a.created_at AS "createdAt", m.tab AS tab
       FROM activity_log a
       JOIN map m ON m.entity = a.entity
       WHERE a.project_id = $1 AND a.action = 'deleted'
       ORDER BY a.created_at DESC
       LIMIT ${DELETED_LIMIT}`,
      [projectId],
    ),
    getWatermarks(userId, projectId),
  ]);

  const counts: Record<string, UnreadCounts> = {};
  for (const r of countsRes.rows) {
    counts[r.tab] = { new: r.new_count, deleted: r.deleted_count, total: r.total };
  }

  const idsByTab: Record<string, UnreadIds> = {};
  for (const r of idsRes.rows) {
    const tab = ENTITY_TAB[r.entity];
    if (!tab) continue;
    const bucket = (idsByTab[tab] ??= { new: [], deleted: [] });
    if (r.action === 'created' && bucket.new.length < IDS_PER_ENTITY) bucket.new.push(r.entity_id);
    else if (r.action === 'deleted' && bucket.deleted.length < IDS_PER_ENTITY) bucket.deleted.push(r.entity_id);
  }

  return { counts, ids: idsByTab, deleted: deletedRes.rows, watermarks: marks };
}
