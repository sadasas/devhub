import { describe, expect, it } from 'vitest';
import {
  HEADER_TITLE_DARK,
  HEADER_TITLE_LIGHT,
  headerFill,
  headerTitleColor,
  luminance,
  normalizeHeaderColor,
} from './erd-header-color';

describe('erd-header-color (U2 pure, never-throw, deterministik)', () => {
  it('normalizeHeaderColor: null/empty/invalid -> null, #rgb expanded, case-insensitive', () => {
    expect(normalizeHeaderColor(null)).toBeNull();
    expect(normalizeHeaderColor(undefined)).toBeNull();
    expect(normalizeHeaderColor('')).toBeNull();
    expect(normalizeHeaderColor('   ')).toBeNull();
    expect(normalizeHeaderColor('red')).toBeNull();
    expect(normalizeHeaderColor('#zzz')).toBeNull();
    expect(normalizeHeaderColor('#12345')).toBeNull();
    expect(normalizeHeaderColor('#5DB69B')).toBe('#5db69b');
    expect(normalizeHeaderColor('  #e4e4e7  ')).toBe('#e4e4e7');
    expect(normalizeHeaderColor('#fff')).toBe('#ffffff');
    expect(normalizeHeaderColor('#ABC')).toBe('#aabbcc');
  });

  it('luminance: hitam 0, putih 1, abu terang > gelap, invalid -> 0', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBe(1);
    expect(luminance('#e4e4e7')).toBeGreaterThan(luminance('#06251a'));
    expect(luminance('#5db69b')).toBeGreaterThan(0);
    expect(luminance('#5db69b')).toBeLessThan(1);
    expect(luminance('')).toBe(0);
    expect(luminance('red')).toBe(0);
    expect(luminance(null as unknown as string)).toBe(0);
  });

  it('headerTitleColor: gelap -> #fff, terang -> #131316, default null -> #fff', () => {
    expect(headerTitleColor('#06251a')).toBe('#fff');
    expect(headerTitleColor('#000000')).toBe('#fff');
    expect(headerTitleColor('#5db69b')).toBe('#fff');
    expect(headerTitleColor('#e4e4e7')).toBe('#131316');
    expect(headerTitleColor('#ffffff')).toBe('#131316');
    expect(headerTitleColor('#e8b955')).toBe('#131316');
    expect(headerTitleColor(null)).toBe('#fff');
    expect(headerTitleColor(undefined)).toBe('#fff');
    expect(headerTitleColor('')).toBe('#fff');
    expect(headerTitleColor('invalid')).toBe('#fff');
    expect([HEADER_TITLE_LIGHT, HEADER_TITLE_DARK]).toContain(headerTitleColor('#6ea8fe'));
  });

  it('headerFill: valid -> hex normal, default/invalid -> null', () => {
    expect(headerFill('#5DB69B')).toBe('#5db69b');
    expect(headerFill('#fff')).toBe('#ffffff');
    expect(headerFill(null)).toBeNull();
    expect(headerFill(undefined)).toBeNull();
    expect(headerFill('')).toBeNull();
    expect(headerFill('red')).toBeNull();
  });

  it('never-throw + deterministik untuk input rusak', () => {
    const weird: unknown[] = [null, undefined, '', ' ', 0, 42, {}, [], { toString: () => { throw new Error('x'); } }];
    for (const w of weird) {
      expect(() => normalizeHeaderColor(w as string)).not.toThrow();
      expect(() => headerFill(w as string)).not.toThrow();
      expect(() => headerTitleColor(w as string)).not.toThrow();
      expect(() => luminance(w as string)).not.toThrow();
    }
    expect(headerTitleColor('#e4e4e7')).toBe(headerTitleColor('#E4E4E7'));
    expect(headerFill('#ABCDEF')).toBe(headerFill('#abcdef'));
  });
});
