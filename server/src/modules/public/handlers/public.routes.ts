import { Router } from 'express';
import { ApiError } from '../../../shared/errors.js';
import { logger } from '../../../shared/logger.js';
import { stateSchema, type State } from '../../projects/domain/state.js';
import { normalizePrd } from '../../projects/domain/prd.js';
import { getPublicProject, type PublicProjectRow } from '../../authorization/application/authz.js';
import { normalizeTabs, publicStateKeys } from '../../projects/domain/sharing.js';

export const publicRouter = Router();

function publicProjectJson(row: PublicProjectRow) {
  const tabs = normalizeTabs(row.public_tabs);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    tabs,
    // PRD hanya boleh tampil bila tab 'about' di-publish (audit 2026-08b, PUB-1)
    prd: tabs.includes('about') ? normalizePrd(row.prd) : null,
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