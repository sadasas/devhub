import { Router } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { pool } from '../../db/pool.js';
import { config } from '../../config.js';
import { ApiError } from '../../shared/errors.js';
import { parseOrThrow } from '../../shared/db.js';
import { getBaseUrl as baseUrl } from '../../shared/baseUrl.js';
import { verifySession } from '../auth/infrastructure/jwt.js';
import { SESSION_COOKIE } from '../../shared/http.js';

export const oauthRouter = Router();

function generateToken(prefix = ''): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

function sha256Base64Url(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}

// --- Discovery: RFC8414 + RFC9728 ---
oauthRouter.get('/.well-known/oauth-authorization-server', (req, res) => {
  const base = baseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    scopes_supported: ['mcp', 'mcp:read', 'mcp:write'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
});

// RFC9728 protected resource metadata
oauthRouter.get('/.well-known/oauth-protected-resource', (req, res) => {
  const base = baseUrl(req);
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ['mcp', 'mcp:read', 'mcp:write'],
    bearer_methods_supported: ['header'],
  });
});

// Also serve at /mcp/.well-known for some clients
oauthRouter.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
  const base = baseUrl(req);
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
  });
});

// --- Dynamic Client Registration RFC7591 ---
const registerSchema = z.object({
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  client_name: z.string().max(200).optional(),
  client_uri: z.string().url().optional(),
});

/** Loopback http (dengan/tanpa port eksplisit) — bukan remote. */
export function isLoopbackOrigin(origin: string): boolean {
  return (
    origin === "http://localhost" ||
    origin === "http://127.0.0.1" ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}

/**
 * Allowlist DCR (C1): loopback SELALU lolos di semua environment
 * (RFC 8252 §7.3 — callback aplikasi native tidak pernah meninggalkan
 * mesin user, port berapa pun; CLI MCP memakai port acak), origin lain
 * wajib ada di APP_PUBLIC_URL / OAUTH_REDIRECT_ORIGINS.
 */
export function isDcrRedirectAllowed(origin: string, allowedOrigins: ReadonlySet<string>): boolean {
  if (isLoopbackOrigin(origin)) return true;
  return allowedOrigins.has(origin);
}

oauthRouter.post('/oauth/register', async (req, res) => {
  const parsed = parseOrThrow(registerSchema, req.body, 'Invalid client metadata');
  // DCR allowlist (C1): APP_PUBLIC_URL / OAUTH_REDIRECT_ORIGINS + loopback
  // (isDcrRedirectAllowed). Mencegah registrasi evil.com.
  const allowedOrigins = new Set<string>();
  if (config.APP_PUBLIC_URL) { try { allowedOrigins.add(new URL(config.APP_PUBLIC_URL).origin); } catch {} }
  for (const o of config.OAUTH_REDIRECT_ORIGINS) { try { allowedOrigins.add(new URL(o).origin); } catch {} }
  for (const uri of parsed.redirect_uris) {
    let origin: string;
    try { origin = new URL(uri).origin; } catch { throw new ApiError(400, 'INVALID_REQUEST', `Invalid redirect_uri: ${uri}`); }
    if (!isDcrRedirectAllowed(origin, allowedOrigins)) {
      throw new ApiError(400, 'INVALID_REQUEST', `redirect_uri origin not allowed: ${origin}`);
    }
  }
  const clientId = `devhub_${randomBytes(16).toString('hex')}`;
  const clientSecret = null; // public clients - PKCE only, no secret per OAuth 2.1
  await pool.query(
    'INSERT INTO oauth_clients (client_id, client_secret, redirect_uris, client_name, client_uri) VALUES ($1,$2,$3,$4,$5)',
    [clientId, clientSecret, parsed.redirect_uris, parsed.client_name ?? null, parsed.client_uri ?? null],
  );
  // For public clients (PKCE, token_endpoint_auth_method=none), omit client_secret entirely
  // opencode's zod expects string if present, so don't send null
  const response: Record<string, unknown> = {
    client_id: clientId,
    redirect_uris: parsed.redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
  if (parsed.client_name) response.client_name = parsed.client_name;
  res.status(201).json(response);
});

// --- Authorization endpoint ---
const authorizeSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().max(200).optional().default('mcp'),
  state: z.string().max(500).optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  resource: z.string().max(500).optional(),
});

