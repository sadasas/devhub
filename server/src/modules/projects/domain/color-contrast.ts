/**
 * Kontras label whiteboard vs kanvas putih (ala FigJam).
 *
 * Kanvas whiteboard selalu putih di semua theme app. Validator memakai
 * modul ini untuk menandai label yang tak terbaca (mis. stroke pastel
 * dengan `fill: "none"` — label mengikuti warna stroke tanpa jaminan
 * kontras). Read-only: mirror aturan render `shapeLabelFill` di
 * `app/src/features/whiteboard/canvas-palette.ts` — bukan duplikat
 * perilaku render, hanya prediksi warna teks efektif.
 */
import type { WhiteboardElement } from "./state.js";

/** Kanvas whiteboard selalu putih bersih. */
export const WHITE_CANVAS = "#ffffff";

/** Rasio kontras minimum WCAG AA untuk teks normal. */
export const MIN_LABEL_CONTRAST = 4.5;

/**
 * Fill terang yang dirender dengan label gelap (kanvas putih).
 * Mirror `LIGHT_SHAPE_FILLS` di `app/.../canvas-palette.ts` — ubah
 * di kedua tempat bila palet bertambah.
 */
const LIGHT_SHAPE_FILLS = ['#e4e4e7', '#6ea8fe', '#f2b8c6', '#34c38e', '#5db69b', '#a78bfa', '#e8b955'];

function shapeFillMode(fill: unknown): "solid" | "transparent" | "none" {
  if (fill === "solid" || fill === "transparent" || fill === "none") return fill;
  return fill === true ? "transparent" : "none";
}

function isLightShapeFill(fill: unknown, color: string): boolean {
  return shapeFillMode(fill) !== "none" && LIGHT_SHAPE_FILLS.includes(color.toLowerCase());
}

/** Parse `#rgb` / `#rrggbb` → [r, g, b]; format lain (nama, rgba, token) → null = lolos. */
export function parseHexColor(color: unknown): [number, number, number] | null {
  if (typeof color !== "string") return null;
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return null;
  const h = m[1]!;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rasio kontras WCAG dua warna hex; null bila salah satu tak terparse. */
export function contrastRatio(fg: unknown, bg: unknown): number | null {
  const f = parseHexColor(fg);
  const b = parseHexColor(bg);
  if (!f || !b) return null;
  const l1 = luminance(f);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export interface EffectiveLabel {
  /** Warna teks efektif yang dirender. */
  fg: string;
  /** Warna background di balik teks. */
  bg: string;
  /** Field yang menentukan warna (untuk pesan fix). */
  field: string;
}

/**
 * Prediksi pasangan fg/bg label suatu elemen, mengikuti renderer:
 * - sticky: teks di atas fill sticky (`color`); default teks near-black.
 * - shape solid gelap: label terang di atas fill (kontras dijamin renderer) → null.
 * - shape solid terang: label gelap di atas fill (dijamin renderer) → null.
 * - shape transparent/none: teks di atas putih; fill terang → gelap (null),
 *   selain itu ikut warna cat — cek kontrasnya.
 * - text/edge label/boundary label: teks di atas putih.
 * Null = tidak ada teks terlihat / kontras dijamin renderer / warna tak terparse.
 */
export function effectiveLabel(el: WhiteboardElement): EffectiveLabel | null {
  const e = el as any;
  switch (el.kind) {
    case "sticky": {
      if (!e.text) return null;
      return { fg: e.textColor ?? "#060504", bg: e.color ?? "#e8b955", field: "textColor" };
    }
    case "shape": {
      if (!e.label) return null;
      if (e.labelColor) {
        const mode = shapeFillMode(e.fill);
        const paint = e.fillColor ?? e.color ?? "#6ea8fe";
        return { fg: e.labelColor, bg: mode === "solid" ? paint : WHITE_CANVAS, field: "labelColor" };
      }
      const mode = shapeFillMode(e.fill);
      const paint: string = e.fillColor ?? e.color ?? "#6ea8fe";
      if (mode === "solid") return null; // renderer: terang↔gelap otomatis
      if (isLightShapeFill(e.fill, paint)) return null; // renderer pakai #0f172a
      return { fg: paint, bg: WHITE_CANVAS, field: "color" };
    }
    case "text": {
      if (!e.text) return null;
      return { fg: e.color ?? "#e4e4e7", bg: WHITE_CANVAS, field: "color" };
    }
    case "edge": {
      if (!e.label) return null;
      return { fg: e.color ?? "#e4e4e7", bg: WHITE_CANVAS, field: "color" };
    }
    case "boundary": {
      if (!e.label) return null;
      return { fg: e.labelColor ?? "#374151", bg: WHITE_CANVAS, field: "labelColor" };
    }
    default:
      return null;
  }
}

/**
 * Panduan kontras untuk deskripsi tool MCP (dipakai create/update/validate/layout).
 */
export const CONTRAST_GUIDE =
  'Canvas is always white: a shape label follows the stroke color when fill is "none", and edge labels reuse the line color — ' +
  'pastel strokes need an explicit dark labelColor "#0f172a" (label contrast >= 4.5:1, flagged by validate_whiteboard).';

/** True bila label elemen di bawah ambang kontras (non-hex lolos). */
export function isLowContrastLabel(el: WhiteboardElement): { ratio: number; fg: string; bg: string; field: string } | null {
  const eff = effectiveLabel(el);
  if (!eff) return null;
  const ratio = contrastRatio(eff.fg, eff.bg);
  if (ratio === null) return null;
  if (ratio >= MIN_LABEL_CONTRAST) return null;
  return { ratio, fg: eff.fg, bg: eff.bg, field: eff.field };
}
