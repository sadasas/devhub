import { describe, expect, it } from 'vitest';
import { dueBucket, dueColumnDate, dueLabel, dueTone, taskDueChip, todayIso } from './due-dates';

describe('dueBucket', () => {
  const TODAY = '2026-08-17';
  it('classifies by day distance around today', () => {
    expect(dueBucket('2026-08-16', TODAY)).toBe('overdue');
    expect(dueBucket('2026-08-17', TODAY)).toBe('today');
    expect(dueBucket('2026-08-18', TODAY)).toBe('tomorrow');
  });

  it('uses day windows for this week and next week', () => {
    expect(dueBucket('2026-08-19', TODAY)).toBe('thisWeek');
    expect(dueBucket('2026-08-24', TODAY)).toBe('thisWeek');
    expect(dueBucket('2026-08-25', TODAY)).toBe('nextWeek');
    expect(dueBucket('2026-08-31', TODAY)).toBe('nextWeek');
  });

  it('classifies beyond 14 days as later', () => {
    expect(dueBucket('2026-09-01', TODAY)).toBe('later');
    expect(dueBucket('2026-12-01', TODAY)).toBe('later');
  });

  it('treats a Sunday tomorrow as tomorrow, not next week', () => {
    expect(dueBucket('2026-08-24', '2026-08-23')).toBe('tomorrow');
  });

  it('returns none for missing dates', () => {
    expect(dueBucket(undefined, TODAY)).toBe('none');
    expect(dueBucket(null, TODAY)).toBe('none');
    expect(dueBucket('', TODAY)).toBe('none');
  });
});

describe('dueColumnDate', () => {
  const TODAY = '2026-08-17';
  it('maps every bucket to a date that classifies back into the same bucket', () => {
    for (const [bucket, expected] of [
      ['overdue', '2026-08-16'],
      ['today', '2026-08-17'],
      ['tomorrow', '2026-08-18'],
      ['thisWeek', '2026-08-19'],
      ['nextWeek', '2026-08-25'],
      ['later', '2026-09-01'],
    ] as const) {
      const date = dueColumnDate(bucket, TODAY);
      expect(date).toBe(expected);
      expect(dueBucket(date, TODAY)).toBe(bucket);
    }
  });

  it('returns null for the none bucket', () => {
    expect(dueColumnDate('none', TODAY)).toBeNull();
  });
});

describe('dueLabel', () => {
  const TODAY = '2026-08-17';
  it('formats overdue with a day count', () => {
    expect(dueLabel('2026-08-16', TODAY)).toBe('Overdue 1d');
    expect(dueLabel('2026-08-14', TODAY)).toBe('Overdue 3d');
  });
  it('labels today and tomorrow', () => {
    expect(dueLabel('2026-08-17', TODAY)).toBe('Due today');
    expect(dueLabel('2026-08-18', TODAY)).toBe('Due tomorrow');
  });
  it('formats future dates', () => {
    expect(dueLabel('2026-08-25', TODAY)).toMatch(/^Due Aug 25$/);
  });
  it('returns empty for missing dates', () => {
    expect(dueLabel(null, TODAY)).toBe('');
  });
});

describe('dueTone', () => {
  it('maps overdue and today to danger, near days to warn, rest neutral', () => {
    expect(dueTone('overdue')).toBe('danger');
    expect(dueTone('today')).toBe('danger');
    expect(dueTone('tomorrow')).toBe('warn');
    expect(dueTone('thisWeek')).toBe('warn');
    expect(dueTone('nextWeek')).toBe('neutral');
    expect(dueTone('later')).toBe('neutral');
    expect(dueTone('none')).toBe('neutral');
  });
});

describe('todayIso', () => {
  it('returns the local date as YYYY-MM-DD', () => {
    const iso = todayIso();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('taskDueChip', () => {
  const TODAY = '2026-08-17';

  it('labels a done-on-time task as success', () => {
    expect(
      taskDueChip(
        { status: 'done', dueDate: '2026-08-20', completedAt: '2026-08-15T09:00:00.000Z' },
        TODAY,
      ),
    ).toEqual({ label: 'Done on time', tone: 'success' });
  });

  it('treats same-day completion as on time', () => {
    expect(
      taskDueChip(
        { status: 'done', dueDate: '2026-08-15', completedAt: '2026-08-15T23:59:00.000Z' },
        TODAY,
      ),
    ).toEqual({ label: 'Done on time', tone: 'success' });
  });

  it('labels a done-late task with a fixed day count', () => {
    expect(
      taskDueChip(
        { status: 'done', dueDate: '2026-08-10', completedAt: '2026-08-13T10:00:00.000Z' },
        TODAY,
      ),
    ).toEqual({ label: 'Done late 3d', tone: 'warn' });
  });

  it('falls back to active overdue for done tasks without completedAt', () => {
    expect(
      taskDueChip({ status: 'done', dueDate: '2026-08-16', completedAt: null }, TODAY),
    ).toEqual({ label: 'Overdue 1d', tone: 'danger' });
  });

  it('keeps active labeling for open tasks', () => {
    expect(
      taskDueChip({ status: 'todo', dueDate: '2026-08-16', completedAt: null }, TODAY),
    ).toEqual({ label: 'Overdue 1d', tone: 'danger' });
  });
});