oauthRouter.get('/oauth/authorize', async (req, res) => {
  const parsed = parseOrThrow(authorizeSchema, req.query, 'Invalid authorization request');

  // Validate client
  const clientRes = await pool.query<{ redirect_uris: string[] }>(
    'SELECT redirect_uris FROM oauth_clients WHERE client_id = $1',
    [parsed.client_id],
  );
  const client = clientRes.rows[0];
  if (!client) throw new ApiError(400, 'INVALID_CLIENT', 'Unknown client_id');

  // Validate redirect_uri exact match (OAuth 2.1)
  if (!client.redirect_uris.includes(parsed.redirect_uri)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'redirect_uri mismatch');
  }

  // Validate scope
  const allowedScopes = ['mcp', 'mcp:read', 'mcp:write'];
  const requestedScopes = parsed.scope.split(' ').filter(Boolean);
  for (const s of requestedScopes) {
    if (!allowedScopes.includes(s)) throw new ApiError(400, 'INVALID_SCOPE', `Unsupported scope: ${s}`);
  }

  // Check session - custom form login creates httpOnly cookie
  const token = (req.cookies as Record<string, string | undefined>)?.[SESSION_COOKIE];
  const userId = await verifySession(token);
  if (!userId) {
    // Not logged in - redirect to frontend login with returnTo (for OAuth flow)
    // Frontend is at APP_PUBLIC_URL origin or localhost:5173
    const frontendOrigin = (() => {
      if (config.APP_PUBLIC_URL) {
        try {
          return new URL(config.APP_PUBLIC_URL).origin;
        } catch {
          return 'http://localhost:5173';
        }
      }
      return 'http://localhost:5173';
    })();
    const authorizeUrl = `${baseUrl(req)}${req.originalUrl}`;
    const loginUrl = new URL('/login', frontendOrigin);
    loginUrl.searchParams.set('returnTo', authorizeUrl);
    const acceptsHtml = (req.headers.accept || '').includes('text/html');
    if (acceptsHtml) {
      res.redirect(302, loginUrl.toString());
      return;
    }
    throw new ApiError(401, 'UNAUTHORIZED', `Login required. Go to ${loginUrl.toString()}`);
  }

  // Consent check (C1): require ?consent=allow or POST consent. Without consent, return need_consent hint.
  // Clients like opencode can show consent UI; browser flow will redirect to /login?returnTo with consent param.
  const consent = (req.query.consent as string | undefined)?.toLowerCase();
  const hasConsentHeader = req.headers['x-oauth-consent'] === 'allow';
  if (consent !== 'allow' && !hasConsentHeader) {
    // Check if client was already consented by this user (remember consent per client+user)
    const consented = await pool.query('SELECT 1 FROM oauth_consents WHERE user_id=$1 AND client_id=$2', [userId, parsed.client_id]);
    if (!consented.rows[0]) {
      const acceptsHtml = (req.headers.accept || '').includes('text/html');
      if (acceptsHtml) {
        // Simple HTML consent page — no extra deps
        const clientName = parsed.client_id;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><title>Authorize ${clientName}</title></head><body style="font-family:system-ui;padding:2rem;max-width:480px;margin:auto"><h2>Authorize ${clientName}?</h2><p>Scope: <code>${parsed.scope}</code></p><p>This app will have access to your projects via MCP.</p><a href="${baseUrl(req)}${req.originalUrl}${req.originalUrl.includes('?') ? '&' : '?'}consent=allow" style="display:inline-block;padding:0.6rem 1.2rem;background:#0e7a4a;color:#fff;border-radius:6px;text-decoration:none">Allow</a> <a href="/" style="margin-left:1rem">Deny</a></body></html>`);
        return;
      }
      // Non-browser (MCP client) — return structured hint instead of auto-approve
      res.status(403).json({ error: { code: 'CONSENT_REQUIRED', message: 'User consent required. Retry with ?consent=allow or X-OAuth-Consent: allow header after user approval.' } });
      return;
    }
  }
  // Remember consent for future auto-approve
  await pool.query('INSERT INTO oauth_consents (user_id, client_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, parsed.client_id]);
  const code = generateToken('devhub_code_');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await pool.query(
    `INSERT INTO oauth_authorization_codes 
     (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, resource, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      code,
      parsed.client_id,
      userId,
      parsed.redirect_uri,
      parsed.scope,
      parsed.code_challenge,
      parsed.code_challenge_method,
      parsed.resource ?? null,
      expiresAt,
    ],
  );

  const redirect = new URL(parsed.redirect_uri);
  redirect.searchParams.set('code', code);
  if (parsed.state) redirect.searchParams.set('state', parsed.state);
  res.redirect(302, redirect.toString());
});

// --- Token endpoint ---
oauthRouter.post('/oauth/token', async (req, res) => {
  // Support both json and x-www-form-urlencoded
  const body = req.body ?? {};
  const grantType = body.grant_type as string | undefined;

  if (grantType === 'authorization_code') {
    const schema = z.object({
      grant_type: z.literal('authorization_code'),
      code: z.string().min(1),
      redirect_uri: z.string().url(),
      client_id: z.string().min(1),
      code_verifier: z.string().min(43).max(128),
      resource: z.string().optional(),
    });
    const parsed = parseOrThrow(schema, body, 'Invalid token request');

    const atom = await pool.query<{
      code: string;
      client_id: string;
      user_id: string;
      redirect_uri: string;
      scope: string;
      code_challenge: string;
      expires_at: string;
      used_at: string | null;
      resource: string | null;
    }>('UPDATE oauth_authorization_codes SET used_at = now() WHERE code = $1 AND used_at IS NULL AND expires_at > now() RETURNING *', [parsed.code]);

    const row = atom.rows[0];
    if (!row) throw new ApiError(400, 'INVALID_GRANT', 'Invalid code, already used or expired');
    if (row.client_id !== parsed.client_id) throw new ApiError(400, 'INVALID_GRANT', 'client_id mismatch');
    if (row.redirect_uri !== parsed.redirect_uri) throw new ApiError(400, 'INVALID_GRANT', 'redirect_uri mismatch');

    // Verify PKCE S256
    const expectedChallenge = sha256Base64Url(parsed.code_verifier);
    if (expectedChallenge !== row.code_challenge) {
      throw new ApiError(400, 'INVALID_GRANT', 'PKCE verification failed');
    }

    const accessToken = generateToken('devhub_at_');
    const refreshToken = generateToken('devhub_rt_');
    const tokenHash = createHash('sha256').update(accessToken).digest('hex');
    const refreshHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresIn = 15 * 60; // 15 min
    const refreshExpiresIn = 30 * 24 * 60 * 60; // 30 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    await pool.query(
      `INSERT INTO oauth_access_tokens 
       (token, token_hash, client_id, user_id, scope, resource, expires_at, refresh_token, refresh_token_hash, refresh_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [accessToken, tokenHash, parsed.client_id, row.user_id, row.scope, row.resource, expiresAt, refreshToken, refreshHash, refreshExpiresAt],
    );

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: row.scope,
    });
    return;
  }

  if (grantType === 'refresh_token') {
    const schema = z.object({
      grant_type: z.literal('refresh_token'),
      refresh_token: z.string().min(1),
      client_id: z.string().min(1),
      scope: z.string().optional(),
    });
    const parsed = parseOrThrow(schema, body, 'Invalid refresh request');

    const refreshHash = createHash('sha256').update(parsed.refresh_token).digest('hex');
    const tokenRes = await pool.query<{
      token: string;
      client_id: string;
      user_id: string;
      scope: string;
      resource: string | null;
      refresh_expires_at: string;
    }>('SELECT * FROM oauth_access_tokens WHERE refresh_token_hash = $1 OR refresh_token = $1', [refreshHash]);

    // fallback: if lookup by hash failed, try plaintext hash comparison via app (for rows not yet backfilled)
    let row = tokenRes.rows[0];
    if (!row) {
      const fallback = await pool.query<{
        token: string;
        client_id: string;
        user_id: string;
        scope: string;
        resource: string | null;
        refresh_expires_at: string;
        refresh_token: string;
      }>('SELECT * FROM oauth_access_tokens WHERE refresh_token = $1', [parsed.refresh_token]);
      row = fallback.rows[0];
      if (!row) throw new ApiError(400, 'INVALID_GRANT', 'Invalid refresh_token');
    }
    if (!row) throw new ApiError(400, 'INVALID_GRANT', 'Invalid refresh_token');
    if (new Date(row.refresh_expires_at).getTime() < Date.now())
      throw new ApiError(400, 'INVALID_GRANT', 'Refresh token expired');
    if (row.client_id !== parsed.client_id) throw new ApiError(400, 'INVALID_GRANT', 'client_id mismatch');

    // Rotation: invalidate old, issue new (delete by hash or plaintext)
    await pool.query('DELETE FROM oauth_access_tokens WHERE refresh_token_hash = $1 OR refresh_token = $1', [refreshHash]);
    await pool.query('DELETE FROM oauth_access_tokens WHERE refresh_token = $1', [parsed.refresh_token]).catch(() => {});

    const newAccess = generateToken('devhub_at_');
    const newRefresh = generateToken('devhub_rt_');
    const expiresIn = 15 * 60;
    const refreshExpiresIn = 30 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);
    // Scope narrowing allowed, not widening
    let newScope = row.scope;
    if (parsed.scope) {
      const requested = new Set(parsed.scope.split(' ').filter(Boolean));
      const original = new Set(row.scope.split(' ').filter(Boolean));
      for (const s of requested) if (!original.has(s)) throw new ApiError(400, 'INVALID_SCOPE', `Cannot widen scope: ${s}`);
      newScope = [...requested].join(' ') || row.scope;
    }

    const newAccessHash = createHash('sha256').update(newAccess).digest('hex');
    const newRefreshHash = createHash('sha256').update(newRefresh).digest('hex');
    await pool.query(
      `INSERT INTO oauth_access_tokens 
       (token, token_hash, client_id, user_id, scope, resource, expires_at, refresh_token, refresh_token_hash, refresh_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [newAccess, newAccessHash, parsed.client_id, row.user_id, newScope, row.resource, expiresAt, newRefresh, newRefreshHash, refreshExpiresAt],
    );

    res.json({
      access_token: newAccess,
      token_type: 'Bearer',
      expires_in: expiresIn,
      refresh_token: newRefresh,
      scope: newScope,
    });
    return;
  }

  throw new ApiError(400, 'UNSUPPORTED_GRANT_TYPE', 'grant_type must be authorization_code or refresh_token');
});


 // --- Authorized Apps (for dashboard) ---
oauthRouter.get('/oauth/authorized-apps', async (req, res) => {
  const token = (req.cookies as Record<string, string | undefined>)?.[SESSION_COOKIE];
  const userId = await verifySession(token);
  if (!userId) throw new ApiError(401, 'UNAUTHORIZED', 'Login required');
  const result = await pool.query(
    `SELECT 
       c.client_id, c.client_name, c.redirect_uris, c.created_at as client_created,
       t.token, t.scope, t.resource, t.expires_at, t.created_at as token_created
     FROM oauth_access_tokens t
     JOIN oauth_clients c ON c.client_id = t.client_id
     WHERE t.user_id = $1 AND t.expires_at > now()
     ORDER BY t.created_at DESC`,
    [userId],
  );
  const apps = result.rows.map((r: any) => ({
    clientId: r.client_id,
    clientName: r.client_name || 'Unknown App',
    redirectUris: r.redirect_uris,
    scope: r.scope,
    resource: r.resource,
    tokenPrefix: r.token.slice(0, 8) + '...',
    expiresAt: r.expires_at,
    createdAt: r.token_created,
  }));
  res.json({ apps, total: apps.length });
});

oauthRouter.delete('/oauth/authorized-apps/:clientId', async (req, res) => {
  const token = (req.cookies as Record<string, string | undefined>)?.[SESSION_COOKIE];
  const userId = await verifySession(token);
  if (!userId) throw new ApiError(401, 'UNAUTHORIZED', 'Login required');
  const clientId = req.params.clientId;
  const result = await pool.query(
    'DELETE FROM oauth_access_tokens WHERE client_id = $1 AND user_id = $2 RETURNING token',
    [clientId, userId],
  );
  // Also delete codes for that client/user
  await pool.query('DELETE FROM oauth_authorization_codes WHERE client_id = $1 AND user_id = $2', [clientId, userId]);
  res.json({ ok: true, revoked: result.rowCount });
});

// Optional revoke
oauthRouter.post('/oauth/revoke', async (req, res) => {
  const schema = z.object({
    token: z.string().min(1),
    token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
  });
  const parsed = parseOrThrow(schema, req.body, 'Invalid revoke request');
  await pool.query('DELETE FROM oauth_access_tokens WHERE token = $1 OR refresh_token = $1', [parsed.token]);
  res.json({ ok: true });
});

