import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../../../db/pool.js';
import { requireAuth, getUserId } from '../../../auth/middleware/requireAuth.js';
import { ApiError } from '../../../../shared/errors.js';
import { parseOrThrow } from '../../../../shared/db.js';
import { getProjectWithRole } from '../../../authorization/application/authz.js';
import type { ActivityEntry } from '../../application/activity.js';
import { STATE_COLLECTIONS } from '../../application/activity.js';
import {
  READABLE_TABS,
  getUnreadSummary,
  setWatermark,
} from '../../application/unread.js';

const querySchema = z.object({
  // Filter entity divalidasi terhadap koleksi state yang dikenal (audit 2026-08b, REST-6)
  entity: z.enum(STATE_COLLECTIONS).optional(),
  entityId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

const watermarkTabSchema = z.enum(READABLE_TABS);

export const activityRouter = Router();

activityRouter.use(requireAuth);

activityRouter.get('/:projectId/activity', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProjectWithRole(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');

  const query = parseOrThrow(querySchema, req.query, 'Invalid activity query');
  const conditions = ['project_id = $1'];
  const params: unknown[] = [req.params.projectId];
  if (query.entity) {
    params.push(query.entity);
    conditions.push(`entity = $${params.length}`);
  }
  if (query.entityId) {
    params.push(query.entityId);
    conditions.push(`entity_id = $${params.length}`);
  }
  if (query.authorId) {
    params.push(query.authorId);
    conditions.push(`author_id = $${params.length}`);
  }
  if (query.before) {
    params.push(query.before);
    conditions.push(`created_at < $${params.length}`);
  }
  params.push(query.limit);

  const result = await pool.query<ActivityEntry>(
    `SELECT id, project_id AS "projectId", entity, entity_id AS "entityId", action,
            author_id AS "authorId", author_name AS "authorName", summary, changes, created_at AS "createdAt"
     FROM activity_log
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  // nextCursor untuk load-more (audit 2026-08b, REST-3) — konsisten dengan chat/entity list
  const last = result.rows[result.rows.length - 1];
  res.json({
    items: result.rows,
    nextCursor: last && result.rows.length === query.limit ? last.createdAt : null,
  });
});

// Badge unread server-side (ADR M32): watermark dibaca dari DB, agregat SQL.
activityRouter.get('/:projectId/activity/unread', async (req, res) => {
  const userId = getUserId(req);
  const row = await getProjectWithRole(userId, req.params.projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  res.json(await getUnreadSummary(userId, req.params.projectId));
});

// Tandai tab sudah dibaca sampai sekarang (server yang menulis timestamp).
activityRouter.put('/:projectId/read-watermarks/:tab', async (req, res) => {
  const userId = getUserId(req);
  const projectId = req.params.projectId;
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const { tab } = parseOrThrow(z.object({ tab: watermarkTabSchema }), req.params, 'Invalid tab');
  await setWatermark(userId, projectId, tab);
  res.json({ ok: true });
});
