import type { NextFunction, Request, Response } from 'express';
import { pool } from '../../../db/pool.js';
import { ApiError } from '../../../shared/errors.js';
import { hashMcpKey } from '../../keys/infrastructure/keys.js';

export async function requireMcpKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const [scheme, key] = header.split(' ');
  if (scheme !== 'Bearer' || !key) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid MCP API key');
  }
  const result = await pool.query<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM mcp_keys WHERE key_hash = $1 AND revoked_at IS NULL',
    [hashMcpKey(key)],
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid MCP API key');
  }
  req.userId = row.user_id;
  // Throttle penulisan last_used_at (audit 2026-08b, DB-15): maksimal 1x per 5 menit per key
  void pool
    .query(
      `UPDATE mcp_keys SET last_used_at = now()
       WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '5 minutes')`,
      [row.id],
    )
    .catch(() => {});
  next();
}
