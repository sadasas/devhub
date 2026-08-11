import { pool } from '../db/pool.js';
import { ApiError } from '../app.js';

export const TEAM_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

const WRITE_ROLES: ReadonlySet<TeamRole> = new Set(['owner', 'admin', 'editor']);
const ADMIN_ROLES: ReadonlySet<TeamRole> = new Set(['owner', 'admin']);

export interface ProjectWithRole {
  id: string;
  name: string;
  description: string;
  status: string;
  prd: Record<string, unknown> | null;
  data: unknown;
  team_id: string;
  team_name: string;
  created_at: Date;
  updated_at: Date;
  role: TeamRole;
}

export interface TeamWithRole {
  id: string;
  name: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  role: TeamRole;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function getProjectWithRole(
  userId: string,
  projectId: string,
): Promise<ProjectWithRole | undefined> {
  if (!isUuid(projectId)) return undefined;
  const result = await pool.query(
    `SELECT p.id, p.name, p.description, p.status, p.prd, p.data,
            p.created_at, p.updated_at, p.team_id, t.name AS team_name, tm.role
     FROM projects p
     JOIN team_members tm ON tm.team_id = p.team_id
     JOIN teams t ON t.id = p.team_id
     WHERE p.id = $1 AND tm.user_id = $2`,
    [projectId, userId],
  );
  return result.rows[0] as ProjectWithRole | undefined;
}

export async function getTeamWithRole(
  userId: string,
  teamId: string,
): Promise<TeamWithRole | undefined> {
  if (!isUuid(teamId)) return undefined;
  const result = await pool.query(
    `SELECT t.id, t.name, t.created_by, t.created_at, t.updated_at, tm.role
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id
     WHERE t.id = $1 AND tm.user_id = $2`,
    [teamId, userId],
  );
  return result.rows[0] as TeamWithRole | undefined;
}

export function assertWrite(role: TeamRole | undefined): void {
  if (!role || !WRITE_ROLES.has(role)) {
    throw new ApiError(403, 'FORBIDDEN', 'You only have read access to this project');
  }
}

export function assertAdmin(role: TeamRole | undefined): void {
  if (!role || !ADMIN_ROLES.has(role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
  }
}

export function assertOwner(role: TeamRole | undefined): void {
  if (role !== 'owner') {
    throw new ApiError(403, 'FORBIDDEN', 'Owner access required');
  }
}
