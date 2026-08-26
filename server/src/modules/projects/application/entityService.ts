import { ApiError } from '../../../shared/errors.js';
import { pool } from '../../../db/pool.js';
import { stateSchema, type State } from '../domain/state.js';
import { assertWrite, type TeamRole } from '../../authorization/application/authz.js';
import {
  insertActivity,
  pruneActivity,
  type ActivityDraft,
  type ActivityEntry,
} from '../../activity/application/activity.js';
import { broadcastActivity } from '../../realtime/infrastructure/broadcast.js';

/**
 * Mutasi state project dalam satu transaksi dengan pessimistic lock
 * (SELECT ... FOR UPDATE) — jalur granular v1. Validasi otoritas, If-Match,
 * integrity state, dan catatan activity dilakukan di sini.
 */
export async function mutateProject(
  userId: string,
  projectId: string,
  ifMatch: string | undefined,
  fn: (state: State) => ActivityDraft | void,
): Promise<{ version: number; state: State }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ data: unknown; version: number; role: string; status: string }>(
      `SELECT p.data, p.version, p.status, tm.role
       FROM projects p
       JOIN team_members tm ON tm.team_id = p.team_id
       WHERE p.id = $1 AND tm.user_id = $2
       FOR UPDATE`,
      [projectId, userId],
    );
    const row = result.rows[0];
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    assertWrite(row.role as TeamRole);
    if (row.status === 'archived') {
      throw new ApiError(403, 'ARCHIVED', 'Project is archived — restore to edit');
    }
    if (ifMatch !== undefined && String(row.version) !== ifMatch) {
      throw new ApiError(
        409,
        'CONFLICT',
        'The project was modified by someone else. Reload to see the latest version.',
        { current: { version: row.version } },
      );
    }
    const parsed = stateSchema.safeParse(row.data);
    if (!parsed.success) throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
    const state = parsed.data;
    const activity = fn(state);
    const after = stateSchema.safeParse(state);
    if (!after.success) {
      throw new ApiError(400, 'BAD_REQUEST', 'Mutation would violate state limits', {
        issues: after.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const updated = await client.query<{ version: number }>(
      'UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1 RETURNING version',
      [projectId, JSON.stringify(state)],
    );
    let activityEntry: ActivityEntry | null = null;
    if (activity) {
      const authorResult = await client.query<{ displayName: string }>(
        'SELECT display_name AS "displayName" FROM users WHERE id = $1',
        [userId],
      );
      const authorName = authorResult.rows[0]?.displayName ?? '';
      activityEntry = await insertActivity(client, {
        projectId,
        draft: activity,
        authorId: userId,
        authorName,
      });
      await pruneActivity(client, projectId);
    }
    await client.query('COMMIT');
    const version = updated.rows[0]?.version;
    if (!version) throw new ApiError(500, 'INTERNAL', 'Failed to persist state');
    if (activityEntry) broadcastActivity(projectId, activityEntry);
    return { version, state };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}