import { Router } from 'express';
import { ApiError } from '../app.js';
import { stateSchema, emptyState } from '../schema/state.js';
import { normalizePrd } from '../schema/prd.js';
import { getPublicProject, type PublicProjectRow } from './authz.js';

export const publicRouter = Router();

function publicProjectJson(row: PublicProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    prd: normalizePrd(row.prd),
    teamName: row.team_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

publicRouter.get('/projects/:projectId', async (req, res) => {
  const row = await getPublicProject(req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  res.json({ project: publicProjectJson(row) });
});

publicRouter.get('/projects/:projectId/state', async (req, res) => {
  const row = await getPublicProject(req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) {
    console.error(`State validation failed for public project ${req.params.projectId}:`, parsed.error.issues);
    res.json({ state: emptyState });
    return;
  }
  res.json({ state: parsed.data });
});