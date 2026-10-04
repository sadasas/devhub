import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysUntil } from './alert';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-03T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('daysUntil', () => {
  it('selisih hari kalender (3 Okt -> 6 Okt = 3)', () => {
    expect(daysUntil('2026-10-06T00:00:00.000Z')).toBe(3);
  });

  it('0 untuk deadline di hari yang sama', () => {
    expect(daysUntil('2026-10-03T18:00:00.000Z')).toBe(0);
  });

  it('null untuk ISO tak valid', () => {
    expect(daysUntil('bukan-tanggal')).toBeNull();
    expect(daysUntil('')).toBeNull();
  });

  it('null untuk deadline yang sudah lewat', () => {
    expect(daysUntil('2026-10-01T00:00:00.000Z')).toBeNull();
  });
});
