import { pool } from '../../../db/pool.js';
import { ApiError } from '../../../shared/errors.js';

export interface PlatformStats {
  users: number;
  teams: number;
  projects: number;
  activeKeys: number;
  activity24h: number;
  activity7d: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  teamCount: number;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface AdminTeam {
  id: string;
  name: string;
  ownerEmail: string | null;
  memberCount: number;
  projectCount: number;
  createdAt: string;
}

export interface AdminActivityEntry {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  authorName: string;
  summary: string;
  projectId: string;
  projectName: string;
  createdAt: string;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const result = await pool.query<PlatformStats>(`
    SELECT
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM teams)::int AS teams,
      (SELECT count(*) FROM projects)::int AS projects,
      (SELECT count(*) FROM mcp_keys WHERE revoked_at IS NULL)::int AS "activeKeys",
      (SELECT count(*) FROM activity_log WHERE created_at >= now() - interval '24 hours')::int AS "activity24h",
      (SELECT count(*) FROM activity_log WHERE created_at >= now() - interval '7 days')::int AS "activity7d"
  `);
  const row = result.rows[0];
  if (!row) throw new ApiError(500, 'INTERNAL', 'Failed to compute platform stats');
  return row;
}

const USER_FILTER = `($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')`;

export async function listPlatformUsers(
  query: string,
  limit: number,
  offset: number,
): Promise<{ users: AdminUser[]; total: number }> {
  const [list, total] = await Promise.all([
    pool.query<AdminUser>(
      `SELECT u.id, u.email, u.display_name AS "displayName", u.role, u.created_at AS "createdAt",
              (SELECT count(*)::int FROM team_members tm WHERE tm.user_id = u.id) AS "teamCount",
              (SELECT max(a.created_at) FROM activity_log a WHERE a.author_id = u.id) AS "lastActiveAt"
       FROM users u
       WHERE ${USER_FILTER}
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [query, limit, offset],
    ),
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM users u WHERE ${USER_FILTER}`,
      [query],
    ),
  ]);
  return { users: list.rows, total: total.rows[0]?.total ?? 0 };
}

export async function setUserRole(
  actorId: string,
  targetUserId: string,
  role: 'user' | 'admin',
): Promise<{ id: string; email: string; role: string }> {
  if (actorId === targetUserId && role === 'user') {
    throw new ApiError(409, 'CONFLICT', 'You cannot demote yourself');
  }
  const result = await pool.query<{ id: string; email: string; role: string }>(
    `UPDATE users SET role = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, email, role`,
    [targetUserId, role],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return row;
}

export async function listPlatformTeams(limit: number): Promise<{ teams: AdminTeam[] }> {
  const result = await pool.query<AdminTeam>(
    `SELECT t.id, t.name, t.created_at AS "createdAt",
            (SELECT count(*)::int FROM team_members tm WHERE tm.team_id = t.id) AS "memberCount",
            (SELECT count(*)::int FROM projects p WHERE p.team_id = t.id) AS "projectCount",
            (SELECT u.email FROM team_members tm JOIN users u ON u.id = tm.user_id
             WHERE tm.team_id = t.id AND tm.role = 'owner' LIMIT 1) AS "ownerEmail"
     FROM teams t
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return { teams: result.rows };
}

export async function listRecentActivity(limit: number): Promise<{ activity: AdminActivityEntry[] }> {
  const result = await pool.query<AdminActivityEntry>(
    `SELECT a.id, a.entity, a.entity_id AS "entityId", a.action,
            a.author_name AS "authorName", a.summary,
            a.project_id AS "projectId", p.name AS "projectName",
            a.created_at AS "createdAt"
     FROM activity_log a
     JOIN projects p ON p.id = a.project_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return { activity: result.rows };
}
