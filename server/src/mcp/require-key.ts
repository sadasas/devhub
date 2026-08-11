import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { ApiError } from '../app.js';
import { hashMcpKey } from './keys.js';

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
  void pool.query('UPDATE mcp_keys SET last_used_at = now() WHERE id = $1', [row.id]).catch(() => {});
  next();
}
