import { describe, expect, it } from 'vitest';
import {
  FONT_PRESETS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  applyListPrefix,
  fontPresetName,
  fontStackOf,
  listedLines,
  parseStoredFontSize,
  svgTextStyle,
} from './fonts';

describe('whiteboard fonts', () => {
  it('maps the four FigJam typefaces onto the DevHub stack', () => {
    expect(fontStackOf('simple')).toContain('Geist');
    expect(fontStackOf('bookish')).toContain('Georgia');
    expect(fontStackOf('technical')).toContain('Mono');
    expect(fontStackOf('scribbled')).toContain('Caveat');
    expect(fontStackOf(undefined)).toBe(fontStackOf('simple'));
    expect(fontStackOf(null)).toBe(fontStackOf('simple'));
  });

  it('falls back to the default instead of the minimum for missing stored sizes', () => {
    // Number(null) is 0 — a naive Number()+clamp would init fresh toolbars to 4.
    expect(parseStoredFontSize(null, 16)).toBe(16);
    expect(parseStoredFontSize(undefined, 16)).toBe(16);
    expect(parseStoredFontSize('', 16)).toBe(16);
    expect(parseStoredFontSize('abc', 16)).toBe(16);
    expect(parseStoredFontSize('20', 16)).toBe(20);
    expect(parseStoredFontSize('16', 12)).toBe(16);
    expect(parseStoredFontSize('200', 16)).toBe(96);
    expect(parseStoredFontSize('2', 16)).toBe(4);
  });

  it('exposes the five FigJam size presets capped at 96', () => {
    expect(FONT_PRESETS.map((p) => p.value)).toEqual([16, 24, 40, 64, 96]);
    expect(FONT_SIZE_MIN).toBe(4);
    expect(FONT_SIZE_MAX).toBe(96);
    expect(fontPresetName(24)).toBe('Medium');
    expect(fontPresetName(25)).toBe('25');
  });

  it('prefixes bullets only in bullet mode', () => {
    expect(applyListPrefix(['a', '', 'b'], 'bullet')).toEqual(['• a', '', '• b']);
    expect(applyListPrefix(['a'], 'none')).toEqual(['a']);
    expect(applyListPrefix(['a'], null)).toEqual(['a']);
  });

  it('builds svg text style + listed lines from element fields', () => {
    const style = svgTextStyle({ fontFamily: 'scribbled', bold: true, strikethrough: true });
    expect(style.fontFamily).toContain('Caveat');
    expect(style.fontWeight).toBe(700);
    expect(style.textDecoration).toBe('line-through');
    expect(svgTextStyle({})).toMatchObject({ fontWeight: undefined, textDecoration: undefined });
    expect(listedLines('a\nb', { list: 'bullet' })).toEqual(['• a', '• b']);
  });
});
