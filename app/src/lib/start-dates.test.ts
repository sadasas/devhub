import { describe, expect, it } from 'vitest';
import { startAfterDue, startLabel } from './start-dates';

describe('startLabel', () => {
  it('formats a start date without the year', () => {
    expect(startLabel('2026-08-20')).toBe('Starts Aug 20');
  });

  it('returns an empty string for missing dates', () => {
    expect(startLabel(undefined)).toBe('');
    expect(startLabel(null)).toBe('');
    expect(startLabel('')).toBe('');
  });
});

describe('startAfterDue', () => {
  it('is false when the start date is before the due date', () => {
    expect(startAfterDue('2026-08-14', '2026-08-20')).toBe(false);
  });

  it('is false when start and due are on the same day', () => {
    expect(startAfterDue('2026-08-20', '2026-08-20')).toBe(false);
  });

  it('is true when the start date is after the due date', () => {
    expect(startAfterDue('2026-08-25', '2026-08-20')).toBe(true);
  });

  it('is false when either date is missing', () => {
    expect(startAfterDue(null, '2026-08-20')).toBe(false);
    expect(startAfterDue('2026-08-20', undefined)).toBe(false);
  });
});