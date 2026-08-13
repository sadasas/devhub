import 'cookie-parser';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, getUserId } from '../auth/middleware/requireAuth.js';
import { ApiError } from '../app.js';
import { logger } from '../lib/logger.js';
import { stateSchema, projectStatus, emptyState, exportDocumentSchema, type Milestone, type State } from '../schema/state.js';
import { prdSchema, prdPatchSchema, mergePrd, normalizePrd } from '../schema/prd.js';
import { parseOrThrow } from '../lib/db.js';
import {
  assertAdmin,
  assertWrite,
  getProjectWithRole,
  getTeamWithRole,
  type ProjectWithRole,
} from './authz.js';
import { normalizeTabs, publicTabsSchema } from './sharing.js';

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(5_000).default(''),
  teamId: z.string().uuid('Team is required'),
  prd: prdSchema.optional(),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5_000).optional(),
  status: projectStatus.optional(),
  visibility: z.enum(['private', 'public']).optional(),
  publicTabs: publicTabsSchema.optional(),
  prd: prdPatchSchema.optional(),
});

const putStateSchema = z.object({
  state: stateSchema,
  version: z.number().int().positive(),
});

const importProjectSchema = exportDocumentSchema.extend({
  teamId: z.string().uuid().optional(),
});

interface ProjectRow extends Omit<ProjectWithRole, 'role' | 'prd' | 'public_tabs'> {
  role: string;
  prd: Record<string, unknown> | null;
  public_tabs: unknown;
}

function projectJson(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    tabs: normalizeTabs(row.public_tabs),
    prd: normalizePrd(row.prd),
    teamId: row.team_id,
    teamName: row.team_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface ProjectStats {
  totalTasks: number;
  doneTasks: number;
  openIssues: number;
  outdatedDeps: number;
  totalMilestones: number;
  releasedMilestones: number;
  nextMilestone: Milestone | null;
}

function computeProjectStats(state: State): ProjectStats {
  const now = Date.now();
  const upcoming = state.milestones
    .filter((m) => m.status !== 'released' && m.targetDate && Date.parse(m.targetDate) >= now)
    .sort((a, b) => Date.parse(a.targetDate!) - Date.parse(b.targetDate!));
  return {
    totalTasks: state.tasks.length,
    doneTasks: state.tasks.filter((t) => t.status === 'done').length,
    openIssues: state.issues.filter((i) => !['resolved', 'wontfix'].includes(i.status)).length,
    outdatedDeps: state.techEntries.filter((t) => t.status !== 'current').length,
    totalMilestones: state.milestones.length,
    releasedMilestones: state.milestones.filter((m) => m.status === 'released').length,
    nextMilestone: upcoming[0] ?? null,
  };
}

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
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
  res.json({ projects: result.rows.map(projectJson) });
});

projectsRouter.get('/stats', async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query<{ id: string; data: unknown }>(
    `SELECT p.id, p.data
     FROM projects p
     JOIN team_members tm ON tm.team_id = p.team_id
     WHERE tm.user_id = $1`,
    [userId],
  );
  const projects = result.rows.map((row) => {
    const parsed = stateSchema.safeParse(row.data);
    return { projectId: row.id, ...computeProjectStats(parsed.success ? parsed.data : emptyState) };
  });
  res.json({ projects });
});

