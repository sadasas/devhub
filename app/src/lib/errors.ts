import { ApiError } from './api';

export function isTransientError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status >= 500);
}

export function isPlanLimitError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === 'PLAN_LIMIT';
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status >= 500) {
    const base = err.message.replace(/[.\s]+$/, '');
    return `${base}. Please try again in a moment.`;
  }
  return err.message;
}

export type ErrorKind =
  | 'business'
  | 'rateLimited'
  | 'server'
  | 'offline'
  | 'notFound'
  | 'forbidden'
  | 'generic';

/** Kode error bisnis (allowlist). */
export const BUSINESS_ERROR_CODES: ReadonlySet<string> = new Set(['PLAN_LIMIT']);

export function classifyError(err: unknown): ErrorKind {
  if (!(err instanceof ApiError)) return 'generic';
  if (BUSINESS_ERROR_CODES.has(err.code)) return 'business';
  if (err.status === 429 || err.code === 'RATE_LIMITED') return 'rateLimited';
  if (err.status >= 500) return 'server';
  if (err.status === 0) return 'offline';
  if (err.status === 404) return 'notFound';
  if (err.status === 401 || err.status === 403) return 'forbidden';
  return 'generic';
}
