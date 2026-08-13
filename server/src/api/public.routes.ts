import { Router } from 'express';
import { ApiError } from '../app.js';
import { logger } from '../lib/logger.js';
import { stateSchema, type State } from '../schema/state.js';
import { normalizePrd } from '../schema/prd.js';
import { getPublicProject, type PublicProjectRow } from './authz.js';
import { normalizeTabs, publicStateKeys } from './sharing.js';

export const publicRouter = Router();

function publicProjectJson(row: PublicProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    tabs: normalizeTabs(row.public_tabs),
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
    logger.error('State validation failed on public read', {
      requestId: req.id,
      projectId: req.params.projectId,
      issues: parsed.error.issues,
    });
    throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
  }
  const allowed = publicStateKeys(normalizeTabs(row.public_tabs));
  const filtered = { ...parsed.data } as Record<string, unknown>;
  for (const key of Object.keys(filtered) as Array<keyof State>) {
    if (!allowed.has(key)) filtered[key] = [];
  }
  res.json({ state: filtered as State, version: row.version });
});