import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { classifyError, getErrorMessage, isTransientError } from './errors';

describe('isTransientError', () => {
  it('returns true for network-level errors (status 0)', () => {
    expect(isTransientError(new ApiError(0, 'NETWORK', 'Cannot reach the server.'))).toBe(true);
    expect(isTransientError(new ApiError(0, 'TIMEOUT', 'Request timed out'))).toBe(true);
  });

  it('returns true for server errors (5xx)', () => {
    expect(isTransientError(new ApiError(500, 'INTERNAL', 'boom'))).toBe(true);
    expect(isTransientError(new ApiError(503, 'UNAVAILABLE', 'busy'))).toBe(true);
  });

  it('returns false for client errors', () => {
    expect(isTransientError(new ApiError(404, 'NOT_FOUND', 'Team not found'))).toBe(false);
    expect(isTransientError(new ApiError(409, 'CONFLICT', 'Version mismatch'))).toBe(false);
  });

  it('returns false for non-ApiError values', () => {
    expect(isTransientError(new Error('plain'))).toBe(false);
    expect(isTransientError('string')).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('returns the fallback for non-ApiError values', () => {
    expect(getErrorMessage(new Error('plain'), 'Failed to load')).toBe('Failed to load');
    expect(getErrorMessage(null, 'Failed to load')).toBe('Failed to load');
  });

  it('passes through 4xx messages untouched', () => {
    expect(getErrorMessage(new ApiError(404, 'NOT_FOUND', 'Team not found'), 'fallback')).toBe(
      'Team not found',
    );
  });

  it('passes through status-0 messages untouched (already actionable)', () => {
    expect(
      getErrorMessage(new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'), 'fb'),
    ).toBe('Cannot reach the server. Is it running?');
  });

  it('appends a recovery hint to 5xx messages', () => {
    expect(getErrorMessage(new ApiError(500, 'INTERNAL', 'boom'), 'fb')).toBe(
      'boom. Please try again in a moment.',
    );
    expect(getErrorMessage(new ApiError(500, 'INTERNAL', 'Stored state is invalid'), 'fb')).toBe(
      'Stored state is invalid. Please try again in a moment.',
    );
  });
});

describe('classifyError', () => {
  it('maps bare and coded 429 to rateLimited', () => {
    expect(classifyError(new ApiError(429, 'INTERNAL', 'Too Many Requests'))).toBe('rateLimited');
    expect(classifyError(new ApiError(429, 'RATE_LIMITED', 'Too many login attempts'))).toBe('rateLimited');
  });
  it('maps allowlisted business codes', () => {
    expect(classifyError(new ApiError(402, 'PLAN_LIMIT', 'Downgrade blocked'))).toBe('business');
  });
  it('maps server, offline, notFound and forbidden', () => {
    expect(classifyError(new ApiError(500, 'INTERNAL', 'boom'))).toBe('server');
    expect(classifyError(new ApiError(0, 'NETWORK', 'fetch failed'))).toBe('offline');
    expect(classifyError(new ApiError(404, 'NOT_FOUND', 'nope'))).toBe('notFound');
    expect(classifyError(new ApiError(403, 'FORBIDDEN', 'denied'))).toBe('forbidden');
  });
  it('maps validation-style 400s and unknown values to generic', () => {
    expect(classifyError(new ApiError(400, 'VALIDATION', 'Name is required'))).toBe('generic');
    expect(classifyError(new Error('plain'))).toBe('generic');
    expect(classifyError(null)).toBe('generic');
  });
});
