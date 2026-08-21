import { pool } from '../../../db/pool.js';
import type { ProjectWithRole } from '../../authorization/application/authz.js';

export interface ProjectRow extends Omit<ProjectWithRole, 'role' | 'prd' | 'public_tabs'> {
  role: string;
  prd: Record<string, unknown> | null;
  public_tabs: unknown;
}

export interface ProjectMetaPatch {
  name?: string;
  description?: string;
  status?: string;
  visibility?: string;
  publicTabs?: unknown;
  prd?: string | null;
}

export interface ProjectVersionRow {
  id: string;
  version: number;
}

export async function listProjects(userId: string): Promise<ProjectRow[]> {
  const result = await pool.query(
    `SELECT p.id, p.name, p.description, p.status, p.version, p.prd, p.visibility, p.public_tabs,
            p.created_at, p.updated_at, p.team_id, t.name AS team_name, tm.role
     FROM projects p
     JOIN team_members tm ON tm.team_id = p.team_id
     JOIN teams t ON t.id = p.team_id
     WHERE tm.user_id = $1
     ORDER BY p.updated_at DESC`,
    [userId],
  );
  return result.rows as ProjectRow[];
}

export async function listProjectStats(userId: string): Promise<Array<{ id: string; data: unknown }>> {
  const result = await pool.query<{ id: string; data: unknown }>(
    `SELECT p.id, p.data
     FROM projects p
     JOIN team_members tm ON tm.team_id = p.team_id
     WHERE tm.user_id = $1
     ORDER BY p.updated_at DESC
     LIMIT 200`,
    [userId],
  );
  return result.rows;
}

export async function insertProject(
  teamId: string,
  name: string,
  description: string,
  prd: string | null,
  data: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO projects (team_id, name, description, prd, data)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) RETURNING id`,
    [teamId, name, description, prd, data],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Failed to create project');
  return id;
}

export async function updateProjectMeta(
  projectId: string,
  patch: ProjectMetaPatch,
): Promise<ProjectVersionRow | undefined> {
  // Metadata project juga menaikkan version (audit 2026-08b, API-8/DB-16):
  // semua mutasi project menggeser version agar optimistic lock konsisten.
  const updated = await pool.query<ProjectVersionRow & { updated_at: Date }>(
    `UPDATE projects SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       status = COALESCE($4, status),
       visibility = COALESCE($5, visibility),
       public_tabs = COALESCE($6::jsonb, public_tabs),
       prd = COALESCE($7::jsonb, prd),
       version = version + 1,
       updated_at = now()
     WHERE id = $1
     RETURNING id, updated_at, version`,
    [
      projectId,
      patch.name ?? null,
      patch.description ?? null,
      patch.status ?? null,
      patch.visibility ?? null,
      patch.publicTabs !== undefined ? JSON.stringify(patch.publicTabs) : null,
      patch.prd ?? null,
    ],
  );
  return updated.rows[0];
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [projectId]);
  return result.rows.length > 0;
}

export async function updateProjectState(
  projectId: string,
  state: string,
  expectedVersion: number,
): Promise<ProjectVersionRow | undefined> {
  const updated = await pool.query<ProjectVersionRow>(
    `UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now()
     WHERE id = $1 AND version = $3
     RETURNING id, version`,
    [projectId, state, expectedVersion],
  );
  return updated.rows[0];
}

export async function restoreProjectState(
  projectId: string,
  state: string,
  stateVersion: number,
): Promise<ProjectVersionRow | undefined> {
  const restored = await pool.query<ProjectVersionRow>(
    'UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1 AND version = $3 RETURNING id, version',
    [projectId, state, stateVersion],
  );
  return restored.rows[0];
}

export async function restoreProjectStateUnconditional(
  projectId: string,
  state: string,
): Promise<void> {
  await pool.query(
    'UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1',
    [projectId, state],
  );
}

export async function findImportTeam(userId: string): Promise<string | undefined> {
  const first = await pool.query<{ team_id: string }>(
    `SELECT tm.team_id
     FROM team_members tm
     WHERE tm.user_id = $1 AND tm.role IN ('owner', 'admin', 'editor')
     ORDER BY tm.joined_at ASC LIMIT 1`,
    [userId],
  );
  return first.rows[0]?.team_id;
}

export async function insertImportedProject(
  teamId: string,
  name: string,
  description: string,
  state: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    'INSERT INTO projects (team_id, name, description, data) VALUES ($1, $2, $3, $4::jsonb) RETURNING id',
    [teamId, name, description, state],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Failed to create project');
  return id;
}