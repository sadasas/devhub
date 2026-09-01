import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes, createHash } from 'node:crypto';
import { pool } from '../../../db/pool.js';
import { config } from '../../../config.js';
import { ApiError } from '../../../shared/errors.js';
import { withTransaction } from '../../../shared/db.js';
import { requireAuth, getUserId } from '../middleware/requireAuth.js';
import {
  setSessionCookie,
  setOAuthStateCookie,
  clearOAuthStateCookie,
  OAUTH_STATE_COOKIE_PREFIX,
} from '../../../shared/cookie.js';
import { SESSION_COOKIE } from '../../../shared/http.js';
import { verifySession } from '../infrastructure/jwt.js';

export const socialRouter = Router();

const socialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many OAuth attempts' } },
});

function baseUrl(req: import('express').Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${config.PORT}`;
  return `${proto}://${host}`;
}

function frontendOrigin(): string {
  if (config.APP_PUBLIC_URL) {
    try {
      return new URL(config.APP_PUBLIC_URL).origin;
    } catch {
      // fallthrough
    }
  }
  return 'http://localhost:5173';
}

function isValidReturnTo(rt: string | null): string | null {
  if (!rt) return null;
  try {
    // Allow backend OAuth authorize flow + any https (for now) + localhost frontend
    if (rt.startsWith('http://localhost:3000/oauth/authorize')) return rt;
    if (rt.startsWith('http://localhost:5173')) return rt;
    if (rt.startsWith('https://')) return rt;
    return null;
  } catch {
    return null;
  }
}

function getReturnToFromReq(req: import('express').Request): string | null {
  const rt = (req.query.returnTo as string | undefined) ?? (req.query.return_to as string | undefined) ?? null;
  return isValidReturnTo(rt);
}

function getOAuthStateCookie(req: import('express').Request, provider: 'google' | 'github'): { state: string; codeVerifier: string; returnTo: string | null } | null {
  const raw = (req.cookies as Record<string, string | undefined>)?.[`${OAUTH_STATE_COOKIE_PREFIX}${provider}`];
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as { state: string; codeVerifier: string; returnTo: string | null };
    if (!parsed.state || !parsed.codeVerifier) return null;
    return parsed;
  } catch {
    return null;
  }
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function generateState(): string {
  return randomBytes(16).toString('base64url');
}

// --- Public: which providers are enabled ---
socialRouter.get('/providers', (req, res) => {
  const googleEnabled = Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  const githubEnabled = Boolean(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET);
  res.json({
    providers: [
      ...(googleEnabled ? [{ id: 'google', enabled: true }] : []),
      ...(githubEnabled ? [{ id: 'github', enabled: true }] : []),
    ],
    google: googleEnabled,
    github: githubEnabled,
  });
});

// --- Linked accounts (auth) ---
socialRouter.get('/linked', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query<{ provider: string; provider_account_id: string; email: string | null; avatar_url: string | null; created_at: string }>(
    'SELECT provider, provider_account_id, email, avatar_url, created_at FROM oauth_accounts WHERE user_id = $1 ORDER BY created_at',
    [userId],
  );
  res.json({ linked: result.rows });
});

socialRouter.delete('/linked/:provider', requireAuth, async (req, res) => {
  const provider = req.params.provider as string;
  if (!['google', 'github'].includes(provider)) throw new ApiError(400, 'INVALID_PROVIDER', 'Provider must be google or github');
  const userId = getUserId(req);
  const linkedRes = await pool.query<{ provider: string }>('SELECT provider FROM oauth_accounts WHERE user_id = $1', [userId]);
  const providers = linkedRes.rows.map((r) => r.provider);
  if (!providers.includes(provider)) throw new ApiError(404, 'NOT_FOUND', 'Account not linked');
  const userRes = await pool.query<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const hasPassword = userRes.rows[0]?.password_hash !== null;
  // Guard: minimal 1 method must remain
  const remainingProviders = providers.filter((p) => p !== provider);
  if (!hasPassword && remainingProviders.length === 0) {
    throw new ApiError(400, 'LAST_AUTH_METHOD', 'Cannot unlink last auth method. Set a password first.');
  }
  await pool.query('DELETE FROM oauth_accounts WHERE user_id = $1 AND provider = $2', [userId, provider]);
  res.json({ ok: true });
});

