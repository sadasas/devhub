import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { getErrorMessage, isTransientError } from './errors';

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
