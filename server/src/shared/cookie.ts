import type { Response } from 'express';
import { config } from '../config.js';
import { JWT_TTL_SECONDS, signToken } from '../modules/auth/infrastructure/jwt.js';
import { SESSION_COOKIE } from './http.js';

/**
 * Parent domain for session cookies (ADR-051). Empty (dev / single frontend)
 * means host-only; prod sets COOKIE_DOMAIN so one login covers both the app
 * and admin subdomains. clearCookie MUST use the same domain or logout
 * silently fails to remove the cookie.
 */
function cookieDomain(): string | undefined {
  const d = config.COOKIE_DOMAIN.trim();
  return d ? d : undefined;
}

export function setSessionCookie(res: Response, userId: string, version: number): void {
  // Same-origin via Worker proxy (worker.ts), so Lax is sufficient and blocks CSRF.
  // With COOKIE_DOMAIN the cookie is first-party on every subdomain (ADR-051) —
  // SameSite=None is intentionally NOT used (third-party cookie, ITP-blocked).
  res.cookie(SESSION_COOKIE, signToken(userId, version), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE,
    domain: cookieDomain(),
    maxAge: JWT_TTL_SECONDS * 1000,
    path: '/',
  });
}

export const OAUTH_STATE_COOKIE_PREFIX = 'devhub_oauth_state_';
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function setOAuthStateCookie(
  res: Response,
  provider: 'google' | 'github',
  state: string,
  codeVerifier: string,
  returnTo: string | null,
  intent: 'login' | 'link' = 'login',
): void {
  const payload = Buffer.from(JSON.stringify({ state, codeVerifier, returnTo, intent })).toString('base64url');
  res.cookie(`${OAUTH_STATE_COOKIE_PREFIX}${provider}`, payload, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE,
    domain: cookieDomain(),
    maxAge: OAUTH_STATE_TTL_MS,
    path: '/',
  });
}

export function clearOAuthStateCookie(res: Response, provider: 'google' | 'github'): void {
  res.clearCookie(`${OAUTH_STATE_COOKIE_PREFIX}${provider}`, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE,
    domain: cookieDomain(),
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE,
    domain: cookieDomain(),
  });
}