// --- Google start ---
socialRouter.get('/google', socialLimiter, (req, res) => {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) throw new ApiError(500, 'OAUTH_NOT_CONFIGURED', 'Google OAuth not configured');
  const returnTo = getReturnToFromReq(req);
  const state = generateState();
  const { verifier, challenge } = generatePkce();
  setOAuthStateCookie(res, 'google', state, verifier, returnTo);
  const redirectUri = `${baseUrl(req)}/api/v1/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'select_account',
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(302, url);
});

// --- GitHub start ---
socialRouter.get('/github', socialLimiter, (req, res) => {
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) throw new ApiError(500, 'OAUTH_NOT_CONFIGURED', 'GitHub OAuth not configured');
  const returnTo = getReturnToFromReq(req);
  const state = generateState();
  const { verifier, challenge } = generatePkce();
  setOAuthStateCookie(res, 'github', state, verifier, returnTo);
  const redirectUri = `${baseUrl(req)}/api/v1/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'user:email read:user',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.redirect(302, url);
});

// Helpers for OAuth user handling
type ProviderProfile = {
  provider: 'google' | 'github';
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
};

async function handleOAuthLogin(res: import('express').Response, profile: ProviderProfile): Promise<{ userId: string; jwtVersion: number }> {
  const email = profile.email.trim().toLowerCase();
  // 1) Check if oauth_accounts already linked
  const existingLink = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2',
    [profile.provider, profile.providerAccountId],
  );
  if (existingLink.rows[0]) {
    const uid = existingLink.rows[0].user_id;
    // Update avatar/email if changed
    await pool.query('UPDATE oauth_accounts SET email = $3, avatar_url = $4 WHERE provider = $1 AND provider_account_id = $2', [
      profile.provider,
      profile.providerAccountId,
      email,
      profile.avatarUrl,
    ]);
    if (profile.avatarUrl) {
      await pool.query('UPDATE users SET avatar_url = COALESCE(avatar_url, $2), email_verified = $3, updated_at = now() WHERE id = $1', [
        uid,
        profile.avatarUrl,
        profile.emailVerified,
      ]);
    }
    const u = await pool.query<{ jwt_version: number }>('SELECT jwt_version FROM users WHERE id = $1', [uid]);
    if (!u.rows[0]) throw new ApiError(500, 'INTERNAL', 'User not found for linked account');
    return { userId: uid, jwtVersion: u.rows[0].jwt_version };
  }

  // 2) Check if user exists by email
  const userByEmail = await pool.query<{ id: string; jwt_version: number; email_verified: boolean }>(
    'SELECT id, jwt_version, email_verified FROM users WHERE email = $1',
    [email],
  );
  if (userByEmail.rows[0]) {
    const uid = userByEmail.rows[0].id;
    // Opsi A: auto-link jika verified, else tolak
    if (!profile.emailVerified) {
      throw new ApiError(409, 'EMAIL_NOT_VERIFIED', 'Email not verified by provider. Please verify your email with the provider or login with password to link manually.');
    }
    // Link
    await pool.query(
      'INSERT INTO oauth_accounts (user_id, provider, provider_account_id, email, avatar_url) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [uid, profile.provider, profile.providerAccountId, email, profile.avatarUrl],
    );
    if (profile.avatarUrl) {
      await pool.query('UPDATE users SET avatar_url = COALESCE(avatar_url, $2), email_verified = true, updated_at = now() WHERE id = $1', [
        uid,
        profile.avatarUrl,
      ]);
    } else {
      await pool.query('UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1', [uid]);
    }
    const fresh = await pool.query<{ jwt_version: number }>('SELECT jwt_version FROM users WHERE id = $1', [uid]);
    return { userId: uid, jwtVersion: fresh.rows[0]!.jwt_version };
  }

  // 3) Create new user (OAuth-only, password_hash NULL)
  // Email must be verified to auto-create (avoid unverified takeover)
  if (!profile.emailVerified) {
    throw new ApiError(400, 'EMAIL_NOT_VERIFIED', 'Email not verified by provider. Cannot create account.');
  }
  const userId = await withTransaction(pool, async (client) => {
    const ins = await client.query<{ id: string }>(
      'INSERT INTO users (email, password_hash, display_name, avatar_url, email_verified) VALUES ($1, NULL, $2, $3, true) RETURNING id',
      [email, profile.displayName || email, profile.avatarUrl],
    );
    const id = ins.rows[0]?.id;
    if (!id) throw new ApiError(500, 'INTERNAL', 'Failed to create user');
    await client.query(
      `WITH t AS (INSERT INTO teams (name, created_by) VALUES ('Personal', $1) RETURNING id)
       INSERT INTO team_members (team_id, user_id, role) SELECT id, $1, 'owner' FROM t`,
      [id],
    );
    await client.query('INSERT INTO oauth_accounts (user_id, provider, provider_account_id, email, avatar_url) VALUES ($1,$2,$3,$4,$5)', [
      id,
      profile.provider,
      profile.providerAccountId,
      email,
      profile.avatarUrl,
    ]);
    return id;
  });
  const fresh = await pool.query<{ jwt_version: number }>('SELECT jwt_version FROM users WHERE id = $1', [userId]);
  return { userId, jwtVersion: fresh.rows[0]!.jwt_version };
}

