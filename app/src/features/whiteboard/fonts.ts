import type { WhiteboardFontFamily, WhiteboardTextList } from '../../lib/types';

/** FigJam typefaces mapped onto the DevHub stack (Scribbled needs Caveat). */
export const FONT_STACKS: Record<WhiteboardFontFamily, string> = {
  simple: "Geist, -apple-system, 'Segoe UI', sans-serif",
  bookish: "Georgia, 'Times New Roman', serif",
  technical: "'Geist Mono', ui-monospace, monospace",
  scribbled: 'Caveat, cursive',
};

export function fontStackOf(family: WhiteboardFontFamily | null | undefined): string {
  return FONT_STACKS[family ?? 'simple'];
}

export interface FontPreset {
  name: string;
  value: number;
}

/** FigJam size presets (Image 9). */
export const FONT_PRESETS: FontPreset[] = [
  { name: 'Small', value: 16 },
  { name: 'Medium', value: 24 },
  { name: 'Large', value: 40 },
  { name: 'Extra large', value: 64 },
  { name: 'Huge', value: 96 },
];

export const FONT_SIZE_MIN = 4;
export const FONT_SIZE_MAX = 96;

export function fontPresetName(size: number): string {
  return FONT_PRESETS.find((p) => p.value === size)?.name ?? String(size);
}

/** Prefixes every line with a bullet when list mode is on. */
export function applyListPrefix(lines: string[], list: 'none' | 'bullet' | null | undefined): string[] {
  if (list !== 'bullet') return lines;
  return lines.map((line) => (line.length > 0 ? `• ${line}` : line));
}

/** Structural text-style fields shared by every text-capable element kind. */
export interface RichTextFields {
  fontFamily?: WhiteboardFontFamily | null;
  bold?: boolean | null;
  strikethrough?: boolean | null;
  list?: WhiteboardTextList | null;
}

/** SVG <text> props for FigJam typeface + bold + strikethrough. */
export function svgTextStyle(
  el: RichTextFields | { kind: string },
): {
  fontFamily: string;
  fontWeight?: number;
  textDecoration?: string;
} {
  const rich = el as RichTextFields;
  return {
    fontFamily: fontStackOf(rich.fontFamily ?? undefined),
    fontWeight: rich.bold ? 700 : undefined,
    textDecoration: rich.strikethrough ? 'line-through' : undefined,
  };
}

/** Splits raw text into lines, prefixing bullets when list mode is on. */
export function listedLines(raw: string, el: RichTextFields | { kind: string }): string[] {
  return applyListPrefix(raw.split('\n'), (el as RichTextFields).list);
}
