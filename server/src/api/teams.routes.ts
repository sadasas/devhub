import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, getUserId } from '../auth/middleware/requireAuth.js';
import { ApiError } from '../app.js';
import { withTransaction, parseOrThrow, getUserEmail } from '../lib/db.js';
import { assertAdmin, assertOwner, getTeamWithRole, isUuid, type TeamRole } from './authz.js';

const INVITE_ROLES: ReadonlySet<TeamRole> = new Set(['admin', 'editor', 'viewer']);

const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
});

const renameTeamSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
});

const memberRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer', 'owner']),
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email required').max(320),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
});

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function teamJson(row: {
  id: string;
  name: string;
  role: string;
  member_count: number | string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    memberCount: Number(row.member_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

teamsRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query(
    `SELECT t.id, t.name, t.created_at, t.updated_at, tm.role,
            (SELECT count(*)::int FROM team_members m WHERE m.team_id = t.id) AS member_count
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id
     WHERE tm.user_id = $1
     ORDER BY t.created_at ASC`,
    [userId],
  );
  res.json({ teams: result.rows.map(teamJson) });
});

teamsRouter.post('/', async (req, res) => {
  const userId = getUserId(req);
  const { name } = parseOrThrow(createTeamSchema, req.body, 'Invalid team data');
  const result = await withTransaction(pool, async (client) => {
    const inserted = await client.query<{ id: string; created_at: Date; updated_at: Date }>(
      'INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id, created_at, updated_at',
      [name, userId],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new ApiError(500, 'INTERNAL', 'Failed to create team');
    await client.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [id, userId, 'owner'],
    );
    return { id, name, createdAt: inserted.rows[0]!.created_at, updatedAt: inserted.rows[0]!.updated_at };
  });
  res.status(201).json({
    team: {
      id: result.id,
      name: result.name,
      role: 'owner',
      memberCount: 1,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    },
  });
});

teamsRouter.get('/invitations', async (req, res) => {
  const userId = getUserId(req);
  const email = await getUserEmail(userId);
  const result = await pool.query(
    `SELECT i.id, i.team_id, i.role, i.created_at, i.expires_at, t.name AS team_name
     FROM invitations i
     JOIN teams t ON t.id = i.team_id
     WHERE i.email = $1 AND i.status = 'pending' AND i.expires_at > now()
     ORDER BY i.created_at DESC`,
    [email],
  );
  res.json({
    invitations: result.rows.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      role: r.role,
      createdAt: r.created_at.toISOString(),
      expiresAt: r.expires_at.toISOString(),
    })),
  });
});

teamsRouter.get('/:teamId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getTeamWithRole(userId, req.params.teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const count = await pool.query<{ count: string }>(
    'SELECT count(*)::int AS count FROM team_members WHERE team_id = $1',
    [row.id],
  );
  res.json({
    team: {
      id: row.id,
      name: row.name,
      role: row.role,
      memberCount: Number(count.rows[0]?.count ?? 0),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    },
  });
});

teamsRouter.patch('/:teamId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getTeamWithRole(userId, req.params.teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertAdmin(row.role);
  const { name } = parseOrThrow(renameTeamSchema, req.body, 'Invalid team data');
  await pool.query('UPDATE teams SET name = $2, updated_at = now() WHERE id = $1', [
    row.id,
    name,
  ]);
  res.json({ ok: true });
});

teamsRouter.delete('/:teamId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getTeamWithRole(userId, req.params.teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertOwner(row.role);
  await pool.query('DELETE FROM teams WHERE id = $1', [row.id]);
  res.json({ ok: true });
});

teamsRouter.get('/:teamId/members', async (req, res) => {
  const userId = getUserId(req);
  const row = await getTeamWithRole(userId, req.params.teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const result = await pool.query(
    `SELECT u.id, u.email, tm.role, tm.joined_at
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.joined_at ASC`,
    [row.id],
  );
  res.json({
    members: result.rows.map((m) => ({
      id: m.id,
      email: m.email,
      role: m.role,
      joinedAt: m.joined_at.toISOString(),
    })),
  });
});

teamsRouter.patch('/:teamId/members/:userId', async (req, res) => {
  const userId = getUserId(req);
  if (!isUuid(req.params.userId)) throw new ApiError(404, 'NOT_FOUND', 'Member not found');
  const row = await getTeamWithRole(userId, req.params.teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const { role: newRole } = parseOrThrow(memberRoleSchema, req.body, 'Invalid member data');
  const target = await pool.query<{ role: string }>(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [row.id, req.params.userId],
  );
  if (!target.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Member not found');
  if (target.rows[0].role === 'owner') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The team owner cannot be modified');
  }
  if (newRole === 'owner') {
    assertOwner(row.role);
    await withTransaction(pool, async (client) => {
      await client.query(
        "UPDATE team_members SET role = 'admin' WHERE team_id = $1 AND role = 'owner'",
        [row.id],
      );
      await client.query(
        'UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2',
        [row.id, req.params.userId, 'owner'],
      );
    });
  } else {
    assertAdmin(row.role);
    await pool.query('UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2', [
      row.id,
      req.params.userId,
      newRole,
    ]);
  }
  res.json({ ok: true });
});

teamsRouter.delete('/:teamId/members/:userId', async (req, res) => {
  const userId = getUserId(req);
  if (!isUuid(req.params.userId)) throw new ApiError(404, 'NOT_FOUND', 'Member not found');
  const row = await getTeamWithRole(userId, req.params.teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  if (req.params.userId !== userId) assertAdmin(row.role);
  const target = await pool.query<{ role: string }>(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [row.id, req.params.userId],
  );
  if (!target.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Member not found');
  if (target.rows[0].role === 'owner') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The team owner cannot be removed');
  }
  await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [
    row.id,
    req.params.userId,
  ]);
  res.json({ ok: true });
});

teamsRouter.get('/:teamId/invitations', async (req, res) => {
  const userId = getUserId(req);
  const row = await getTeamWithRole(userId, req.params.teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertAdmin(row.role);
  const result = await pool.query(
    `SELECT i.id, i.email, i.role, i.created_at, i.expires_at
     FROM invitations i
     WHERE i.team_id = $1 AND i.status = 'pending' AND i.expires_at > now()
     ORDER BY i.created_at DESC`,
    [row.id],
  );
  res.json({
    invitations: result.rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.created_at.toISOString(),
      expiresAt: r.expires_at.toISOString(),
    })),
  });
});

