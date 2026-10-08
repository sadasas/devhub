import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, sanitizeSlots } from './color';

describe('whiteboard color math', () => {
  it('parses primary hex colors to HSV', () => {
    expect(hexToHsv('#ff0000')).toMatchObject({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#00ff00')).toMatchObject({ h: 120, s: 1, v: 1 });
    expect(hexToHsv('#0000ff')).toMatchObject({ h: 240, s: 1, v: 1 });
    expect(hexToHsv('#ffffff')).toMatchObject({ s: 0, v: 1 });
    expect(hexToHsv('#000000')).toMatchObject({ v: 0 });
    expect(hexToHsv('#fff')).toMatchObject({ s: 0, v: 1 });
    expect(hexToHsv('not-a-color')).toBeNull();
  });

  it('formats HSV back to lowercase hex', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00');
    expect(hsvToHex(0, 0, 1)).toBe('#ffffff');
    expect(hsvToHex(0, 0, 0)).toBe('#000000');
    expect(hsvToHex(360 + 480, 2, -1)).toBe(hsvToHex(120, 1, 0));
  });

  it('round-trips the palette swatches', () => {
    for (const hex of ['#0f172a', '#f4706d', '#f97316', '#e8b955', '#34c38e', '#6ea8fe', '#a78bfa', '#2563eb']) {
      const hsv = hexToHsv(hex);
      expect(hsv).not.toBeNull();
      expect(hsvToHex(hsv!.h, hsv!.s, hsv!.v)).toBe(hex);
    }
  });

  it('sanitizes stored slot lists', () => {
    expect(sanitizeSlots(['#FF0000', 'bad', '#ff0000', '#00ff00', 42], 8)).toEqual(['#ff0000', '#00ff00']);
    expect(sanitizeSlots('nope')).toEqual([]);
    expect(sanitizeSlots(['#111111', '#222222', '#333333'], 2)).toEqual(['#111111', '#222222']);
  });
});
