/** Pico color math for the custom picker (Opsi B): hex <-> HSV. Pure, DOM-free. */

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Parses `#rrggbb`/`#rgb` (case-insensitive); null when invalid. */
export function hexToHsv(hex: string): Hsv | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const d = m[1]!;
  const full = d.length === 3 ? d.split('').map((c) => c + c).join('') : d;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/** Formats HSV as lowercase `#rrggbb`. Hue wraps, S/V clamp. */
export function hsvToHex(h: number, s: number, v: number): string {
  const hh = Number.isFinite(h) ? ((h % 360) + 360) % 360 : 0;
  const ss = clamp01(s);
  const vv = clamp01(v);
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const to = (n: number): string => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Accepts `#rrggbb`, `rrggbb` or `#rgb`; returns normalized lowercase `#rrggbb`. */
export function normalizeHexColor(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  const digits = m[1]!;
  if (!digits) return null;
  const hex = digits.length === 3 ? digits.split('').map((c) => c + c).join('') : digits;
  return `#${hex.toLowerCase()}`;
}

/** localStorage slot list helpers (max items, normalized, deduped). */
export const CUSTOM_COLOR_SLOTS = 8;

export function sanitizeSlots(raw: unknown, max: number = CUSTOM_COLOR_SLOTS): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const m = /^#([0-9a-f]{6})$/i.exec(item.trim());
    if (!m) continue;
    const hex = `#${m[1]!.toLowerCase()}`;
    if (!out.includes(hex)) out.push(hex);
    if (out.length >= max) break;
  }
  return out;
}
