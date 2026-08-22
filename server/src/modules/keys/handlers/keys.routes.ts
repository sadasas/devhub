import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { pool } from '../../../db/pool.js';
import { parseOrThrow } from '../../../shared/db.js';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { ApiError } from '../../../shared/errors.js';
import { generateMcpKey } from '../infrastructure/keys.js';
import { encryptKey, decryptKey } from '../infrastructure/key-crypto.js';
import { isUuid } from '../../authorization/application/authz.js';

// Nama wajib (audit 2026-08b): key tanpa nama tidak bisa dibedakan di list
const createKeySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
});

// Reveal = akses penuh ke secret; rate limit per-IP (pola loginLimiter)
const revealLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many reveal attempts, try again later' } },
});

// Pagination gaya GitHub settings/tokens (ADR: list active-only + pagination)
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(20).default(5),
});

export const keysRouter = Router();
keysRouter.use(requireAuth);

// List hanya key aktif (pola GitHub): revoked tetap di DB untuk audit,
// tapi tidak pernah dikembalikan ke UI.
keysRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  const { page, perPage } = parseOrThrow(listQuerySchema, req.query, 'Invalid query parameters');
  const counted = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM mcp_keys WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
  const result = await pool.query(
    `SELECT id, name, prefix, created_at, last_used_at, key_enc IS NOT NULL AS revealable
     FROM mcp_keys
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [userId, perPage, (page - 1) * perPage],
  );
  res.json({
    keys: result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      createdAt: r.created_at.toISOString(),
      lastUsedAt: r.last_used_at ? r.last_used_at.toISOString() : null,
      revealable: Boolean(r.revealable),
    })),
    total: counted.rows[0]?.count ?? 0,
    page,
    perPage,
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
    'INSERT INTO mcp_keys (user_id, name, key_hash, prefix, key_enc) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [userId, parsed.data.name, keyHash, prefix, encryptKey(raw)],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new ApiError(500, 'INTERNAL', 'Failed to create API key');
  res.status(201).json({
    id,
    name: parsed.data.name,
    prefix,
    key: raw,
    createdAt: new Date().toISOString(),
    revealable: true,
  });
});

keysRouter.get('/:id/reveal', revealLimiter, async (req, res) => {
  const userId = getUserId(req);
  const id = req.params.id as string;
  if (!isUuid(id)) throw new ApiError(404, 'NOT_FOUND', 'API key not found');
  const result = await pool.query<{ key_enc: string | null; revoked_at: Date | null }>(
    'SELECT key_enc, revoked_at FROM mcp_keys WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  const row = result.rows[0];
  // key_enc NULL = key dibuat sebelum enkripsi (tidak bisa di-reveal)
  if (!row || !row.key_enc) throw new ApiError(404, 'NOT_FOUND', 'API key not found');
  if (row.revoked_at) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Revoked keys cannot be revealed');
  }
  let key: string;
  try {
    key = decryptKey(row.key_enc);
  } catch {
    throw new ApiError(404, 'NOT_FOUND', 'API key not found');
  }
  res.json({ key });
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
