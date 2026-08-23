import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../../db/pool.js';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { ApiError } from '../../../shared/errors.js';
import { logger } from '../../../shared/logger.js';
import { stateSchema } from '../../projects/domain/state.js';
import { parseOrThrow } from '../../../shared/db.js';
import { assertAdmin, assertWrite, getProjectWithRole, getTeamWithRole, isUuid } from '../../authorization/application/authz.js';
import { assertProjectQuota } from '../../plans/application/quotaService.js';

const saveTemplateSchema = z.object({
  projectId: z.string().uuid('Project is required'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(5_000).default(''),
});

const instantiateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5_000).optional(),
});

interface TemplateRow {
  id: string;
  team_id: string;
  team_name: string;
  name: string;
  description: string;
  state: unknown;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

function templateJson(row: TemplateRow, withState = false) {
  const json = {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
  if (withState) return { ...json, state: row.state };
  return json;
}

const selectBase = `
  SELECT t.id, t.team_id, tm.name AS team_name, t.name, t.description, t.state,
         t.created_by, t.created_at, t.updated_at
  FROM project_templates t
  JOIN teams tm ON tm.id = t.team_id
`;

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.post('/', async (req, res) => {
  const userId = getUserId(req);
  const { projectId, name, description } = parseOrThrow(
    saveTemplateSchema,
    req.body,
    'Invalid template data',
  );
  const project = await getProjectWithRole(userId, projectId);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertWrite(project.role);
  const parsed = stateSchema.safeParse(project.data);
  if (!parsed.success) {
    logger.error('State validation failed when saving template', {
      requestId: req.id,
      projectId,
      issues: parsed.error.issues,
    });
    throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
  }
  const result = await pool.query<{ id: string }>(
    `INSERT INTO project_templates (team_id, name, description, state, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [project.team_id, name, description, JSON.stringify(parsed.data), userId],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new ApiError(500, 'INTERNAL', 'Failed to save template');
  const row = await pool.query<TemplateRow>(
    `${selectBase} WHERE t.id = $1`,
    [id],
  );
  res.status(201).json({ template: templateJson(row.rows[0]!) });
});

templatesRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query<TemplateRow>(
    `${selectBase}
     JOIN team_members m ON m.team_id = t.team_id
     WHERE m.user_id = $1
     ORDER BY t.updated_at DESC`,
    [userId],
  );
  res.json({ templates: result.rows.map((r) => templateJson(r)) });
});

templatesRouter.get('/:templateId', async (req, res) => {
  const userId = getUserId(req);
  if (!isUuid(req.params.templateId)) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  const result = await pool.query<TemplateRow>(
    `${selectBase}
     JOIN team_members m ON m.team_id = t.team_id
     WHERE t.id = $1 AND m.user_id = $2`,
    [req.params.templateId, userId],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  res.json({ template: templateJson(row, true) });
});

templatesRouter.delete('/:templateId', async (req, res) => {
  const userId = getUserId(req);
  if (!isUuid(req.params.templateId)) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  const row = await pool.query<{ team_id: string }>(
    'SELECT team_id FROM project_templates WHERE id = $1',
    [req.params.templateId],
  );
  if (!row.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  const team = await getTeamWithRole(userId, row.rows[0].team_id);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  assertAdmin(team.role);
  await pool.query('DELETE FROM project_templates WHERE id = $1', [req.params.templateId]);
  res.json({ ok: true });
});

templatesRouter.post('/:templateId/instantiate', async (req, res) => {
  const userId = getUserId(req);
  if (!isUuid(req.params.templateId)) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  const { name, description } = parseOrThrow(instantiateSchema, req.body ?? {}, 'Invalid project data');
  const row = await pool.query<TemplateRow>(
    `${selectBase} WHERE t.id = $1`,
    [req.params.templateId],
  );
  const template = row.rows[0];
  if (!template) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  const team = await getTeamWithRole(userId, template.team_id);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  assertWrite(team.role);
  await assertProjectQuota(template.team_id);
  const parsed = stateSchema.safeParse(template.state);
  if (!parsed.success) {
    throw new ApiError(500, 'INTERNAL', 'Stored template state is invalid');
  }
  const result = await pool.query<{ id: string }>(
    `INSERT INTO projects (team_id, name, description, data)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [
      template.team_id,
      name?.trim() || template.name,
      description ?? template.description,
      JSON.stringify(parsed.data),
    ],
  );
  res.status(201).json({ projectId: result.rows[0]?.id });
});
