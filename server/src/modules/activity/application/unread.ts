import { pool } from '../../../db/pool.js';

/**
 * Unread badge server-side (ADR M32): watermark baca per user/project/tab
 * disimpan di tab_read_watermarks (pola team_message_reads), hitungan via
 * agregasi SQL terhadap activity_log — akurat penuh dalam retensi log.
 */

/** Key khusus untuk dismissedUntil banner deleted (bukan tab sungguhan). */
export const DISMISS_KEY = '__deleted_dismiss__';

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

export const READABLE_TABS = [
  'board',
  'issues',
  'tests',
  'stack',
  'schema',
  'decisions',
  'releases',
  'api',
  'whiteboard',
  DISMISS_KEY,
] as const;

export interface UnreadDeletedEntry {
  id: string;
  entity: string;
  entityId: string;
  authorName: string;
  summary: string;
  createdAt: string;
}

export interface UnreadSummary {
  counts: Record<string, number>;
  ids: Record<string, string[]>;
  deleted: UnreadDeletedEntry[];
  watermarks: Record<string, string>;
}

const MAP_VALUES = Object.entries(ENTITY_TAB)
  .map(([entity, tab]) => `('${entity}', '${tab}')`)
  .join(', ');

interface CountRow {
  tab: string;
  count: number;
}
interface IdRow {
  entity: string;
  entity_id: string;
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
       SELECT m.tab AS tab, count(*)::int AS count
       FROM activity_log a
       JOIN map m ON m.entity = a.entity
       LEFT JOIN tab_read_watermarks w
              ON w.user_id = $2 AND w.project_id = a.project_id AND w.tab = m.tab
       WHERE a.project_id = $1
         AND a.created_at > COALESCE(w.last_read, 'epoch'::timestamptz)
       GROUP BY m.tab`,
      [projectId, userId],
    ),
    pool.query<IdRow>(
      `WITH map(entity, tab) AS (VALUES ${MAP_VALUES})
       SELECT a.entity AS entity, a.entity_id AS entity_id, max(a.created_at) AS latest
       FROM activity_log a
       JOIN map m ON m.entity = a.entity
       LEFT JOIN tab_read_watermarks w
              ON w.user_id = $2 AND w.project_id = a.project_id AND w.tab = m.tab
       WHERE a.project_id = $1
         AND a.created_at > COALESCE(w.last_read, 'epoch'::timestamptz)
       GROUP BY a.entity, a.entity_id
       ORDER BY latest DESC`,
      [projectId, userId],
    ),
    pool.query<UnreadDeletedEntry>(
      `SELECT id, entity, entity_id AS "entityId", author_name AS "authorName", summary,
              created_at AS "createdAt"
       FROM activity_log
       WHERE project_id = $1 AND action = 'deleted'
       ORDER BY created_at DESC
       LIMIT ${DELETED_LIMIT}`,
      [projectId],
    ),
    getWatermarks(userId, projectId),
  ]);

  const counts: Record<string, number> = {};
  for (const r of countsRes.rows) counts[r.tab] = r.count;

  // Kunci ids per TAB (bukan per entity) agar kontrak klien tidak berubah;
  // baris sudah terurut latest DESC → ambil IDS_PER_ENTITY teratas per tab.
  const idsByTab: Record<string, string[]> = {};
  for (const r of idsRes.rows) {
    const tab = ENTITY_TAB[r.entity];
    if (!tab) continue;
    const list = (idsByTab[tab] ??= []);
    if (list.length < IDS_PER_ENTITY) list.push(r.entity_id);
  }

  return { counts, ids: idsByTab, deleted: deletedRes.rows, watermarks: marks };
}
