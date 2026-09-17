/**
 * Google Calendar HTTP client — fetch native, TANPA dep `googleapis` (kontrak T3).
 *
 * - Base: https://www.googleapis.com/calendar/v3
 * - Refresh: POST https://oauth2.googleapis.com/token (grant_type=refresh_token)
 * - insert/patch/delete events per kalender.
 * - Klasifikasi error terpusat: rateLimit (429 / 403 rateLimitExceeded) → outbox;
 *   invalid_grant/401 → needs_reconnect; 404/410 → gone (idempoten delete).
 * - TIDAK pernah me-log token (lihat coding-standards §7 + security-design).
 * - `fetchImpl` dapat di-inject (default global fetch) agar vitest bisa mock tanpa
 *   menyentuh network.
 */

import type { GcalEventBody } from '../application/mapping.js';

export const GCAL_API_BASE = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type FetchImpl = typeof fetch;

function resolveFetch(fetchImpl?: FetchImpl): FetchImpl {
  if (fetchImpl) return fetchImpl;
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('fetch is not available in this runtime');
  }
  return globalThis.fetch.bind(globalThis) as FetchImpl;
}

export class GcalApiError extends Error {
  readonly status: number;
  readonly gcalReason?: string;
  readonly gcalCode?: string;

  constructor(status: number, message: string, opts?: { reason?: string; code?: string }) {
    super(message);
    this.name = 'GcalApiError';
    this.status = status;
    if (opts?.reason) this.gcalReason = opts.reason;
    if (opts?.code) this.gcalCode = opts.code;
  }
}

interface GcalErrorPayload {
  message: string;
  reason?: string;
  code?: string;
}

async function readErrorPayload(res: Response): Promise<GcalErrorPayload> {
  const fallback = `Google Calendar request failed (HTTP ${res.status})`;
  try {
    const text = await res.text();
    if (!text) return { message: fallback };
    let json: unknown = null;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { message: text.slice(0, 500) || fallback };
    }
    if (typeof json !== 'object' || json === null) return { message: fallback };
    const err = (json as { error?: unknown }).error;
    if (typeof err === 'string') return { message: err.slice(0, 500) };
    if (typeof err !== 'object' || err === null) return { message: fallback };
    const rec = err as { message?: unknown; code?: unknown; errors?: unknown };
    const firstErr = Array.isArray(rec.errors) ? (rec.errors[0] as { reason?: unknown; message?: unknown } | undefined) : undefined;
    const reason = typeof firstErr?.reason === 'string' ? firstErr.reason : undefined;
    const message =
      (typeof rec.message === 'string' && rec.message.slice(0, 500)) ||
      (typeof firstErr?.message === 'string' && firstErr.message.slice(0, 500)) ||
      fallback;
    const code = typeof rec.code === 'number' ? String(rec.code) : undefined;
    return { message, reason, code };
  } catch {
    return { message: fallback };
  }
}

const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceededPerSecond',
]);

/** 429, atau 403 dengan reason kuota Google. */
export function isRateLimited(status: number, reason?: string): boolean {
  if (status === 429) return true;
  if (status === 403 && reason && RATE_LIMIT_REASONS.has(reason)) return true;
  return false;
}

/** Token dicabut/kedaluwarsa permanen: 401, atau 400 invalid_grant (refresh). */
export function isInvalidGrant(status: number, reason?: string, message?: string): boolean {
  if (status === 401) return true;
  const hay = `${reason ?? ''} ${message ?? ''}`.toLowerCase();
  if (status === 400 && hay.includes('invalid_grant')) return true;
  if (hay.includes('invalid_grant') || hay.includes('invalid_credentials')) return true;
  return false;
}

/** Event/kalender sudah hilang di Google: 404 atau 410. */
export function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

/** True bila expiry sudah lewat (dengan skew 60s agar tidak mepet). */
export function isExpired(expiry: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!expiry) return true;
  const ms = expiry instanceof Date ? expiry.getTime() : Date.parse(expiry);
  if (Number.isNaN(ms)) return true;
  return ms <= now.getTime() + 60_000;
}

export interface RefreshResult {
  accessToken: string;
  expiresIn: number;
  expiry: Date;
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: FetchImpl;
  now?: Date;
}): Promise<RefreshResult> {
  const fetchFn = resolveFetch(params.fetchImpl);
  const now = params.now ?? new Date();
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetchFn(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const payload = await readErrorPayload(res);
    throw new GcalApiError(res.status, payload.message, { reason: payload.reason, code: payload.code });
  }
  const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof json.access_token !== 'string' || json.access_token.length === 0) {
    throw new GcalApiError(502, 'Token refresh returned no access_token');
  }
  const expiresIn = typeof json.expires_in === 'number' && Number.isFinite(json.expires_in) ? Math.max(60, Math.floor(json.expires_in)) : 3600;
  return {
    accessToken: json.access_token,
    expiresIn,
    expiry: new Date(now.getTime() + expiresIn * 1000),
  };
}

function calendarPath(calendarId: string): string {
  return `${GCAL_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
}

function eventPath(calendarId: string, eventId: string): string {
  return `${GCAL_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
}

async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  const payload = await readErrorPayload(res);
  throw new GcalApiError(res.status, payload.message, { reason: payload.reason, code: payload.code });
}

export async function insertGcalEvent(params: {
  calendarId: string;
  accessToken: string;
  body: GcalEventBody;
  fetchImpl?: FetchImpl;
}): Promise<{ id: string }> {
  const fetchFn = resolveFetch(params.fetchImpl);
  const res = await fetchFn(calendarPath(params.calendarId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.body),
  });
  await throwIfError(res);
  const json = (await res.json()) as { id?: unknown };
  if (typeof json.id !== 'string' || json.id.length === 0) {
    throw new GcalApiError(502, 'Calendar insert returned no event id');
  }
  return { id: json.id };
}

export async function patchGcalEvent(params: {
  calendarId: string;
  eventId: string;
  accessToken: string;
  body: GcalEventBody;
  fetchImpl?: FetchImpl;
}): Promise<{ id: string }> {
  const fetchFn = resolveFetch(params.fetchImpl);
  const res = await fetchFn(eventPath(params.calendarId, params.eventId), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.body),
  });
  await throwIfError(res);
  const json = (await res.json()) as { id?: unknown };
  if (typeof json.id !== 'string' || json.id.length === 0) {
    return { id: params.eventId };
  }
  return { id: json.id };
}

/**
 * Idempoten: 404/410 (sudah terhapus di Google) dianggap sukses — pemanggil
 * tetap membersihkan gcal_event_map.
 */
export async function deleteGcalEvent(params: {
  calendarId: string;
  eventId: string;
  accessToken: string;
  fetchImpl?: FetchImpl;
}): Promise<void> {
  const fetchFn = resolveFetch(params.fetchImpl);
  const res = await fetchFn(eventPath(params.calendarId, params.eventId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  if (res.ok) return;
  if (isGone(res.status)) return;
  const payload = await readErrorPayload(res);
  throw new GcalApiError(res.status, payload.message, { reason: payload.reason, code: payload.code });
}
