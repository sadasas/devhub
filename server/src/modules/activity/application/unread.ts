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

export interface BatchUnreadSummary {
  summaries: Record<string, UnreadSummary>;
}

interface BatchCountRow extends CountRow {
  project_id: string;
}
interface BatchIdRow extends IdRow {
  project_id: string;
}
interface BatchDeletedRow extends UnreadDeletedEntry {
  project_id: string;
}

export async function getUnreadSummariesBatch(
  userId: string,
  projectIds: string[],
): Promise<Record<string, UnreadSummary>> {
  if (projectIds.length === 0) return {};
  const uniqueIds = [...new Set(projectIds)];
  const [countsRes, idsRes, deletedRes, marksRes] = await Promise.all([
    pool.query<BatchCountRow>(
      `WITH map(entity, tab) AS (VALUES ${MAP_VALUES})
       SELECT a.project_id::text AS project_id, m.tab AS tab,
              count(*) FILTER (WHERE a.action = 'created')::int AS new_count,
              count(*) FILTER (WHERE a.action = 'deleted')::int AS deleted_count,
              count(*) FILTER (WHERE a.action IN ('created','deleted'))::int AS total
       FROM activity_log a
       JOIN map m ON m.entity = a.entity
       LEFT JOIN tab_read_watermarks w
              ON w.user_id = $2 AND w.project_id = a.project_id AND w.tab = m.tab
       WHERE a.project_id = ANY($1::uuid[])
         AND a.action IN ('created','deleted')
         AND a.created_at > COALESCE(w.last_read, 'epoch'::timestamptz)
       GROUP BY a.project_id, m.tab`,
      [uniqueIds, userId],
    ),
    pool.query<BatchIdRow>(
      `WITH map(entity, tab) AS (VALUES ${MAP_VALUES})
       SELECT a.project_id::text AS project_id, a.entity AS entity, a.entity_id AS entity_id, a.action AS action, max(a.created_at) AS latest
       FROM activity_log a
       JOIN map m ON m.entity = a.entity
       LEFT JOIN tab_read_watermarks w
              ON w.user_id = $2 AND w.project_id = a.project_id AND w.tab = m.tab
       WHERE a.project_id = ANY($1::uuid[])
         AND a.action IN ('created','deleted')
         AND a.created_at > COALESCE(w.last_read, 'epoch'::timestamptz)
       GROUP BY a.project_id, a.entity, a.entity_id, a.action
       ORDER BY latest DESC`,
      [uniqueIds, userId],
    ),
    pool.query<BatchDeletedRow>(
      `WITH map(entity, tab) AS (VALUES ${MAP_VALUES}),
            ranked AS (
              SELECT a.project_id::text AS project_id, a.id AS id, a.entity AS entity, a.entity_id AS "entityId", a.author_name AS "authorName", a.summary AS summary,
                     a.created_at AS "createdAt", m.tab AS tab,
                     ROW_NUMBER() OVER (PARTITION BY a.project_id ORDER BY a.created_at DESC) AS rn
              FROM activity_log a
              JOIN map m ON m.entity = a.entity
              WHERE a.project_id = ANY($1::uuid[]) AND a.action = 'deleted'
            )
       SELECT project_id, id, entity, "entityId", "authorName", summary, "createdAt", tab FROM ranked WHERE rn <= ${DELETED_LIMIT} ORDER BY "createdAt" DESC`,
      [uniqueIds],
    ),
    pool.query<{ project_id: string; tab: string; last_read: Date }>(
      'SELECT project_id::text AS project_id, tab, last_read FROM tab_read_watermarks WHERE user_id = $1 AND project_id = ANY($2::uuid[])',
      [userId, uniqueIds],
    ),
  ]);

  const byProject = new Map<string, { counts: Record<string, UnreadCounts>; ids: Record<string, UnreadIds>; deleted: UnreadDeletedEntry[]; watermarks: Record<string,string> }>();
  for (const pid of uniqueIds) {
    byProject.set(pid, { counts: {}, ids: {}, deleted: [], watermarks: {} });
  }
  for (const r of countsRes.rows) {
    const b = byProject.get(r.project_id);
    if (!b) continue;
    b.counts[r.tab] = { new: r.new_count, deleted: r.deleted_count, total: r.total };
  }
  for (const r of idsRes.rows) {
    const b = byProject.get(r.project_id);
    if (!b) continue;
    const tab = ENTITY_TAB[r.entity];
    if (!tab) continue;
    const bucket = (b.ids[tab] ??= { new: [], deleted: [] });
    if (r.action === 'created' && bucket.new.length < IDS_PER_ENTITY) bucket.new.push(r.entity_id);
    else if (r.action === 'deleted' && bucket.deleted.length < IDS_PER_ENTITY) bucket.deleted.push(r.entity_id);
  }
  const deletedByProject = new Map<string, number>();
  for (const r of deletedRes.rows) {
    const b = byProject.get(r.project_id);
    if (!b) continue;
    const cur = deletedByProject.get(r.project_id) ?? 0;
    if (cur >= DELETED_LIMIT) continue;
    const rawCreatedAt = (r as unknown as { createdAt: unknown }).createdAt;
    const createdAtIso = rawCreatedAt instanceof Date ? rawCreatedAt.toISOString() : String(rawCreatedAt);
    b.deleted.push({ id: r.id, entity: r.entity, entityId: r.entityId, authorName: r.authorName, summary: r.summary, createdAt: createdAtIso, tab: r.tab });
    deletedByProject.set(r.project_id, cur + 1);
  }
  for (const r of marksRes.rows) {
    const b = byProject.get(r.project_id);
    if (!b) continue;
    b.watermarks[r.tab] = r.last_read.toISOString();
  }
  const out: Record<string, UnreadSummary> = {};
  for (const [pid, v] of byProject) out[pid] = { counts: v.counts, ids: v.ids, deleted: v.deleted, watermarks: v.watermarks };
  return out;
}
