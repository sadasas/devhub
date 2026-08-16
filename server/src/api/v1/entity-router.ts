import { Router, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { ApiError } from '../../app.js';
import { parseOrThrow } from '../../lib/db.js';
import { newId, nowIso } from '../../lib/ids.js';
import {
  stateSchema,
  taskSchema,
  issueSchema,
  testCaseSchema,
  techEntrySchema,
  tableSchema,
  relationSchema,
  schemaVersionSchema,
  decisionSchema,
  milestoneSchema,
  apiCollectionSchema,
  apiEndpointSchema,
  whiteboardSchema,
  type State,
} from '../../schema/state.js';
import { getProjectWithRole, assertWrite, type TeamRole } from '../authz.js';
import {
  insertActivity,
  pruneActivity,
  entitySummary,
  type ActivityDraft,
} from '../../lib/activity.js';
import { broadcastDiff } from '../../realtime/broadcast.js';

interface EntityConfig {
  key: keyof State;
  label: string;
  createSchema: z.ZodObject<z.ZodRawShape>;
  patchSchema: z.ZodObject<z.ZodRawShape>;
  onDelete?: (state: State, id: string) => void;
}

function mk(
  key: keyof State,
  label: string,
  schema: z.ZodObject<z.ZodRawShape>,
  onDelete?: (state: State, id: string) => void,
): EntityConfig {
  const createSchema = schema.omit({ createdAt: true, updatedAt: true });
  return { key, label, createSchema, patchSchema: createSchema.partial(), onDelete };
}

const ENTITIES: EntityConfig[] = [
  mk('tasks', 'Task', taskSchema, (state, id) => {
    state.issues = state.issues.map((iss) =>
      iss.linkedTaskId === id ? { ...iss, linkedTaskId: null } : iss,
    );
    state.whiteboards = state.whiteboards.map((w) => ({
      ...w,
      elements: w.elements.filter((el) => !(el.kind === 'ref' && el.entity === 'tasks' && el.entityId === id)),
    }));
  }),
  mk('issues', 'Issue', issueSchema, (state, id) => {
    state.whiteboards = state.whiteboards.map((w) => ({
      ...w,
      elements: w.elements.filter((el) => !(el.kind === 'ref' && el.entity === 'issues' && el.entityId === id)),
    }));
  }),
  mk('testCases', 'Test case', testCaseSchema),
  mk('techEntries', 'Tech entry', techEntrySchema),
  mk('tables', 'Table', tableSchema, (state, id) => {
    state.relations = state.relations.filter((r) => r.fromTableId !== id && r.toTableId !== id);
  }),
  mk('relations', 'Relation', relationSchema),
  mk('schemaVersions', 'Schema version', schemaVersionSchema),
  mk('decisions', 'Decision', decisionSchema),
  mk('milestones', 'Milestone', milestoneSchema, (state, id) => {
    state.tasks = state.tasks.map((t) =>
      t.milestoneId === id ? { ...t, milestoneId: null } : t,
    );
  }),
  mk('apiCollections', 'API collection', apiCollectionSchema, (state, id) => {
    state.apiEndpoints = state.apiEndpoints.map((e) =>
      e.collectionId === id ? { ...e, collectionId: null } : e,
    );
  }),
  mk('apiEndpoints', 'API endpoint', apiEndpointSchema),
  mk('whiteboards', 'Whiteboard', whiteboardSchema),
];

type EntityRow = { id: string; createdAt: string; updatedAt: string } & Record<string, unknown>;

function itemsOf(state: State, key: keyof State): EntityRow[] {
  return state[key] as unknown as EntityRow[];
}

function sorted(items: EntityRow[]): EntityRow[] {
  return [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

async function mutateProject(
  userId: string,
  projectId: string,
  ifMatch: string | undefined,
  fn: (state: State) => ActivityDraft | void,
): Promise<{ version: number; state: State }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ data: unknown; version: number; role: string }>(
      `SELECT p.data, p.version, tm.role
       FROM projects p
       JOIN team_members tm ON tm.team_id = p.team_id
       WHERE p.id = $1 AND tm.user_id = $2
       FOR UPDATE`,
      [projectId, userId],
    );
    const row = result.rows[0];
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    assertWrite(row.role as TeamRole);
    if (ifMatch !== undefined && String(row.version) !== ifMatch) {
      throw new ApiError(
        409,
        'CONFLICT',
        'The project was modified by someone else. Reload to see the latest version.',
        { current: { version: row.version } },
      );
    }
    const parsed = stateSchema.safeParse(row.data);
    if (!parsed.success) throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
    const state = parsed.data;
    const activity = fn(state);
    const after = stateSchema.safeParse(state);
    if (!after.success) {
      throw new ApiError(400, 'BAD_REQUEST', 'Mutation would violate state limits', {
        issues: after.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const updated = await client.query<{ version: number }>(
      'UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1 RETURNING version',
      [projectId, JSON.stringify(state)],
    );
    if (activity) {
      const authorResult = await client.query<{ displayName: string }>(
        'SELECT display_name AS "displayName" FROM users WHERE id = $1',
        [userId],
      );
      const authorName = authorResult.rows[0]?.displayName ?? '';
      await insertActivity(client, {
        projectId,
        draft: activity,
        authorId: userId,
        authorName,
      });
      await pruneActivity(client, projectId);
    }
    await client.query('COMMIT');
    const version = updated.rows[0]?.version;
    if (!version) throw new ApiError(500, 'INTERNAL', 'Failed to persist state');
    return { version, state };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function parseIfMatch(req: { get(name: string): string | undefined }): string | undefined {
  const header = req.get('If-Match');
  if (!header) return undefined;
  return header.trim().replace(/^"(.*)"$/, '$1');
}

function respondEntity(res: Response, version: number, entity: unknown): void {
  res.set('ETag', `"${version}"`);
  res.json({ entity, version });
}

function buildEntityRouter(entities: EntityConfig[]): Router {
  const router = Router();
  router.use(requireAuth);

  for (const cfg of entities) {
    router.get(`/:projectId/${cfg.key}`, async (req, res) => {
      const userId = getUserId(req);
      const row = await getProjectWithRole(userId, req.params.projectId);
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
      const parsed = stateSchema.safeParse(row.data);
      if (!parsed.success) throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
      const all = sorted(itemsOf(parsed.data, cfg.key));
      const after = req.query.after as string | undefined;
      const rawLimit = Number.parseInt(req.query.limit as string, 10);
      const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200);
      let start = 0;
      if (after) {
        const idx = all.findIndex((i) => i.id === after);
        if (idx !== -1) start = idx + 1;
      }
      const slice = all.slice(start, start + limit);
      const nextCursor = start + limit < all.length ? slice[slice.length - 1]?.id : undefined;
      res.set('ETag', `"${row.version}"`);
      res.json({ items: slice, nextCursor: nextCursor ?? null, version: row.version });
    });

    router.post(`/:projectId/${cfg.key}`, async (req, res) => {
      const userId = getUserId(req);
      const payload = parseOrThrow(cfg.createSchema, req.body, `Invalid ${cfg.label.toLowerCase()} data`);
      const id = (payload.id as string | undefined) ?? newId();
      const now = nowIso();
      const entity = { id, createdAt: now, updatedAt: now, ...payload } as EntityRow;
      const { version } = await mutateProject(userId, req.params.projectId, parseIfMatch(req), (state) => {
        const items = itemsOf(state, cfg.key);
        if (items.some((i) => i.id === id)) {
          throw new ApiError(400, 'VALIDATION_ERROR', `${cfg.label} already exists: ${id}`);
        }
        items.push(entity);
        return {
          entity: cfg.key,
          entityId: id,
          action: 'created',
          summary: entitySummary(cfg.key, entity),
          after: entity,
        } satisfies ActivityDraft;
      });
      broadcastDiff(req.params.projectId, {
        type: 'state:diff',
        projectId: req.params.projectId,
        version,
        ops: [{ entity: cfg.key, id, op: 'created', after: entity }],
      });
      res.status(201);
      respondEntity(res, version, entity);
    });

    router.get(`/:projectId/${cfg.key}/:entityId`, async (req, res) => {
      const userId = getUserId(req);
      const row = await getProjectWithRole(userId, req.params.projectId);
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
      const parsed = stateSchema.safeParse(row.data);
      if (!parsed.success) throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
      const item = itemsOf(parsed.data, cfg.key).find((i) => i.id === req.params.entityId);
      if (!item) throw new ApiError(404, 'NOT_FOUND', `${cfg.label} not found`);
      respondEntity(res, row.version, item);
    });

    router.patch(`/:projectId/${cfg.key}/:entityId`, async (req, res) => {
      const userId = getUserId(req);
      const patch = parseOrThrow(cfg.patchSchema, req.body, `Invalid ${cfg.label.toLowerCase()} data`);
      const { version, state } = await mutateProject(userId, req.params.projectId, parseIfMatch(req), (state) => {
        const items = itemsOf(state, cfg.key);
        const idx = items.findIndex((i) => i.id === req.params.entityId);
        if (idx === -1) throw new ApiError(404, 'NOT_FOUND', `${cfg.label} not found: ${req.params.entityId}`);
        const before = items[idx]!;
        const after = { ...before, ...patch, updatedAt: nowIso() } as EntityRow;
        items[idx] = after;
        return {
          entity: cfg.key,
          entityId: req.params.entityId,
          action: 'updated',
          summary: entitySummary(cfg.key, before, before, after),
          before,
          after,
        } satisfies ActivityDraft;
      });
      const item = itemsOf(state, cfg.key).find((i) => i.id === req.params.entityId)!;
      broadcastDiff(req.params.projectId, {
        type: 'state:diff',
        projectId: req.params.projectId,
        version,
        ops: [{ entity: cfg.key, id: req.params.entityId, op: 'updated', after: item }],
      });
      respondEntity(res, version, item);
    });

    router.delete(`/:projectId/${cfg.key}/:entityId`, async (req, res) => {
      const userId = getUserId(req);
      const { version } = await mutateProject(userId, req.params.projectId, parseIfMatch(req), (state) => {
        const items = itemsOf(state, cfg.key);
        const idx = items.findIndex((i) => i.id === req.params.entityId);
        if (idx === -1) throw new ApiError(404, 'NOT_FOUND', `${cfg.label} not found: ${req.params.entityId}`);
        const before = items[idx]!;
        items.splice(idx, 1);
        cfg.onDelete?.(state, req.params.entityId);
        return {
          entity: cfg.key,
          entityId: req.params.entityId,
          action: 'deleted',
          summary: entitySummary(cfg.key, before),
          before,
        } satisfies ActivityDraft;
      });
      broadcastDiff(req.params.projectId, {
        type: 'state:diff',
        projectId: req.params.projectId,
        version,
        ops: [{ entity: cfg.key, id: req.params.entityId, op: 'deleted' }],
      });
      res.set('ETag', `"${version}"`);
      res.json({ ok: true, version });
    });
  }

  return router;
}

export const entityRouter = buildEntityRouter(ENTITIES);
