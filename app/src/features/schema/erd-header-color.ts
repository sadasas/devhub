/* DevHub ERD header color helpers (client-side, pure, zero-dep).
   Table.color (#rrggbb, null = default) -> header fill + contrasting title.
   Pure never-throw deterministic; snapshot-safe (takes a color string, never
   reads global state). Dark-only: title is #fff on dark fills, #131316 on
   light fills (WCAG relative luminance, threshold 0.45).
   Pola exporter pure seperti ddl-export/dbml-export: input rusak -> null,
   kegagalan tak terduga -> fallback aman (tidak pernah throw). */

export const HEADER_TITLE_LIGHT = '#fff';
export const HEADER_TITLE_DARK = '#131316';

/** Default fills mirror ERD.tsx CSS + erd-export.ts literals (dark-only). */
export const DEFAULT_HEADER_TITLE = '#5db69b';
export const DEFAULT_HEADER_FILL = 'rgba(93, 182, 155, 0.12)';


export type HeaderTitleColor = typeof HEADER_TITLE_LIGHT | typeof HEADER_TITLE_DARK;

/**
 * Normalize a Table.color value to lowercase #rrggbb, or null when empty/invalid.
 * Accepts #rgb (expanded) and #rrggbb; trims whitespace. Never throws.
 */
export function normalizeHeaderColor(color: string | null | undefined): string | null {
  try {
    if (color === null || color === undefined) return null;
    if (typeof color !== 'string') return null;
    const t = color.trim();
    if (t === '') return null;
    const short = /^#([0-9a-fA-F]{3})$/;
    const full = /^#[0-9a-fA-F]{6}$/;
    if (full.test(t)) return t.toLowerCase();
    const m = short.exec(t);
    if (m) {
      const h = m[1]!.toLowerCase();
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * WCAG 2.1 relative luminance of a #rrggbb hex (0 = black, 1 = white).
 * Invalid input -> 0 (dark fallback, never throws).
 */
export function luminance(hex: string): number {
  try {
    if (typeof hex !== 'string') return 0;
    const t = hex.trim();
    const m = /^#([0-9a-fA-F]{6})$/.exec(t);
    if (!m) {
      const s = /^#([0-9a-fA-F]{3})$/.exec(t);
      if (!s) return 0;
      const h = s[1]!.toLowerCase();
      return luminance(`#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`);
    }
    const v = m[1]!;
    const r8 = parseInt(v.slice(0, 2), 16);
    const g8 = parseInt(v.slice(2, 4), 16);
    const b8 = parseInt(v.slice(4, 6), 16);
    if (!Number.isFinite(r8) || !Number.isFinite(g8) || !Number.isFinite(b8)) return 0;
    const lin = (c8: number): number => {
      const c = c8 / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const l = 0.2126 * lin(r8) + 0.7152 * lin(g8) + 0.0722 * lin(b8);
    if (!Number.isFinite(l)) return 0;
    return Math.min(1, Math.max(0, Math.round(l * 10000) / 10000));
  } catch {
    return 0;
  }
}

/**
 * Contrasting title color for a header fill: #fff on dark, #131316 on light.
 * Null/invalid (default header) -> #fff (dark-only canvas is dark).
 * Never throws.
 */
export function headerTitleColor(color: string | null | undefined): HeaderTitleColor {
  try {
    const norm = normalizeHeaderColor(color);
    if (!norm) return HEADER_TITLE_LIGHT as HeaderTitleColor;
    return luminance(norm) > 0.45
      ? (HEADER_TITLE_DARK as HeaderTitleColor)
      : (HEADER_TITLE_LIGHT as HeaderTitleColor);
  } catch {
    return HEADER_TITLE_LIGHT as HeaderTitleColor;
  }
}

/**
 * Header fill for a Table.color: normalized #rrggbb, or null when default.
 * Callers keep existing CSS/export defaults when null (no inline override).
 * Never throws.
 */
export function headerFill(color: string | null | undefined): string | null {
  try {
    return normalizeHeaderColor(color);
  } catch {
    return null;
  }
}
