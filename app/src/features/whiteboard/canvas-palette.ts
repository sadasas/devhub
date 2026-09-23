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
