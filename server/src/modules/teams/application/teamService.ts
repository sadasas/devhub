import { z } from 'zod';
import { ApiError } from '../../../shared/errors.js';
import { parseOrThrow } from '../../../shared/db.js';
import {
  assertAdmin,
  assertOwner,
  getTeamWithRole,
  getUserEmail,
  isUuid,
  type TeamRole,
} from '../../authorization/application/authz.js';
import {
  acceptInvitation,
  countMembers,
  declineInvitation,
  deleteTeam,
  findAcceptableInvitation,
  findInvitationById,
  findPendingInvite,
  findUserIdByEmail,
  getMemberRole,
  insertInvitation,
  insertTeamWithOwner,
  isMember,
  listMembers,
  listPendingInvitationsForEmail,
  listTeamInvitations,
  listTeams,
  removeMember,
  renameTeam,
  teamHasProjects,
  transferOwnership,
  updateMemberRole,
} from '../infrastructure/teamRepository.js';
import { assertMemberQuota } from '../../plans/application/quotaService.js';

const INVITE_ROLES: ReadonlySet<TeamRole> = new Set(['admin', 'editor', 'viewer']);
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300),
});

const renameTeamSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300),
});

const memberRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer', 'owner']),
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email required').max(320),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
});

function teamJson(row: {
  id: string;
  name: string;
  role: string;
  plan?: string;
  plan_package_name?: string;
  member_count: number | string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    plan: row.plan ?? 'free',
    planPackageName: row.plan_package_name ?? 'Free',
    memberCount: Number(row.member_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listTeamsForUser(userId: string) {
  return (await listTeams(userId)).map(teamJson);
}

export async function createTeam(userId: string, body: unknown) {
  const { name } = parseOrThrow(createTeamSchema, body, 'Invalid team data');
  const result = await insertTeamWithOwner(name, userId);
  return {
    team: {
      id: result.id,
      name: result.name,
      role: 'owner',
      plan: 'free',
      memberCount: 1,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    },
  };
}

export async function listInvitations(userId: string) {
  const email = await getUserEmail(userId);
  const rows = await listPendingInvitationsForEmail(email);
  return rows.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    teamName: r.team_name,
    role: r.role,
    createdAt: r.created_at.toISOString(),
    expiresAt: r.expires_at.toISOString(),
  }));
}

export async function getTeam(userId: string, teamId: string) {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const memberCount = await countMembers(row.id);
  return {
    team: {
      id: row.id,
      name: row.name,
      role: row.role,
      plan: row.plan,
      memberCount,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    },
  };
}

export async function renameTeamById(userId: string, teamId: string, body: unknown): Promise<void> {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertAdmin(row.role);
  const { name } = parseOrThrow(renameTeamSchema, body, 'Invalid team data');
  await renameTeam(row.id, name);
}

export async function deleteTeamById(userId: string, teamId: string): Promise<void> {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertOwner(row.role);
  if (await teamHasProjects(row.id)) {
    throw new ApiError(
      409,
      'CONFLICT',
      'Team still has projects; delete or move them before deleting the team',
    );
  }
  await deleteTeam(row.id);
}

export async function listTeamMembers(userId: string, teamId: string) {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  return (await listMembers(row.id)).map((m) => ({
    id: m.id,
    email: m.email,
    displayName: m.displayName ?? '',
    role: m.role,
    joinedAt: m.joined_at.toISOString(),
  }));
}

export async function changeMemberRole(
  userId: string,
  teamId: string,
  targetUserId: string,
  body: unknown,
): Promise<void> {
  if (!isUuid(targetUserId)) throw new ApiError(404, 'NOT_FOUND', 'Member not found');
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const { role: newRole } = parseOrThrow(memberRoleSchema, body, 'Invalid member data');
  const targetRole = await getMemberRole(row.id, targetUserId);
  if (targetRole === undefined) throw new ApiError(404, 'NOT_FOUND', 'Member not found');
  if (targetRole === 'owner') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The team owner cannot be modified');
  }
  if (newRole === 'owner') {
    assertOwner(row.role);
    await transferOwnership(row.id, targetUserId);
  } else {
    assertAdmin(row.role);
    await updateMemberRole(row.id, targetUserId, newRole);
  }
}

export async function kickMember(userId: string, teamId: string, targetUserId: string): Promise<void> {
  if (!isUuid(targetUserId)) throw new ApiError(404, 'NOT_FOUND', 'Member not found');
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  if (targetUserId !== userId) assertAdmin(row.role);
  const targetRole = await getMemberRole(row.id, targetUserId);
  if (targetRole === undefined) throw new ApiError(404, 'NOT_FOUND', 'Member not found');
  if (targetRole === 'owner') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The team owner cannot be removed');
  }
  await removeMember(row.id, targetUserId);
}

export async function listInvitationsForTeam(userId: string, teamId: string) {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertAdmin(row.role);
  return (await listTeamInvitations(row.id)).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.created_at.toISOString(),
    expiresAt: r.expires_at.toISOString(),
  }));
}

export async function inviteMember(userId: string, teamId: string, body: unknown) {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertAdmin(row.role);
  const { email, role } = parseOrThrow(inviteSchema, body, 'Invalid invitation data');
  const targetId = await findUserIdByEmail(email);
  if (!targetId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'No DevHub account exists for this email');
  }
  if (targetId === userId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'You cannot invite yourself');
  }
  if (await isMember(row.id, targetId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'This user is already a member');
  }
  if (await findPendingInvite(row.id, email)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'An invitation for this email is already pending');
  }
  await assertMemberQuota(row.id);
  const inv = await insertInvitation(row.id, email, role, INVITATION_TTL_MS, userId).catch(
    (err: unknown) => {
      // Partial unique (team_id, email) WHERE status = 'pending' (migrasi 014) — DB-9/API-6
      if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505') {
        throw new ApiError(400, 'VALIDATION_ERROR', 'An invitation for this email is already pending');
      }
      throw err;
    },
  );
  return {
    invitation: {
      id: inv.id,
      teamId: row.id,
      email,
      role,
      createdAt: inv.created_at.toISOString(),
      expiresAt: inv.expires_at.toISOString(),
    },
  };
}

export async function acceptTeamInvitation(userId: string, teamId: string, invitationId: string) {
  if (!isUuid(invitationId) || !isUuid(teamId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Invitation not found or expired');
  }
  const email = await getUserEmail(userId);
  const inv = await findAcceptableInvitation(invitationId, email, teamId);
  if (!inv) throw new ApiError(404, 'NOT_FOUND', 'Invitation not found or expired');
  const { team_id, role, team_name: teamName } = inv;
  if (!INVITE_ROLES.has(role as TeamRole)) {
    throw new ApiError(500, 'INTERNAL', 'Invitation role is invalid');
  }
  await assertMemberQuota(team_id);
  await acceptInvitation(invitationId, team_id, userId, role);
  return { ok: true, teamId: team_id, teamName };
}

export async function declineTeamInvitation(userId: string, teamId: string, invitationId: string): Promise<void> {
  if (!isUuid(invitationId) || !isUuid(teamId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Invitation not found');
  }
  const email = await getUserEmail(userId);
  const inv = await findInvitationById(invitationId, teamId);
  if (!inv) throw new ApiError(404, 'NOT_FOUND', 'Invitation not found');
  const isInvitee = inv.email === email;
  const teamRow = await getTeamWithRole(userId, teamId);
  const canWithdraw = teamRow !== undefined && (teamRow.role === 'owner' || teamRow.role === 'admin');
  if (!isInvitee && !canWithdraw) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot manage this invitation');
  }
  await declineInvitation(invitationId);
}