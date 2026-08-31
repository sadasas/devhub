import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { parseOrThrow } from '../../../shared/db.js';
import { exportDocumentSchema } from '../domain/state.js';
import { prdSchema } from '../domain/prd.js';
import { mutateProject } from '../application/entityService.js';
import {
  createProject,
  deleteProject,
  exportProject,
  getProject,
  getProjectDailyStats,
  getProjectNextUp,
  getProjectState,
  getProjectStats,
  importProject,
  listProjectsForUser,
  projectJson,
  putProjectState,
  updateProject,
} from '../application/projectService.js';
import { broadcastSync } from '../../realtime/infrastructure/broadcast.js';

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300),
  description: z.string().max(5_000).default(''),
  teamId: z.string().uuid('Team is required'),
  prd: prdSchema.optional(),
});

const importProjectSchema = exportDocumentSchema.extend({
  teamId: z.string().uuid().optional(),
});

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  const rows = await listProjectsForUser(userId);
  res.json({ projects: rows.map(projectJson) });
});

projectsRouter.get('/stats', async (req, res) => {
  const userId = getUserId(req);
  res.json({ projects: await getProjectStats(userId) });
});

projectsRouter.get('/stats/daily', async (req, res) => {
  const userId = getUserId(req);
  const rawDays = typeof req.query.days === 'string' ? Number.parseInt(req.query.days, 10) : 7;
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 30) : 7;
  res.json({ days: await getProjectDailyStats(userId, days) });
});

projectsRouter.get('/stats/next-up', async (req, res) => {
  const userId = getUserId(req);
  const rawLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 3;
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 20) : 3;
  res.json({ tasks: await getProjectNextUp(userId, limit) });
});

projectsRouter.post('/', async (req, res) => {
  const userId = getUserId(req);
  const input = parseOrThrow(createProjectSchema, req.body, 'Invalid project data');
  const row = await createProject(userId, input);
  res.status(201).json(projectJson(row));
});

projectsRouter.get('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProject(userId, req.params.projectId);
  res.json(projectJson(row));
});

projectsRouter.patch('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  const { row, version } = await updateProject(userId, req.params.projectId, req.body);
  res.json(projectJson(row));
  broadcastSync(req.params.projectId, version);
});

const timelineOrderSchema = z.object({ timelineOrder: z.record(z.string().max(100), z.array(z.string().uuid()).max(5000)).default({}) });

projectsRouter.patch('/:projectId/timeline-order', async (req, res) => {
  const userId = getUserId(req);
  const body = parseOrThrow(timelineOrderSchema, req.body, 'Invalid timeline order');
  const ifMatch = typeof req.headers['if-match'] === 'string' ? req.headers['if-match'].replace(/^"(.*)"$/, '$1') : undefined;
  const { version } = await mutateProject(userId, req.params.projectId, ifMatch, (state) => {
    (state as any).timelineOrder = body.timelineOrder;
  });
  res.json({ ok: true, version });
  broadcastSync(req.params.projectId, version);
});

projectsRouter.delete('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  await deleteProject(userId, req.params.projectId);
  res.json({ ok: true });
});

projectsRouter.get('/:projectId/state', async (req, res) => {
  const userId = getUserId(req);
  const { state, version } = await getProjectState(userId, req.params.projectId);
  // ETag konsisten dengan granular v1 (audit 2026-08b, REST-2)
  res.setHeader('ETag', `"${version}"`);
  res.json({ state, version });
});

projectsRouter.put('/:projectId/state', async (req, res) => {
  const userId = getUserId(req);
  const newVersion = await putProjectState(
    userId,
    req.params.projectId,
    req.body,
    typeof req.headers['if-match'] === 'string' ? req.headers['if-match'] : undefined,
  );
  res.json({ ok: true, version: newVersion });
  broadcastSync(req.params.projectId, newVersion);
});

projectsRouter.get('/:projectId/export', async (req, res) => {
  const userId = getUserId(req);
  const { document, safeName } = await exportProject(userId, req.params.projectId);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="devhub-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(document);
});

projectsRouter.post('/import', async (req, res) => {
  const userId = getUserId(req);
  const input = parseOrThrow(importProjectSchema, req.body, 'Invalid export document');
  const result = await importProject(userId, input);
  if (result.restored) {
    const body: { projectId: string; restored: boolean; version?: number } = {
      projectId: result.projectId,
      restored: true,
    };
    if (input.meta.stateVersion !== undefined) body.version = result.version;
    res.json(body);
    broadcastSync(result.projectId, result.version!);
    return;
  }
  res.status(201).json({ projectId: result.projectId, restored: false });
});