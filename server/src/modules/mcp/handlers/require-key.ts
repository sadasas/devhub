import type { NextFunction, Request, Response } from 'express';
import { pool } from '../../../db/pool.js';
import { ApiError } from '../../../shared/errors.js';
import { hashMcpKey } from '../../keys/infrastructure/keys.js';

export async function requireMcpKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  const base = `${req.protocol}://${req.get('host')}`;
  const wwwAuth = `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`;
  if (scheme !== 'Bearer' || !token) {
    res.setHeader('WWW-Authenticate', wwwAuth);
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid MCP credentials');
  }

  // 1) Try legacy API key (mcp_keys)
  const keyResult = await pool.query<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM mcp_keys WHERE key_hash = $1 AND revoked_at IS NULL',
    [hashMcpKey(token)],
  );
  const keyRow = keyResult.rows[0];
  if (keyRow) {
    req.userId = keyRow.user_id;
    // Throttle penulisan last_used_at (audit 2026-08b, DB-15): maksimal 1x per 5 menit per key
    void pool
      .query(
        `UPDATE mcp_keys SET last_used_at = now()
         WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '5 minutes')`,
        [keyRow.id],
      )
      .catch(() => {});
    next();
    return;
  }

  // 2) Try OAuth access token
  const oauthResult = await pool.query<{ user_id: string; scope: string; expires_at: string }>(
    'SELECT user_id, scope, expires_at FROM oauth_access_tokens WHERE token = $1',
    [token],
  );
  const oauthRow = oauthResult.rows[0];
  if (oauthRow) {
    if (new Date(oauthRow.expires_at).getTime() < Date.now()) {
      res.setHeader('WWW-Authenticate', `${wwwAuth}, error="invalid_token", error_description="token expired"`);
      throw new ApiError(401, 'UNAUTHORIZED', 'OAuth token expired');
    }
    // Scope check: require at least mcp or mcp:read/write
    const scopes = oauthRow.scope.split(' ').filter(Boolean);
    if (!scopes.includes('mcp') && !scopes.includes('mcp:read') && !scopes.includes('mcp:write')) {
      throw new ApiError(403, 'FORBIDDEN', 'Insufficient OAuth scope');
    }
    req.userId = oauthRow.user_id;
    next();
    return;
  }

  // Neither matched -> 401 with WWW-Authenticate hint (RFC9728)
  res.setHeader('WWW-Authenticate', wwwAuth);
  throw new ApiError(401, 'UNAUTHORIZED', 'Invalid MCP credentials');
}
