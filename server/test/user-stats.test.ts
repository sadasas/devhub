import { describe, expect, it } from 'vitest';
import {
  computeStreaks,
  currentSemesterRef,
  parseSemesterParam,
} from '../src/modules/auth/application/user-stats.js';

describe('parseSemesterParam', () => {
  it('menerima YYYY-H1/H2 menjadi rentang kalender', () => {
    expect(parseSemesterParam('2026-H1')).toEqual({ semester: '2026-H1', from: '2026-01-01', to: '2026-06-30' });
    expect(parseSemesterParam('2026-H2')).toEqual({ semester: '2026-H2', from: '2026-07-01', to: '2026-12-31' });
  });

  it('menolak format liar dengan 400', () => {
    for (const raw of [undefined, null, '', '2026', 'H1', '2026-H3', '26-H1', '2026-H12', 2026]) {
      let code: string | null = null;
      try {
        parseSemesterParam(raw);
      } catch (err) {
        code = (err as { code?: string }).code ?? null;
      }
      expect(code).toBe('INVALID_SEMESTER');
    }
  });

  it('menolak tahun di luar 1970-2100', () => {
    expect(() => parseSemesterParam('1969-H1')).toThrowError();
    expect(() => parseSemesterParam('2101-H2')).toThrowError();
  });
});

describe('currentSemesterRef', () => {
  it('Jan–Jun = H1, Jul–Des = H2', () => {
    expect(currentSemesterRef(new Date(2026, 2, 15))).toEqual({
      semester: '2026-H1',
      from: '2026-01-01',
      to: '2026-06-30',
    });
    expect(currentSemesterRef(new Date(2026, 9, 5))).toEqual({
      semester: '2026-H2',
      from: '2026-07-01',
      to: '2026-12-31',
    });
  });
});

describe('computeStreaks', () => {
  it('menghitung run terpanjang dan run ujung-jendela', () => {
    const days = [
      { date: '2026-07-01', count: 2 },
      { date: '2026-07-02', count: 1 },
      { date: '2026-07-03', count: 0 },
      { date: '2026-07-04', count: 3 },
      { date: '2026-07-05', count: 1 },
    ];
    expect(computeStreaks(days)).toEqual({ currentStreak: 2, longestStreak: 2 });
  });

  it('current mundur melewati hari-nol di ujung', () => {
    const days = [
      { date: '2026-07-01', count: 1 },
      { date: '2026-07-02', count: 0 },
    ];
    expect(computeStreaks(days)).toEqual({ currentStreak: 1, longestStreak: 1 });
  });

  it('kosong = nol', () => {
    expect(computeStreaks([])).toEqual({ currentStreak: 0, longestStreak: 0 });
  });
});
