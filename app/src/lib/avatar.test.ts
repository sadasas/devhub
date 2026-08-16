import { describe, expect, it } from 'vitest';
import { avatarColor, initialsOf } from './avatar';

describe('avatar helpers', () => {
  it('builds initials from the first and last word', () => {
    expect(initialsOf('One Two')).toBe('OT');
    expect(initialsOf('One')).toBe('O');
    expect(initialsOf('one two three')).toBe('OT');
  });

  it('falls back to U for empty names', () => {
    expect(initialsOf('')).toBe('U');
    expect(initialsOf('   ')).toBe('U');
  });

  it('is deterministic per user id', () => {
    expect(avatarColor('u1')).toBe(avatarColor('u1'));
    expect(avatarColor('u2')).toBe(avatarColor('u2'));
  });

  it('distributes ids across the palette', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(avatarColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});