function frontendRedirect(req: import('express').Request, returnTo: string | null, provider: string, error?: string): string {
  const origin = frontendOrigin();
  if (error) {
    const u = new URL('/', origin);
    u.searchParams.set('oauth_error', error);
    u.searchParams.set('provider', provider);
    return u.toString();
  }
  if (returnTo && isValidReturnTo(returnTo)) return returnTo;
  return new URL('/', origin).toString();
}

// --- Google callback ---
socialRouter.get('/google/callback', socialLimiter, async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const err = req.query.error as string | undefined;
  const stored = getOAuthStateCookie(req, 'google');
  // Clear cookie early to avoid replay
  clearOAuthStateCookie(res, 'google');
  if (err) {
    return res.redirect(302, frontendRedirect(req, stored?.returnTo ?? null, 'google', `Google OAuth error: ${err}`));
  }
  if (!code || !state || !stored || state !== stored.state) {
    return res.redirect(302, frontendRedirect(req, stored?.returnTo ?? null, 'google', 'Invalid OAuth state'));
  }
  try {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) throw new ApiError(500, 'OAUTH_NOT_CONFIGURED', 'Google not configured');
    const redirectUri = `${baseUrl(req)}/api/v1/auth/google/callback`;
    // Exchange code
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: stored.codeVerifier,
      }).toString(),
    });
    const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new ApiError(500, 'OAUTH_EXCHANGE_FAILED', tokenJson?.error_description || tokenJson?.error || 'Failed to exchange code');
    }
    // Fetch profile via userinfo (simpler than JWKS)
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profileJson = (await profileRes.json().catch(() => null)) as
      | { id?: string; email?: string; verified_email?: boolean; name?: string; picture?: string }
      | null;
    if (!profileRes.ok || !profileJson?.id || !profileJson?.email) {
      throw new ApiError(500, 'OAUTH_PROFILE_FAILED', 'Failed to fetch Google profile');
    }
    const profile: ProviderProfile = {
      provider: 'google',
      providerAccountId: profileJson.id,
      email: profileJson.email,
      emailVerified: Boolean(profileJson.verified_email),
      displayName: profileJson.name || profileJson.email.split('@')[0] || 'User',
      avatarUrl: profileJson.picture || null,
    };
    // If already logged in -> treat as linking flow (Connect in Profile)
    const sessionUserId = await verifySession((req.cookies as Record<string, string | undefined>)?.[SESSION_COOKIE]);
    let userId: string;
    let jwtVersion: number;
    if (sessionUserId) {
      const existing = await pool.query<{ user_id: string }>(
        'SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2',
        [profile.provider, profile.providerAccountId],
      );
      if (existing.rows[0] && existing.rows[0].user_id !== sessionUserId) {
        throw new ApiError(409, 'ALREADY_LINKED', 'This Google account is already linked to another user.');
      }
      if (existing.rows[0]) {
        const u = await pool.query<{ jwt_version: number }>('SELECT jwt_version FROM users WHERE id = $1', [sessionUserId]);
        userId = sessionUserId;
        jwtVersion = u.rows[0]!.jwt_version;
      } else {
        if (!profile.emailVerified) throw new ApiError(409, 'EMAIL_NOT_VERIFIED', 'Email not verified by provider.');
        await pool.query(
          'INSERT INTO oauth_accounts (user_id, provider, provider_account_id, email, avatar_url) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
          [sessionUserId, profile.provider, profile.providerAccountId, profile.email.trim().toLowerCase(), profile.avatarUrl],
        );
        if (profile.avatarUrl) {
          await pool.query('UPDATE users SET avatar_url = COALESCE(avatar_url, $2), email_verified = true, updated_at = now() WHERE id = $1', [
            sessionUserId,
            profile.avatarUrl,
          ]);
        }
        const u = await pool.query<{ jwt_version: number }>('SELECT jwt_version FROM users WHERE id = $1', [sessionUserId]);
        userId = sessionUserId;
        jwtVersion = u.rows[0]!.jwt_version;
      }
    } else {
      const r = await handleOAuthLogin(res, profile);
      userId = r.userId;
      jwtVersion = r.jwtVersion;
    }
    setSessionCookie(res, userId, jwtVersion);
    const dest = frontendRedirect(req, stored.returnTo, 'google');
    res.redirect(302, dest);
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Google login failed';
    // If EMAIL_NOT_VERIFIED, show clearer message
    res.redirect(302, frontendRedirect(req, stored.returnTo, 'google', msg));
  }
});

