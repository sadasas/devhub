import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, getUserId } from '../auth/middleware/requireAuth.js';
import { ApiError } from '../app.js';
import { generateMcpKey } from '../mcp/keys.js';
import { isUuid } from './authz.js';

const createKeySchema = z.object({
  name: z.string().trim().max(200).default(''),
});

export const keysRouter = Router();
keysRouter.use(requireAuth);

keysRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query(
    `SELECT id, name, prefix, created_at, last_used_at, revoked_at
     FROM mcp_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  res.json({
    keys: result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      createdAt: r.created_at.toISOString(),
      lastUsedAt: r.last_used_at ? r.last_used_at.toISOString() : null,
      revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
    })),
  });
});

keysRouter.post('/', async (req, res) => {
  const userId = getUserId(req);
  const parsed = createKeySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid key data', parsed.error.issues);
  }
  const { raw, keyHash, prefix } = generateMcpKey();
  // Cap key aktif per user (audit 2026-08b, KEYS-1)
  const active = await pool.query<{ count: string }>(
    'SELECT count(*)::int AS count FROM mcp_keys WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
  if (Number(active.rows[0]?.count ?? 0) >= 10) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Maximum of 10 active API keys reached; revoke one first');
  }
  const result = await pool.query<{ id: string }>(
    'INSERT INTO mcp_keys (user_id, name, key_hash, prefix) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, parsed.data.name, keyHash, prefix],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new ApiError(500, 'INTERNAL', 'Failed to create API key');
  res.status(201).json({
    id,
    name: parsed.data.name,
    prefix,
    key: raw,
    createdAt: new Date().toISOString(),
  });
});

keysRouter.delete('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!isUuid(req.params.id)) throw new ApiError(404, 'NOT_FOUND', 'API key not found');
  const result = await pool.query(
    'UPDATE mcp_keys SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id',
    [req.params.id, userId],
  );
  if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'API key not found');
  res.json({ ok: true });
});
