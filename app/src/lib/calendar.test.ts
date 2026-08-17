import { describe, expect, it } from 'vitest';
import { addDaysIso, inMonth, isoOf, mondayOf, monthMatrix, monthName, parseIso, weekDays } from './calendar';

describe('calendar helpers', () => {
  it('round-trips parse and format', () => {
    expect(isoOf(parseIso('2026-08-17'))).toBe('2026-08-17');
  });

  it('adds days across month boundaries', () => {
    expect(addDaysIso('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysIso('2026-08-17', -1)).toBe('2026-08-16');
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-08-17')).toBe('2026-08-17'); // Monday
    expect(mondayOf('2026-08-20')).toBe('2026-08-17');
    expect(mondayOf('2026-08-23')).toBe('2026-08-17'); // Sunday
  });

  it('builds a stable 6x7 month matrix starting on Monday', () => {
    const weeks = monthMatrix(2026, 7); // August 2026
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0]![0]).toBe('2026-07-27'); // Monday before Aug 1
    expect(weeks[5]![6]).toBe('2026-09-06');
    expect(inMonth('2026-08-01', 2026, 7)).toBe(true);
    expect(inMonth('2026-07-27', 2026, 7)).toBe(false);
  });

  it('returns Monday-start weeks for a week view', () => {
    expect(weekDays('2026-08-20')).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
  });

  it('formats the month header', () => {
    expect(monthName(2026, 7)).toBe('August 2026');
  });
});