// --- GitHub callback ---
socialRouter.get('/github/callback', socialLimiter, async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const err = req.query.error as string | undefined;
  const stored = getOAuthStateCookie(req, 'github');
  clearOAuthStateCookie(res, 'github');
  if (err) {
    return res.redirect(302, frontendRedirect(req, stored?.returnTo ?? null, 'github', `GitHub OAuth error: ${err}`));
  }
  if (!code || !state || !stored || state !== stored.state) {
    return res.redirect(302, frontendRedirect(req, stored?.returnTo ?? null, 'github', 'Invalid OAuth state'));
  }
  try {
    if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) throw new ApiError(500, 'OAUTH_NOT_CONFIGURED', 'GitHub not configured');
    const redirectUri = `${baseUrl(req)}/api/v1/auth/github/callback`;
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        code_verifier: stored.codeVerifier,
      }),
    });
    const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new ApiError(500, 'OAUTH_EXCHANGE_FAILED', tokenJson?.error_description || tokenJson?.error || 'Failed to exchange code');
    }
    const accessToken = tokenJson.access_token;
    // Fetch user
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'DevHub' },
    });
    const userJson = (await userRes.json().catch(() => null)) as
      | { id?: number; login?: string; name?: string | null; avatar_url?: string | null; email?: string | null }
      | null;
    if (!userRes.ok || !userJson?.id) throw new ApiError(500, 'OAUTH_PROFILE_FAILED', 'Failed to fetch GitHub profile');
    // Fetch emails to get primary verified
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'DevHub' },
    });
    const emailsJson = (await emailsRes.json().catch(() => [])) as { email: string; primary: boolean; verified: boolean }[];
    let primaryEmail: string | null = null;
    let primaryVerified = false;
    if (Array.isArray(emailsJson) && emailsJson.length > 0) {
      const primary = emailsJson.find((e) => e.primary) ?? emailsJson[0];
      if (primary) {
        primaryEmail = primary.email;
        primaryVerified = Boolean(primary.verified);
      }
    }
    // Fallback to user email if emails endpoint fails
    const email = primaryEmail ?? userJson.email ?? null;
    if (!email) throw new ApiError(400, 'EMAIL_NOT_AVAILABLE', 'GitHub email not available. Please set a public email or verify primary email.');
    const profile: ProviderProfile = {
      provider: 'github',
      providerAccountId: String(userJson.id),
      email,
      emailVerified: primaryVerified || Boolean(userJson.email),
      displayName: userJson.name || userJson.login || email.split('@')[0] || 'User',
      avatarUrl: userJson.avatar_url || null,
    };
    const sessionUserId = await verifySession((req.cookies as Record<string, string | undefined>)?.[SESSION_COOKIE]);
    let userId: string;
    let jwtVersion: number;
    if (sessionUserId) {
      const existing = await pool.query<{ user_id: string }>(
        'SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2',
        [profile.provider, profile.providerAccountId],
      );
      if (existing.rows[0] && existing.rows[0].user_id !== sessionUserId) {
        throw new ApiError(409, 'ALREADY_LINKED', 'This GitHub account is already linked to another user.');
      }
      if (existing.rows[0]) {
        const u = await pool.query<{ jwt_version: number }>('SELECT jwt_version FROM users WHERE id = $1', [sessionUserId]);
        userId = sessionUserId;
        jwtVersion = u.rows[0]!.jwt_version;
      } else {
        if (!profile.emailVerified) throw new ApiError(409, 'EMAIL_NOT_VERIFIED', 'Email not verified by provider.');
        await pool.query(
          'INSERT INTO oauth_accounts (user_id, provider, provider_account_id, email, avatar_url) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
          [sessionUserId, profile.provider, profile.providerAccountId, profile.email.trim().toLowerCase(), profile.avatarUrl],
        );
        if (profile.avatarUrl) {
          await pool.query('UPDATE users SET avatar_url = COALESCE(avatar_url, $2), email_verified = true, updated_at = now() WHERE id = $1', [
            sessionUserId,
            profile.avatarUrl,
          ]);
        }
        const u = await pool.query<{ jwt_version: number }>('SELECT jwt_version FROM users WHERE id = $1', [sessionUserId]);
        userId = sessionUserId;
        jwtVersion = u.rows[0]!.jwt_version;
      }
    } else {
      const r = await handleOAuthLogin(res, profile);
      userId = r.userId;
      jwtVersion = r.jwtVersion;
    }
    setSessionCookie(res, userId, jwtVersion);
    const dest = frontendRedirect(req, stored.returnTo, 'github');
    res.redirect(302, dest);
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'GitHub login failed';
    res.redirect(302, frontendRedirect(req, stored?.returnTo ?? null, 'github', msg));
  }
});
