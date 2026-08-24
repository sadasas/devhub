import { pool } from '../../../db/pool.js';
import { withTransaction } from '../../../shared/db.js';

export interface TeamListRow {
  id: string;
  name: string;
  role: string;
  plan: 'free' | 'pro';
  plan_package_name: string;
  member_count: number | string;
  created_at: Date;
  updated_at: Date;
}

export async function listTeams(userId: string): Promise<TeamListRow[]> {
  const result = await pool.query(
    `SELECT t.id, t.name, t.created_at, t.updated_at, tm.role, t.plan,
            COALESCE(cur.name, fr.name) AS plan_package_name,
            (SELECT count(*)::int FROM team_members m WHERE m.team_id = t.id) AS member_count
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id
     LEFT JOIN billing_packages cur
       ON cur.id = t.plan_package_id
       AND (t.plan_expires_at IS NULL OR t.plan_expires_at > now())
     LEFT JOIN LATERAL (
       SELECT name FROM billing_packages WHERE is_free LIMIT 1
     ) fr ON true
     WHERE tm.user_id = $1
     ORDER BY t.created_at ASC`,
    [userId],
  );
  return result.rows as TeamListRow[];
}

export interface CreatedTeam {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function insertTeamWithOwner(name: string, ownerId: string): Promise<CreatedTeam> {
  return withTransaction(pool, async (client) => {
    const inserted = await client.query<{ id: string; created_at: Date; updated_at: Date }>(
      'INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id, created_at, updated_at',
      [name, ownerId],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error('Failed to create team');
    await client.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [id, ownerId, 'owner'],
    );
    return { id, name, createdAt: inserted.rows[0]!.created_at, updatedAt: inserted.rows[0]!.updated_at };
  });
}

export async function listPendingInvitationsForEmail(email: string): Promise<Array<{
  id: string;
  team_id: string;
  role: string;
  created_at: Date;
  expires_at: Date;
  team_name: string;
}>> {
  const result = await pool.query(
    `SELECT i.id, i.team_id, i.role, i.created_at, i.expires_at, t.name AS team_name
     FROM invitations i
     JOIN teams t ON t.id = i.team_id
     WHERE i.email = $1 AND i.status = 'pending' AND i.expires_at > now()
     ORDER BY i.created_at DESC`,
    [email],
  );
  return result.rows;
}

export async function countMembers(teamId: string): Promise<number> {
  const count = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM team_members WHERE team_id = $1',
    [teamId],
  );
  return Number(count.rows[0]?.count ?? 0);
}

export async function renameTeam(teamId: string, name: string): Promise<void> {
  await pool.query('UPDATE teams SET name = $2, updated_at = now() WHERE id = $1', [teamId, name]);
}

export async function teamHasProjects(teamId: string): Promise<boolean> {
  const hasProjects = await pool.query('SELECT 1 AS id FROM projects WHERE team_id = $1 LIMIT 1', [teamId]);
  return hasProjects.rows.length > 0;
}

export async function deleteTeam(teamId: string): Promise<void> {
  await pool.query('DELETE FROM teams WHERE id = $1', [teamId]);
}

export async function listMembers(teamId: string): Promise<Array<{
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  joined_at: Date;
}>> {
  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name AS "displayName", tm.role, tm.joined_at
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.joined_at ASC`,
    [teamId],
  );
  return result.rows;
}

export async function getMemberRole(teamId: string, userId: string): Promise<string | undefined> {
  const target = await pool.query<{ role: string }>(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId],
  );
  return target.rows[0]?.role;
}

export async function updateMemberRole(teamId: string, userId: string, role: string): Promise<void> {
  await pool.query('UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2', [
    teamId,
    userId,
    role,
  ]);
}

export async function transferOwnership(teamId: string, newOwnerId: string): Promise<void> {
  await withTransaction(pool, async (client) => {
    await client.query(
      "UPDATE team_members SET role = 'admin' WHERE team_id = $1 AND role = 'owner'",
      [teamId],
    );
    await client.query(
      'UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2',
      [teamId, newOwnerId, 'owner'],
    );
  });
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
}

export async function listTeamInvitations(teamId: string): Promise<Array<{
  id: string;
  email: string;
  role: string;
  created_at: Date;
  expires_at: Date;
}>> {
  const result = await pool.query(
    `SELECT i.id, i.email, i.role, i.created_at, i.expires_at
     FROM invitations i
     WHERE i.team_id = $1 AND i.status = 'pending' AND i.expires_at > now()
     ORDER BY i.created_at DESC`,
    [teamId],
  );
  return result.rows;
}

export async function findUserIdByEmail(email: string): Promise<string | undefined> {
  const target = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  return target.rows[0]?.id;
}

export async function isMember(teamId: string, userId: string): Promise<boolean> {
  const existing = await pool.query<{ id: string }>(
    'SELECT 1 AS id FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId],
  );
  return existing.rows.length > 0;
}

export async function findPendingInvite(teamId: string, email: string): Promise<boolean> {
  const pending = await pool.query<{ id: string }>(
    `SELECT id FROM invitations
     WHERE team_id = $1 AND email = $2 AND status = 'pending' AND expires_at > now()`,
    [teamId, email],
  );
  return pending.rows.length > 0;
}

export async function insertInvitation(
  teamId: string,
  email: string,
  role: string,
  ttlMs: number,
  createdBy: string,
): Promise<{ id: string; created_at: Date; expires_at: Date }> {
  const inserted = await pool.query<{ id: string; created_at: Date; expires_at: Date }>(
    `INSERT INTO invitations (team_id, email, role, expires_at, created_by)
     VALUES ($1, $2, $3, now() + ($4 || ' milliseconds')::interval, $5)
     RETURNING id, created_at, expires_at`,
    [teamId, email, role, String(ttlMs), createdBy],
  );
  return inserted.rows[0]!;
}

export async function findAcceptableInvitation(
  invitationId: string,
  email: string,
  teamId: string,
): Promise<{ team_id: string; role: string; team_name: string } | undefined> {
  const inv = await pool.query<{ team_id: string; role: string; team_name: string }>(
    `SELECT i.team_id, i.role, t.name AS team_name
     FROM invitations i
     JOIN teams t ON t.id = i.team_id
     WHERE i.id = $1 AND i.email = $2 AND i.team_id = $3 AND i.status = 'pending' AND i.expires_at > now()`,
    [invitationId, email, teamId],
  );
  return inv.rows[0];
}

export async function acceptInvitation(invitationId: string, teamId: string, userId: string, role: string): Promise<void> {
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [teamId, userId, role],
    );
    await client.query(`UPDATE invitations SET status = 'accepted' WHERE id = $1`, [invitationId]);
  });
}

export async function findInvitationById(
  invitationId: string,
  teamId: string,
): Promise<{ email: string; team_id: string } | undefined> {
  const inv = await pool.query<{ email: string; team_id: string }>(
    'SELECT email, team_id FROM invitations WHERE id = $1 AND team_id = $2',
    [invitationId, teamId],
  );
  return inv.rows[0];
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await pool.query(`UPDATE invitations SET status = 'declined' WHERE id = $1 AND status = 'pending'`, [
    invitationId,
  ]);
}