import 'cookie-parser';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, getUserId } from '../auth/middleware/requireAuth.js';
import { ApiError } from '../app.js';
import { stateSchema, projectStatus, emptyState, exportDocumentSchema } from '../schema/state.js';

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(5_000).default(''),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5_000).optional(),
  status: projectStatus.optional(),
});

const putStateSchema = z.object({
  state: stateSchema,
});

async function getOwnedProject(userId: string, projectId: string) {
  const result = await pool.query(
    'SELECT id, name, description, status, data, created_at, updated_at FROM projects WHERE id = $1 AND owner_id = $2',
    [projectId, userId],
  );
  return result.rows[0] as
    | {
        id: string;
        name: string;
        description: string;
        status: string;
        data: unknown;
        created_at: Date;
        updated_at: Date;
      }
    | undefined;
}

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query(
    `SELECT id, name, description, status, created_at, updated_at
     FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC`,
    [userId],
  );
  res.json({
    projects: result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    })),
  });
});

projectsRouter.post('/', async (req, res) => {
  const userId = getUserId(req);
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid project data', parsed.error.issues);
  }
  const result = await pool.query<{ id: string }>(
    `INSERT INTO projects (owner_id, name, description, data)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
    [userId, parsed.data.name, parsed.data.description, JSON.stringify(emptyState)],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new ApiError(500, 'INTERNAL', 'Failed to create project');
  const row = await getOwnedProject(userId, id);
  res.status(201).json({
    id: row!.id,
    name: row!.name,
    description: row!.description,
    status: row!.status,
    createdAt: row!.created_at.toISOString(),
    updatedAt: row!.updated_at.toISOString(),
  });
});

projectsRouter.get('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getOwnedProject(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  res.json({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
});

projectsRouter.patch('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getOwnedProject(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid project data', parsed.error.issues);
  }
  const { name, description, status } = parsed.data;
  const updated = await pool.query<{ id: string; updated_at: Date }>(
    `UPDATE projects SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       status = COALESCE($4, status),
       updated_at = now()
     WHERE id = $1 AND owner_id = $5
     RETURNING id, updated_at`,
    [req.params.projectId, name ?? null, description ?? null, status ?? null, userId],
  );
  const updatedRow = updated.rows[0];
  if (!updatedRow) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const fresh = await getOwnedProject(userId, req.params.projectId);
  res.json({
    id: fresh!.id,
    name: fresh!.name,
    description: fresh!.description,
    status: fresh!.status,
    createdAt: fresh!.created_at.toISOString(),
    updatedAt: fresh!.updated_at.toISOString(),
  });
});

projectsRouter.delete('/:projectId', async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query(
    'DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING id',
    [req.params.projectId, userId],
  );
  if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  res.json({ ok: true });
});

projectsRouter.get('/:projectId/state', async (req, res) => {
  const userId = getUserId(req);
  const row = await getOwnedProject(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) {
    console.error(`State validation failed for project ${req.params.projectId}:`, parsed.error.issues);
    res.json(emptyState);
    return;
  }
  res.json({ state: parsed.data });
});

projectsRouter.put('/:projectId/state', async (req, res) => {
  const userId = getUserId(req);
  const row = await getOwnedProject(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const parsed = putStateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid state payload', parsed.error.issues);
  }
  await pool.query(
    'UPDATE projects SET data = $3::jsonb, updated_at = now() WHERE id = $1 AND owner_id = $2',
    [req.params.projectId, userId, JSON.stringify(parsed.data.state)],
  );
  res.json({ ok: true });
});

projectsRouter.get('/:projectId/export', async (req, res) => {
  const userId = getUserId(req);
  const row = await getOwnedProject(userId, req.params.projectId);
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
  const parsed = exportDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid export document', parsed.error.issues);
  }
  const { meta, state } = parsed.data;
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
    [meta.projectId, userId],
  );
  if (existing.rows[0]) {
    await pool.query(
      'UPDATE projects SET data = $3::jsonb, updated_at = now() WHERE id = $1 AND owner_id = $2',
      [meta.projectId, userId, JSON.stringify(state)],
    );
    res.json({ projectId: meta.projectId, restored: true });
    return;
  }
  const name = `Imported ${new Date().toISOString().slice(0, 10)}`;
  const result = await pool.query<{ id: string }>(
    'INSERT INTO projects (owner_id, name, description, data) VALUES ($1, $2, $3, $4::jsonb) RETURNING id',
    [userId, name, 'Imported from export document', JSON.stringify(state)],
  );
  res.status(201).json({ projectId: result.rows[0]?.id, restored: false });
});
