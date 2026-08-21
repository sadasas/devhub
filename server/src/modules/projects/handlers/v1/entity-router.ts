import { Router, type Response } from 'express';
import { requireAuth, getUserId } from '../../../auth/middleware/requireAuth.js';
import { ApiError } from '../../../../shared/errors.js';
import { parseOrThrow } from '../../../../shared/db.js';
import { nowIso } from '../../../../shared/ids.js';
import { stateSchema } from '../../domain/state.js';
import { deriveActualHours } from '../../domain/hours.js';
import { getProjectWithRole } from '../../../authorization/application/authz.js';
import { entitySummary, type ActivityDraft } from '../../../activity/application/activity.js';
import { broadcastDiff } from '../../../realtime/infrastructure/broadcast.js';
import { mutateProject } from '../../application/entityService.js';
import {
  ENTITIES,
  deriveTaskPatch,
  itemsOf,
  sorted,
  type EntityConfig,
  type EntityRow,
} from '../../domain/entities.js';

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
      // id wajib client-generated (baseFields.id uuid) — pola offline-first
      const id = payload.id as string;
      const now = nowIso();
      const entity = { id, createdAt: now, updatedAt: now, ...payload } as EntityRow;
      if (cfg.key === 'tasks' && entity.status === 'done') {
        if (entity.completedAt === undefined) entity.completedAt = now;
        if (entity.completedAt != null && entity.actualHours === undefined) {
          entity.actualHours = deriveActualHours({
            completedAt: String(entity.completedAt),
            createdAt: now,
            startDate: entity.startDate as string | null | undefined,
          });
        }
      }
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
      const presentKeys = new Set(Object.keys((req.body ?? {}) as Record<string, unknown>));
      const filteredPatch = Object.fromEntries(
        Object.entries(patch).filter(([key]) => presentKeys.has(key)),
      );
      const { version, state } = await mutateProject(userId, req.params.projectId, parseIfMatch(req), (state) => {
        const items = itemsOf(state, cfg.key);
        const idx = items.findIndex((i) => i.id === req.params.entityId);
        if (idx === -1) throw new ApiError(404, 'NOT_FOUND', `${cfg.label} not found: ${req.params.entityId}`);
        const before = items[idx]!;
        const after = {
          ...before,
          ...(cfg.key === 'tasks' ? deriveTaskPatch(before, filteredPatch) : filteredPatch),
          updatedAt: nowIso(),
        } as EntityRow;
        items[idx] = after;
        return {
          entity: cfg.key,
          entityId: req.params.entityId,
          action: 'updated',
          summary: entitySummary(cfg.key, before, before, after),
          before,
          after,
        };
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
        };
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