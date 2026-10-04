import { beforeEach, describe, expect, it } from 'vitest';
import {
  TOUR_STEP_KEY,
  readTourStep,
  subscribeTour,
  writeTourStep,
} from './tour-events';

beforeEach(() => {
  localStorage.removeItem(TOUR_STEP_KEY);
});

describe('tour step store (regression: skipped steps)', () => {
  it('reads back every stored index verbatim — no silent remap', () => {
    for (let i = 0; i < 14; i++) {
      writeTourStep(i);
      expect(readTourStep(), `step ${i}`).toBe(i);
    }
  });

  it('keeps the snapshot stable across emits (3→4→5→6 never jumps)', () => {
    const seen: number[] = [];
    const unsub = subscribeTour(() => {
      seen.push(readTourStep());
    });
    try {
      writeTourStep(3);
      writeTourStep(4);
      writeTourStep(5);
      writeTourStep(6);
    } finally {
      unsub();
    }
    expect(seen).toEqual([3, 4, 5, 6]);
  });

  it('falls back to 0 for missing or out-of-range values', () => {
    expect(readTourStep()).toBe(0);
    writeTourStep(99);
    expect(readTourStep()).toBe(0);
  });
});
