/**
 * Kanvas whiteboard selalu putih bersih ala FigJam, di semua theme app.
 *
 * Warna terang-legacy (didesain untuk kanvas gelap) dipetakan ke padanan
 * gelap yang terbaca di atas putih. Dipakai oleh:
 * - default warna baru (tools.ts, EditorShell, Canvas),
 * - remap prefs localStorage lama saat dibaca (tanpa ini user lama tetap
 *   dapat default terang yang tak terbaca),
 * - migrasi SQL 044 (tabel mapping yang sama, duplikat di SQL).
 *
 * Sticky fill (`#e8b955`) DIKECUALIKAN dari pemakaian buta — ia punya
 * background sendiri yang terbaca di putih. Hanya remap INK
 * (stroke/teks/label), bukan fill sticky.
 */
export const LIGHT_INK_REMAP: Record<string, string> = {
  '#e4e4e7': '#374151',
  '#f1f5f9': '#0f172a',
  '#6ea8fe': '#2563eb',
  '#e8b955': '#b45309',
  '#f2b8c6': '#db2777',
  '#34c38e': '#047857',
  '#5db69b': '#0f766e',
  '#a78bfa': '#7c3aed',
};

/** Remap nilai light-legacy ke padanan gelap; nilai lain (termasuk null) lolos utuh. */
export function remapLegacyLightColor<T extends string | null | undefined>(color: T): T {
  if (typeof color !== 'string') return color;
  return (LIGHT_INK_REMAP[color.toLowerCase()] ?? color) as T;
}

import type { WhiteboardShapeFill } from '../../lib/types';

export type { WhiteboardShapeFill };

/** Opasitas tint mode 'transparent' (perilaku fill:true lama). */
export const SHAPE_FILL_TINT_OPACITY = 0.15;

/** Fill terang yang butuh label gelap di atasnya (kanvas putih). */
const LIGHT_SHAPE_FILLS = ['#e4e4e7', '#6ea8fe', '#f2b8c6', '#34c38e', '#5db69b', '#a78bfa', '#e8b955'];

/** True bila mode mengecat dan warnanya terang. */
export function isLightShapeFill(fill: unknown, color: string): boolean {
  return shapeFillMode(fill) !== 'none' && LIGHT_SHAPE_FILLS.includes(color.toLowerCase());
}

/**
 * Warna label shape: eksplisit menang; solid gelap tanpa label → terang
 * (tanpa ini label gelap di atas fill gelap tak terbaca); fill terang →
 * gelap; selain itu ikut warna stroke. `paint` = warna cat aktual
 * (fillColor ?? color) — fallback dihitung dari cat, bukan stroke.
 */
export function shapeLabelFill(
  fill: unknown,
  paint: string,
  labelColor: string | null | undefined,
): string {
  if (labelColor) return labelColor;
  const mode = shapeFillMode(fill);
  if (mode === 'solid' && !isLightShapeFill(fill, paint)) return '#f8fafc';
  if (isLightShapeFill(fill, paint)) return '#0f172a';
  return paint;
}

/** Warna cat body shape: fillColor bila diisi, kalau tidak ikut border. */
export function shapePaintColor(
  color: string,
  fillColor: string | null | undefined,
): string {
  return fillColor ?? color;
}

/**
 * Normalisasi mode fill shape — toleran boolean legacy dari payload basi
 * (`true` → 'transparent' agar tampilan tak berubah, `false` → 'none').
 */
export function shapeFillMode(fill: unknown): WhiteboardShapeFill {
  if (fill === 'solid' || fill === 'transparent' || fill === 'none') return fill;
  return fill === true ? 'transparent' : 'none';
}
