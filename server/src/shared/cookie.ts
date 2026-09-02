import type { Response } from 'express';
import { config } from '../config.js';
import { JWT_TTL_SECONDS, signToken } from '../modules/auth/infrastructure/jwt.js';
import { SESSION_COOKIE } from './http.js';

export function setSessionCookie(res: Response, userId: string, version: number): void {
  // Lintas-situs FE Vercel + BE Render -> SameSite=None + Secure di production
  res.cookie(SESSION_COOKIE, signToken(userId, version), {
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: config.COOKIE_SECURE,
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
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: config.COOKIE_SECURE,
  });
}