projectsRouter.post('/', async (req, res) => {
  const userId = getUserId(req);
  const { name, description, teamId, prd } = parseOrThrow(
    createProjectSchema,
    req.body,
    'Invalid project data',
  );
  const team = await getTeamWithRole(userId, teamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertWrite(team.role);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO projects (team_id, name, description, prd, data)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) RETURNING id`,
    [teamId, name, description, JSON.stringify(mergePrd(prd)), JSON.stringify(emptyState)],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new ApiError(500, 'INTERNAL', 'Failed to create project');
  const row = await getProjectWithRole(userId, id);
  res.status(201).json(projectJson(row!));
});

projectsRouter.get('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProjectWithRole(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  res.json(projectJson(row));
});

projectsRouter.patch('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProjectWithRole(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertWrite(row.role);
  const { name, description, status, visibility, publicTabs, prd } = parseOrThrow(
    updateProjectSchema,
    req.body,
    'Invalid project data',
  );
  if (visibility !== undefined) assertAdmin(row.role);
  if (publicTabs !== undefined) assertAdmin(row.role);
  const mergedPrd = prd !== undefined ? JSON.stringify(mergePrd(prd, normalizePrd(row.prd))) : null;
  const updated = await pool.query<{ id: string; updated_at: Date }>(
    `UPDATE projects SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       status = COALESCE($4, status),
       visibility = COALESCE($5, visibility),
       public_tabs = COALESCE($6::jsonb, public_tabs),
       prd = COALESCE($7::jsonb, prd),
       updated_at = now()
     WHERE id = $1
     RETURNING id, updated_at`,
    [
      req.params.projectId,
      name ?? null,
      description ?? null,
      status ?? null,
      visibility ?? null,
      publicTabs ? JSON.stringify(publicTabs) : null,
      mergedPrd,
    ],
  );
  const updatedRow = updated.rows[0];
  if (!updatedRow) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const fresh = await getProjectWithRole(userId, req.params.projectId);
  res.json(projectJson(fresh!));
});

projectsRouter.delete('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProjectWithRole(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertAdmin(row.role);
  const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [
    req.params.projectId,
  ]);
  if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  res.json({ ok: true });
});

projectsRouter.get('/:projectId/state', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProjectWithRole(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) {
    logger.error('State validation failed on read', {
      requestId: req.id,
      projectId: req.params.projectId,
      issues: parsed.error.issues,
    });
    throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
  }
  res.json({ state: parsed.data, version: row.version });
});

projectsRouter.put('/:projectId/state', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProjectWithRole(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertWrite(row.role);
  const { state, version } = parseOrThrow(putStateSchema, req.body, 'Invalid state payload');
  const updated = await pool.query<{ id: string; version: number }>(
    `UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now()
     WHERE id = $1 AND version = $3
     RETURNING id, version`,
    [req.params.projectId, JSON.stringify(state), version],
  );
  if (!updated.rows[0]) {
    const fresh = await getProjectWithRole(userId, req.params.projectId);
    const currentParsed = stateSchema.safeParse(fresh?.data);
    throw new ApiError(409, 'CONFLICT', 'The project was modified by someone else. Reload to see the latest version.', {
      current: {
        version: fresh?.version ?? null,
        state: currentParsed.success ? currentParsed.data : emptyState,
      },
    });
  }
  res.json({ ok: true, version: updated.rows[0].version });
});

projectsRouter.get('/:projectId/export', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProjectWithRole(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
  }
  const document = {
    meta: {
      app: 'devhub',
      version: '0.1.0',
      exportedAt: new Date().toISOString(),
      projectId: req.params.projectId,
    },
    state: parsed.data,
  };
  const safeName = row.name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase() || 'project';
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="devhub-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(document);
});

projectsRouter.post('/import', async (req, res) => {
  const userId = getUserId(req);
  const { meta, state, teamId } = parseOrThrow(
    importProjectSchema,
    req.body,
    'Invalid export document',
  );
  const existing = await getProjectWithRole(userId, meta.projectId);
  if (existing) {
    assertWrite(existing.role);
    await pool.query(
      'UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1',
      [meta.projectId, JSON.stringify(state)],
    );
    res.json({ projectId: meta.projectId, restored: true });
    return;
  }
  let targetTeamId = teamId;
  if (!targetTeamId) {
    const first = await pool.query<{ team_id: string }>(
      `SELECT tm.team_id
       FROM team_members tm
       WHERE tm.user_id = $1 AND tm.role IN ('owner', 'admin', 'editor')
       ORDER BY tm.joined_at ASC LIMIT 1`,
      [userId],
    );
    targetTeamId = first.rows[0]?.team_id;
  }
  if (!targetTeamId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'No team available to import into');
  }
  const team = await getTeamWithRole(userId, targetTeamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertWrite(team.role);
  const name = `Imported ${new Date().toISOString().slice(0, 10)}`;
  const result = await pool.query<{ id: string }>(
    'INSERT INTO projects (team_id, name, description, data) VALUES ($1, $2, $3, $4::jsonb) RETURNING id',
    [targetTeamId, name, 'Imported from export document', JSON.stringify(state)],
  );
  res.status(201).json({ projectId: result.rows[0]?.id, restored: false });
});