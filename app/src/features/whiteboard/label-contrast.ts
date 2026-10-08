/**
 * Kontras label whiteboard vs kanvas putih (mirror server
 * `server/.../projects/domain/color-contrast.ts`).
 *
 * Memakai `shapeLabelFill` renderer langsung sehingga warna teks efektif
 * yang diprediksi validator == yang digambar kanvas. Dipakai oleh
 * `validateWhiteboardShowcase` untuk peringatan advisory
 * `whiteboard/low-contrast-label` (tidak memblokir simpan).
 */
import type { WhiteboardElement } from '../../lib/types';
import { shapeFillMode, shapeLabelFill, shapePaintColor } from './canvas-palette';

export const WHITE_CANVAS = '#ffffff';
export const MIN_LABEL_CONTRAST = 4.5;

export function parseHexColor(color: unknown): [number, number, number] | null {
  if (typeof color !== 'string') return null;
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return null;
  const h = m[1]!;
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
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
  fg: string;
  bg: string;
  field: string;
}

/** Prediksi pasangan fg/bg label mengikuti renderer kanvas. Null = tak ada teks / non-hex. */
export function effectiveLabel(el: WhiteboardElement): EffectiveLabel | null {
  const e = el as any;
  switch (el.kind) {
    case 'sticky': {
      if (!e.text) return null;
      return { fg: e.textColor ?? '#060504', bg: e.color ?? '#e8b955', field: 'textColor' };
    }
    case 'shape': {
      if (!e.label) return null;
      const paint = shapePaintColor(e.color ?? '#6ea8fe', e.fillColor);
      const mode = shapeFillMode(e.fill);
      return {
        fg: shapeLabelFill(e.fill, paint, e.labelColor),
        bg: mode === 'solid' ? paint : WHITE_CANVAS,
        field: (e.labelColor ? 'labelColor' : mode === 'solid' ? 'labelColor' : 'color') as string,
      };
    }
    case 'text': {
      if (!e.text) return null;
      return { fg: e.color ?? '#e4e4e7', bg: WHITE_CANVAS, field: 'color' };
    }
    case 'edge': {
      if (!e.label) return null;
      return { fg: e.color ?? '#e4e4e7', bg: WHITE_CANVAS, field: 'color' };
    }
    case 'boundary': {
      if (!e.label) return null;
      return { fg: e.labelColor ?? '#374151', bg: WHITE_CANVAS, field: 'labelColor' };
    }
    default:
      return null;
  }
}

export function isLowContrastLabel(el: WhiteboardElement): { ratio: number; fg: string; bg: string; field: string } | null {
  const eff = effectiveLabel(el);
  if (!eff) return null;
  const ratio = contrastRatio(eff.fg, eff.bg);
  if (ratio === null) return null;
  if (ratio >= MIN_LABEL_CONTRAST) return null;
  return { ratio, fg: eff.fg, bg: eff.bg, field: eff.field };
}
