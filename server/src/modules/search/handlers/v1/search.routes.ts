import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../../../db/pool.js';
import { requireAuth, getUserId } from '../../../auth/middleware/requireAuth.js';
import { parseOrThrow } from '../../../../shared/db.js';
import { stateSchema } from '../../../projects/domain/state.js';
import {
  searchState,
  DEFAULT_LIMIT,
  PROJECT_HIT_LIMIT,
  type SearchHit,
} from '../../application/search.js';

const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Query must be at least 2 characters').max(200),
  limit: z.coerce.number().int().min(1).max(50).default(DEFAULT_LIMIT),
});

export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  const { q, limit } = parseOrThrow(searchQuerySchema, req.query, 'Invalid search query');
  const result = await pool.query<{ id: string; name: string; data: unknown }>(
    `SELECT p.id, p.name, p.data
     FROM projects p
     JOIN team_members tm ON tm.team_id = p.team_id
     WHERE tm.user_id = $1
     ORDER BY p.updated_at DESC
     LIMIT 100`,
    [userId],
  );
  const results: Array<{ projectId: string; projectName: string; hits: SearchHit[] }> = [];
  let collected = 0;
  for (const row of result.rows) {
    if (collected >= limit) break;
    const parsed = stateSchema.safeParse(row.data);
    if (!parsed.success) continue;
    const hits = searchState(parsed.data, q).slice(0, Math.min(PROJECT_HIT_LIMIT, limit - collected));
    if (hits.length === 0) continue;
    collected += hits.length;
    results.push({ projectId: row.id, projectName: row.name, hits });
  }
  res.json({ results });
});
