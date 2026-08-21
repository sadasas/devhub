import { ApiError } from './api';

export function isTransientError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status >= 500);
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status >= 500) {
    const base = err.message.replace(/[.\s]+$/, '');
    return `${base}. Please try again in a moment.`;
  }
  return err.message;
}