teamsRouter.post('/:teamId/invitations', async (req, res) => {
  const userId = getUserId(req);
  const row = await getTeamWithRole(userId, req.params.teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertAdmin(row.role);
  const { email, role } = parseOrThrow(inviteSchema, req.body, 'Invalid invitation data');
  const target = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  if (!target.rows[0]) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'No DevHub account exists for this email');
  }
  const targetId = target.rows[0].id;
  if (targetId === userId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'You cannot invite yourself');
  }
  const existing = await pool.query<{ id: string }>(
    'SELECT 1 AS id FROM team_members WHERE team_id = $1 AND user_id = $2',
    [row.id, targetId],
  );
  if (existing.rows[0]) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'This user is already a member');
  }
  const pending = await pool.query<{ id: string }>(
    `SELECT id FROM invitations
     WHERE team_id = $1 AND email = $2 AND status = 'pending' AND expires_at > now()`,
    [row.id, email],
  );
  if (pending.rows[0]) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'An invitation for this email is already pending');
  }
  const inserted = await pool.query<{ id: string; created_at: Date; expires_at: Date }>(
    `INSERT INTO invitations (team_id, email, role, expires_at, created_by)
     VALUES ($1, $2, $3, now() + ($4 || ' milliseconds')::interval, $5)
     RETURNING id, created_at, expires_at`,
    [row.id, email, role, String(INVITATION_TTL_MS), userId],
  );
  const inv = inserted.rows[0];
  res.status(201).json({
    invitation: {
      id: inv?.id,
      teamId: row.id,
      email,
      role,
      createdAt: inv?.created_at.toISOString(),
      expiresAt: inv?.expires_at.toISOString(),
    },
  });
});

teamsRouter.post('/:teamId/invitations/:invitationId/accept', async (req, res) => {
  const userId = getUserId(req);
  if (!isUuid(req.params.invitationId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Invitation not found or expired');
  }
  const email = await getUserEmail(userId);
  const inv = await pool.query<{ team_id: string; role: TeamRole; team_name: string }>(
    `SELECT i.team_id, i.role, t.name AS team_name
     FROM invitations i
     JOIN teams t ON t.id = i.team_id
     WHERE i.id = $1 AND i.email = $2 AND i.status = 'pending' AND i.expires_at > now()`,
    [req.params.invitationId, email],
  );
  if (!inv.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Invitation not found or expired');
  const { team_id: teamId, role, team_name: teamName } = inv.rows[0];
  if (!INVITE_ROLES.has(role)) {
    throw new ApiError(500, 'INTERNAL', 'Invitation role is invalid');
  }
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [teamId, userId, role],
    );
    await client.query(
      `UPDATE invitations SET status = 'accepted' WHERE id = $1`,
      [req.params.invitationId],
    );
  });
  res.json({ ok: true, teamId, teamName });
});

teamsRouter.delete('/:teamId/invitations/:invitationId', async (req, res) => {
  const userId = getUserId(req);
  if (!isUuid(req.params.invitationId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Invitation not found');
  }
  const email = await getUserEmail(userId);
  const inv = await pool.query<{ email: string; team_id: string }>(
    'SELECT email, team_id FROM invitations WHERE id = $1 AND team_id = $2',
    [req.params.invitationId, req.params.teamId],
  );
  if (!inv.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Invitation not found');
  const isInvitee = inv.rows[0].email === email;
  const teamRow = await getTeamWithRole(userId, req.params.teamId);
  const canWithdraw = teamRow !== undefined && (teamRow.role === 'owner' || teamRow.role === 'admin');
  if (!isInvitee && !canWithdraw) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot manage this invitation');
  }
  await pool.query(
    `UPDATE invitations SET status = 'declined' WHERE id = $1 AND status = 'pending'`,
    [req.params.invitationId],
  );
  res.json({ ok: true });
});