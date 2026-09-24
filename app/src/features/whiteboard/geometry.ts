import type { WhiteboardElement, WhiteboardShape } from '../../lib/types';

export interface ViewState {
  x: number;
  y: number;
  s: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function screenToWorld(view: ViewState, px: number, py: number): { x: number; y: number } {
  return { x: (px - view.x) / view.s, y: (py - view.y) / view.s };
}

export function worldToScreen(view: ViewState, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * view.s + view.x, y: wy * view.s + view.y };
}

export function panBy(view: ViewState, dx: number, dy: number): ViewState {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

export function clampZoom(s: number, min = 0.3, max = 3): number {
  return Math.min(max, Math.max(min, s));
}

export function zoomAtPoint(
  view: ViewState,
  px: number,
  py: number,
  factor: number,
  min = 0.3,
  max = 3,
): ViewState {
  const s2 = clampZoom(view.s * factor, min, max);
  const k = s2 / view.s;
  return { s: s2, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

const REF_W = 180;
const REF_H = 44;
const TEXT_LINE_H = 20;

/** Normalized data driving the expanded ref card render + its auto-height bounds. */
export interface RefCardData {
  title: string;
  meta: string;
  sub?: string;
  labels: string[];
  hours?: string;
  counts: string[];
  description: string;
}

export const REF_LAYOUT = {
  collapsedW: REF_W,
  collapsedH: REF_H,
  expandedW: 260,
  pad: 8,
  titleH: 18,
  rowH: 15,
  descLineH: 13,
  toggle: { w: 14, h: 14, rightOff: 19, topOff: 6 },
} as const;

/** Per-entity accent for ref cards (border, title, chips, toggle). Single source for canvas + export. */
export interface RefEntityAccent {
  color: string;
  softFill: string;
  chipFill: string;
  toggleFill: string;
}
// Aksen digelapkan agar judul/toggle card terbaca di kanvas putih
// (issues merah sudah cukup kontras → dipertahankan).
const TASK_REF_ACCENT: RefEntityAccent = {
  color: '#2563eb',
  softFill: 'rgba(37,99,235,0.10)',
  chipFill: 'rgba(37,99,235,0.18)',
  toggleFill: 'rgba(37,99,235,0.25)',
};
export const REF_ENTITY_ACCENT: Record<string, RefEntityAccent> = {
  tasks: TASK_REF_ACCENT,
  issues: { color: '#f2555a', softFill: 'rgba(242,85,90,0.10)', chipFill: 'rgba(242,85,90,0.18)', toggleFill: 'rgba(242,85,90,0.25)' },
  testCases: { color: '#7c3aed', softFill: 'rgba(124,58,237,0.10)', chipFill: 'rgba(124,58,237,0.18)', toggleFill: 'rgba(124,58,237,0.25)' },
  milestones: { color: '#047857', softFill: 'rgba(4,120,87,0.10)', chipFill: 'rgba(4,120,87,0.18)', toggleFill: 'rgba(4,120,87,0.25)' },
  techEntries: { color: '#0e7490', softFill: 'rgba(14,116,144,0.10)', chipFill: 'rgba(14,116,144,0.18)', toggleFill: 'rgba(14,116,144,0.25)' },
  decisions: { color: '#b45309', softFill: 'rgba(180,83,9,0.10)', chipFill: 'rgba(180,83,9,0.18)', toggleFill: 'rgba(180,83,9,0.25)' },
  tables: { color: '#db2777', softFill: 'rgba(219,39,119,0.10)', chipFill: 'rgba(219,39,119,0.18)', toggleFill: 'rgba(219,39,119,0.25)' },
  apiCollections: { color: '#ea580c', softFill: 'rgba(234,88,12,0.10)', chipFill: 'rgba(234,88,12,0.18)', toggleFill: 'rgba(234,88,12,0.25)' },
  apiEndpoints: { color: '#64748b', softFill: 'rgba(100,116,139,0.10)', chipFill: 'rgba(100,116,139,0.18)', toggleFill: 'rgba(100,116,139,0.25)' },
};
/** Unknown entities fall back to the task (blue) accent. */
export function refEntityAccent(entity: string): RefEntityAccent {
  return REF_ENTITY_ACCENT[entity] ?? TASK_REF_ACCENT;
}

/** One text block of the expanded ref card: baseline of the first line + its wrapped lines. */
export interface RefCardBlock {
  y: number;
  step: number;
  lines: string[];
}

/** Positioned layout of the expanded ref card. Single source of truth for render + bounds. */
export interface RefCardLayout {
  title: RefCardBlock;
  meta: RefCardBlock;
  sub: RefCardBlock | null;
  labelRows: { y: number; labels: string[] }[];
  counts: RefCardBlock | null;
  desc: RefCardBlock | null;
  height: number;
}

export function refCardLayout(data: RefCardData): RefCardLayout {
  const { pad, titleH, rowH, descLineH } = REF_LAYOUT;
  const innerW = REF_LAYOUT.expandedW - pad * 2;
  const titleW = innerW - REF_LAYOUT.toggle.rightOff;
  // Title renders bold (600) — measure with the same weight or long titles overflow.
  const titleLines = wrapToWidth(data.title, 12, titleW, Infinity, 600);
  const metaLines = wrapToWidth(data.meta, 10, innerW);
  const subLines = data.sub ? wrapToWidth(data.sub, 10, innerW) : [];
  const countsText = [data.hours, ...data.counts].filter(Boolean).join(' · ');
  const countsLines = countsText ? wrapToWidth(countsText, 10, innerW) : [];
  const descLines = data.description ? wrapToWidth(data.description, 10, innerW) : [];

  const labelRows: { y: number; labels: string[] }[] = [];
  if (data.labels.length > 0) {
    let row: string[] = [];
    let lx = 0;
    for (const label of data.labels) {
      const cw = label.length * CHIP_CHAR_W + 12;
      if (row.length > 0 && lx + cw > innerW) {
        labelRows.push({ y: 0, labels: row });
        row = [label];
        lx = cw + 4;
      } else {
        row.push(label);
        lx += cw + 4;
      }
    }
    if (row.length > 0) labelRows.push({ y: 0, labels: row });
  }

  const title: RefCardBlock = { y: pad + 13, step: titleH, lines: titleLines };
  const meta: RefCardBlock = {
    y: title.y + titleLines.length * titleH - 3,
    step: rowH,
    lines: metaLines,
  };
  const sub: RefCardBlock | null = subLines.length > 0 ? { y: meta.y + metaLines.length * rowH, step: rowH, lines: subLines } : null;
  let rowsY = sub ? sub.y + subLines.length * rowH : meta.y + metaLines.length * rowH;
  for (const row of labelRows) {
    row.y = rowsY;
    rowsY += rowH;
  }
  const counts: RefCardBlock | null = countsLines.length > 0 ? { y: rowsY, step: rowH, lines: countsLines } : null;
  const descY = counts ? counts.y + countsLines.length * rowH : rowsY;
  const desc: RefCardBlock | null = descLines.length > 0 ? { y: descY, step: descLineH, lines: descLines } : null;
  const height = (desc ? desc.y + descLines.length * descLineH : descY) + pad;
  return { title, meta, sub, labelRows, counts, desc, height };
}

export function refCardRect(
  el: { x: number; y: number },
  data: RefCardData | null,
  collapsed: boolean,
): Rect {
  if (collapsed || !data) return { x: el.x, y: el.y, w: REF_LAYOUT.collapsedW, h: REF_LAYOUT.collapsedH };
  return { x: el.x, y: el.y, w: REF_LAYOUT.expandedW, h: refCardLayout(data).height };
}

/** Truncates a single line to fit maxWidth, appending an ellipsis. */
export function truncateToWidth(text: string, fontSize: number, maxWidth: number, weight = 400): string {
  if (approxTextWidth(text, fontSize, weight) <= maxWidth) return text;
  let lo = 1;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (approxTextWidth(text.slice(0, mid), fontSize, weight) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, Math.max(1, lo - 1))}…`;
}

/** Greedy word wrap by measured width; hard-breaks over-long words. No line cap when maxLines is omitted. */
export function wrapToWidth(text: string, fontSize: number, maxWidth: number, maxLines = Infinity, weight = 400): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  const pushLine = (line: string) => {
    lines.push(line);
    return lines.length >= maxLines;
  };
  for (const word of words) {
    if (approxTextWidth(word, fontSize, weight) <= maxWidth) {
      const candidate = current ? `${current} ${word}` : word;
      if (approxTextWidth(candidate, fontSize, weight) > maxWidth && current) {
        if (pushLine(current)) return lines;
        current = word;
      } else {
        current = candidate;
      }
      continue;
    }
    if (current && pushLine(current)) return lines;
    current = '';
    // Hard-break over-long words by measured width (not a fixed char count)
    // so committed render breaks at the same points as the live editor.
    // Mirrors truncateToWidth's binary search; cut < rest.length guarantees progress.
    let rest = word;
    while (rest.length > 1 && approxTextWidth(rest, fontSize, weight) > maxWidth) {
      let lo = 1;
      let hi = rest.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (approxTextWidth(rest.slice(0, mid), fontSize, weight) <= maxWidth) lo = mid;
        else hi = mid - 1;
      }
      const cut = Math.max(1, lo);
      if (pushLine(rest.slice(0, cut))) return lines;
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

/** Estimated glyph width per latin char at 9px chip text (0.62em). */
export const CHIP_CHAR_W = 5.6;

/**
 * Boundary label chip: vertical offset of the chip text baseline from the
 * boundary top edge. Chip height scales with the font (1.5×) around the
 * baseline, so the chip sits fully INSIDE the border (top-left corner),
 * never straddling the dashed line. Shared by canvas render, SVG export
 * and the inline edit overlay (keep the three in sync).
 */
export const BOUNDARY_LABEL_DY = 18;

/**
 * Lebar chip label boundary mengikuti teks: ukur asli via canvas 2D bila
 * tersedia, estimator bila tidak (jsdom/export). Padding 12px, dibatasi
 * lebar boundary agar tak meluber keluar garis.
 */
export function boundaryChipWidth(label: string, fontSize: number, maxW: number, bold = false): number {
  const textW = approxTextWidth(label, fontSize, bold ? 600 : 400);
  return Math.min(textW + 12, Math.max(20, maxW));
}

const MEASURE_STACK =
  "'Geist Variable', 'Geist Mono Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
let measureCtx: CanvasRenderingContext2D | null | undefined;
const measureCache = new Map<string, number>();
if (typeof document !== 'undefined' && typeof document.fonts !== 'undefined') {
  // Webfont fallback metrics may be cached before Geist loads — drop them once ready.
  document.fonts.ready.then(() => measureCache.clear()).catch(() => {});
}

/** Real glyph width via canvas 2D when available; tuned estimator otherwise (jsdom). */
function measureTextWidth(text: string, fontSize: number, weight: number): number {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  if (measureCtx) {
    const key = `${fontSize}|${weight}|${text}`;
    const cached = measureCache.get(key);
    if (cached !== undefined) return cached;
    if (measureCache.size > 5000) measureCache.clear();
    // Skala DPR saja (tajam di zoom 200%): ukur pada font ×dpr lalu bagi dpr.
    // Logika layout/wrap tak berubah — hasil dinormalisasi ke CSS px.
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    measureCtx.font = `${weight} ${fontSize * dpr}px ${MEASURE_STACK}`;
    const w = measureCtx.measureText(text).width / dpr;
    measureCache.set(key, w);
    return w;
  }
  let w = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    w += c > 0x2e7f ? 1 : c === 0x20 ? 0.3 : 0.62; // CJK/wide 1em, space 0.3em, latin 0.62em
  }
  // Conservative bold widening so the no-canvas fallback never under-measures
  // bold (600) render text. Weight-400 paths are byte-identical to before.
  const bold = weight >= 600 ? 1.06 : 1;
  return Math.max(w * fontSize * bold, 40);
}

function approxTextWidth(text: string, fontSize: number, weight = 400): number {
  return measureTextWidth(text, fontSize, weight);
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Closed polygon from absolute points (single subpath). */
function polyPath(pts: Array<[number, number]>): string {
  return `M ${pts.map(([px, py]) => `${r2(px)} ${r2(py)}`).join(' L ')} Z`;
}

/** Regular n-gon inscribed in the box, first vertex at rotDeg. */
function ngonPath(x: number, y: number, w: number, h: number, n: number, rotDeg = -90): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i += 1) {
    const a = ((rotDeg + (360 / n) * i) * Math.PI) / 180;
    pts.push([cx + (w / 2) * Math.cos(a), cy + (h / 2) * Math.sin(a)]);
  }
  return polyPath(pts);
}

/** Star/burst with alternating outer/inner radius. */
function starPath(
  x: number,
  y: number,
  w: number,
  h: number,
  points: number,
  innerRatio: number,
  rotDeg = -90,
): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? 1 : innerRatio;
    const a = ((rotDeg + (180 / points) * i) * Math.PI) / 180;
    pts.push([cx + (w / 2) * r * Math.cos(a), cy + (h / 2) * r * Math.sin(a)]);
  }
  return polyPath(pts);
}

/** Stroked circle subpath (composable inside multi-part symbols). */
function circleSub(cx: number, cy: number, r: number): string {
  const rr = Math.max(0.5, r);
  return `M ${r2(cx - rr)} ${r2(cy)} a ${r2(rr)} ${r2(rr)} 0 1 0 ${r2(rr * 2)} 0 a ${r2(rr)} ${r2(rr)} 0 1 0 ${r2(-rr * 2)} 0 Z`;
}

function hline(x1: number, x2: number, y: number): string {
  return `M ${r2(x1)} ${r2(y)} L ${r2(x2)} ${r2(y)}`;
}

function vline(x: number, y1: number, y2: number): string {
  return `M ${r2(x)} ${r2(y1)} L ${r2(x)} ${r2(y2)}`;
}

export function shapePath(shape: WhiteboardShape): string {
  const { x, y, w, h } = shape;
  switch (shape.shapeType) {
    case 'diamond':
      return `M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z`;
    case 'ellipse':
      return `M ${x + w / 2} ${y} a ${w / 2} ${h / 2} 0 1 0 0.01 0 Z`;
    case 'cylinder': {
      const ry = Math.max(2, h * 0.2);
      const cy = y + ry;
      return `M ${x} ${cy} a ${w / 2} ${ry} 0 0 0 ${w} 0 v ${h - 2 * ry} a ${w / 2} ${ry} 0 0 1 ${-w} 0 Z`;
    }
    case 'parallelogram':
      return `M ${x + w * 0.25} ${y} L ${x + w} ${y} L ${x + w * 0.75} ${y + h} L ${x} ${y + h} Z`;
    case 'hexagon':
      return `M ${x + w / 2} ${y} L ${x + w} ${y + h * 0.25} L ${x + w} ${y + h * 0.75} L ${x + w / 2} ${y + h} L ${x} ${y + h * 0.75} L ${x} ${y + h * 0.25} Z`;
    case 'roundedRect': {
      const r = Math.min(w, h) / 4;
      return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z`;
    }
    // --- Basic extended (FigJam parity set) ---
    case 'triangleRight':
      return polyPath([
        [x, y],
        [x + w, y + h / 2],
        [x, y + h],
      ]);
    case 'hCylinder': {
      const rx = Math.max(2, w * 0.2);
      return `M ${x + rx} ${y} a ${rx} ${h / 2} 0 0 0 0 ${h} h ${w - 2 * rx} a ${rx} ${h / 2} 0 0 1 0 ${-h} Z`;
    }
    case 'trapezoid':
      return polyPath([
        [x + w * 0.15, y],
        [x + w * 0.85, y],
        [x + w, y + h],
        [x, y + h],
      ]);
    case 'trapezoidRight':
      return polyPath([
        [x, y],
        [x + w, y],
        [x + w * 0.75, y + h],
        [x, y + h],
      ]);
    case 'pentagon':
      return ngonPath(x, y, w, h, 5, -90);
    case 'octagon':
      return ngonPath(x, y, w, h, 8, -112.5);
    case 'document': {
      const f = Math.min(14, w * 0.2, h * 0.25);
      return `M ${x} ${y} h ${w - f} l ${f} ${f} v ${h - f} h ${-w} Z M ${x + w - f} ${y} L ${x + w - f} ${y + f} L ${x + w} ${y + f}`;
    }
    case 'snipRect': {
      const c = Math.min(14, w * 0.25, h * 0.25);
      return polyPath([
        [x + c, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y + c],
      ]);
    }
    case 'chamferRect': {
      const c = Math.min(10, w * 0.2, h * 0.2);
      return polyPath([
        [x + c, y],
        [x + w - c, y],
        [x + w, y + c],
        [x + w, y + h - c],
        [x + w - c, y + h],
        [x + c, y + h],
        [x, y + h - c],
        [x, y + c],
      ]);
    }
    case 'roundedDiamond': {
      // Diamond with quadratic-rounded vertices (r = 8 world units).
      const k = 8;
      const cxd = x + w / 2;
      const cyd = y + h / 2;
      const v: Array<[number, number]> = [
        [cxd, y],
        [x + w, cyd],
        [cxd, y + h],
        [x, cyd],
      ];
      let d = '';
      for (let i = 0; i < 4; i += 1) {
        const prev = v[(i + 3) % 4]!;
        const cur = v[i]!;
        const next = v[(i + 1) % 4]!;
        const v1 = [cur[0]! - prev[0]!, cur[1]! - prev[1]!];
        const v2 = [next[0]! - cur[0]!, next[1]! - cur[1]!];
        const l1 = Math.hypot(v1[0]!, v1[1]!) || 1;
        const l2 = Math.hypot(v2[0]!, v2[1]!) || 1;
        const kk = Math.min(k, l1 / 2, l2 / 2);
        const p1: [number, number] = [cur[0]! - (v1[0]! / l1) * kk, cur[1]! - (v1[1]! / l1) * kk];
        const p2: [number, number] = [cur[0]! + (v2[0]! / l2) * kk, cur[1]! + (v2[1]! / l2) * kk];
        d += `${i === 0 ? `M ${r2(p1[0])} ${r2(p1[1])}` : `L ${r2(p1[0])} ${r2(p1[1])}`} Q ${r2(cur[0])} ${r2(cur[1])} ${r2(p2[0])} ${r2(p2[1])} `;
      }
      return `${d}Z`;
    }
    case 'plusBlock': {
      const a = w / 3;
      const b = h / 3;
      return polyPath([
        [x + a, y],
        [x + 2 * a, y],
        [x + 2 * a, y + b],
        [x + w, y + b],
        [x + w, y + 2 * b],
        [x + 2 * a, y + 2 * b],
        [x + 2 * a, y + h],
        [x + a, y + h],
        [x + a, y + 2 * b],
        [x, y + 2 * b],
        [x, y + b],
        [x + a, y + b],
      ]);
    }
    case 'chevronRight': {
      const t = h * 0.35;
      const dpt = w * 0.55;
      const cy = y + h / 2;
      return polyPath([
        [x, y],
        [x + w, cy],
        [x, y + h],
        [x, y + h - t],
        [x + w - dpt, cy],
        [x, y + t],
      ]);
    }
    case 'doubleChevron': {
      const t = h * 0.35;
      const hw = w / 2;
      const cy = y + h / 2;
      const one = (ox: number, ww: number): string =>
        polyPath([
          [ox, y],
          [ox + ww, cy],
          [ox, y + h],
          [ox, y + h - t],
          [ox + ww - ww * 0.55, cy],
          [ox, y + t],
        ]);
      return `${one(x, hw)} ${one(x + hw, hw)}`;
    }
    case 'pentagonRight':
      return polyPath([
        [x, y],
        [x + w * 0.6, y],
        [x + w, y + h / 2],
        [x + w * 0.6, y + h],
        [x, y + h],
      ]);
    case 'star5':
      return starPath(x, y, w, h, 5, 0.45, -90);
    case 'star4':
      return starPath(x, y, w, h, 4, 0.28, 0);
    case 'sealBurst':
      return starPath(x, y, w, h, 12, 0.88, -90);
    case 'shieldBox': {
      const cx = x + w / 2;
      return polyPath([
        [x, y],
        [x + w, y],
        [x + w, y + h * 0.55],
        [cx, y + h],
        [x, y + h * 0.55],
      ]);
    }
    case 'semicircle':
      return `M ${x} ${y + h / 2} A ${w / 2} ${h / 2} 0 0 1 ${x + w} ${y + h / 2} Z`;
    case 'pieSlice': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `M ${cx} ${cy} L ${x + w} ${cy} A ${w / 2} ${h / 2} 0 0 0 ${cx} ${y} Z`;
    }
    case 'nutHex': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `${ngonPath(x, y, w, h, 6, -90)} ${circleSub(cx, cy, Math.min(w, h) * 0.22)}`;
    }
    case 'cubeBox': {
      const cx = x + w / 2;
      const top = polyPath([
        [cx, y],
        [x + w, y + h * 0.25],
        [cx, y + h * 0.5],
        [x, y + h * 0.25],
      ]);
      const left = polyPath([
        [x, y + h * 0.25],
        [cx, y + h * 0.5],
        [cx, y + h],
        [x, y + h * 0.75],
      ]);
      const right = polyPath([
        [cx, y + h * 0.5],
        [x + w, y + h * 0.25],
        [x + w, y + h * 0.75],
        [cx, y + h],
      ]);
      return `${top} ${left} ${right}`;
    }
    case 'envelopeBox':
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${x} ${y} L ${x + w / 2} ${y + h * 0.45} L ${x + w} ${y}`;
    case 'calendarBox': {
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${hline(x, x + w, y + h * 0.25)} ${circleSub(x + w * 0.3, y, 3)} ${circleSub(x + w * 0.7, y, 3)}`;
    }
    case 'clockFace': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.42;
      const dots = [0, 90, 180, 270]
        .map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return circleSub(cx + r * 0.78 * Math.cos(a), cy + r * 0.78 * Math.sin(a), 1.2);
        })
        .join(' ');
      return `${circleSub(cx, cy, r)} M ${r2(cx)} ${r2(cy)} L ${r2(cx)} ${r2(cy - r * 0.55)} M ${r2(cx)} ${r2(cy)} L ${r2(cx + r * 0.4)} ${r2(cy + r * 0.25)} ${dots}`;
    }
    // --- Flowchart symbols (distinct geometries only; plain rect/diamond/etc live in Basic) ---
    case 'predefinedProcess':
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${vline(x + w * 0.15, y, y + h)} ${vline(x + w * 0.85, y, y + h)}`;
    case 'manualInput':
      return polyPath([
        [x + w * 0.12, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ]);
    case 'offPageRef':
      return ngonPath(x, y, w, h, 5, 90);
    case 'delayHalf': {
      const r = Math.min(h / 2, w);
      return `M ${x} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x} Z`;
    }
    case 'multiDocument': {
      const f = Math.min(14, w * 0.2, h * 0.25);
      return `M ${x} ${y} h ${w - f} l ${f} ${f} v ${h - f} h ${-w} Z M ${x + 7} ${y - 7} h ${w} v ${h} h ${-w} Z`;
    }
    case 'orJunction': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.42;
      const k = 0.3;
      return `${circleSub(cx, cy, r)} M ${r2(x + w * k)} ${r2(y + h * k)} L ${r2(x + w * (1 - k))} ${r2(y + h * (1 - k))} M ${r2(x + w * (1 - k))} ${r2(y + h * k)} L ${r2(x + w * k)} ${r2(y + h * (1 - k))}`;
    }
    case 'sumJunction': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.42;
      return `${circleSub(cx, cy, r)} ${vline(cx, cy - r * 0.6, cy + r * 0.6)} ${hline(cx - r * 0.6, cx + r * 0.6, cy)}`;
    }
    case 'crossDoc': {
      const k = 0.3;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${r2(x + w * k)} ${r2(y + h * k)} L ${r2(x + w * (1 - k))} ${r2(y + h * (1 - k))} M ${r2(x + w * (1 - k))} ${r2(y + h * k)} L ${r2(x + w * k)} ${r2(y + h * (1 - k))}`;
    }
    // --- BPMN symbols ---
    case 'intermediateRing': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.42;
      return `${circleSub(cx, cy, r)} ${circleSub(cx, cy, r * 0.68)}`;
    }
    case 'messageEvent': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.42;
      const ew = r * 0.9;
      const eh = r * 0.62;
      return `${circleSub(cx, cy, r)} M ${r2(cx - ew / 2)} ${r2(cy - eh / 2)} h ${r2(ew)} v ${r2(eh)} h ${r2(-ew)} Z M ${r2(cx - ew / 2)} ${r2(cy - eh / 2)} L ${r2(cx)} ${r2(cy + eh * 0.1)} L ${r2(cx + ew / 2)} ${r2(cy - eh / 2)}`;
    }
    case 'timerEvent': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.42;
      return `${circleSub(cx, cy, r)} M ${r2(cx)} ${r2(cy)} L ${r2(cx)} ${r2(cy - r * 0.55)} M ${r2(cx)} ${r2(cy)} L ${r2(cx + r * 0.42)} ${r2(cy + r * 0.2)}`;
    }
    case 'errorEvent': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.42;
      return `${circleSub(cx, cy, r)} M ${r2(cx + r * 0.15)} ${r2(cy - r * 0.6)} L ${r2(cx - r * 0.25)} ${r2(cy + r * 0.1)} L ${r2(cx + r * 0.05)} ${r2(cy + r * 0.1)} L ${r2(cx - r * 0.15)} ${r2(cy + r * 0.6)}`;
    }
    case 'exclusiveGateway': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const k = 0.32;
      return `${polyPath([
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ])} M ${r2(x + w * k)} ${r2(y + h * k)} L ${r2(x + w * (1 - k))} ${r2(y + h * (1 - k))} M ${r2(x + w * (1 - k))} ${r2(y + h * k)} L ${r2(x + w * k)} ${r2(y + h * (1 - k))}`;
    }
    case 'parallelGateway': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `${polyPath([
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ])} ${vline(cx, cy - h * 0.2, cy + h * 0.2)} ${hline(cx - w * 0.2, cx + w * 0.2, cy)}`;
    }
    case 'inclusiveGateway': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `${polyPath([
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ])} ${circleSub(cx, cy, Math.min(w, h) * 0.2)}`;
    }
    case 'complexGateway': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const k = 0.2;
      return `${polyPath([
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ])} ${polyPath([
        [cx, cy - h * k],
        [cx + w * k, cy],
        [cx, cy + h * k],
        [cx - w * k, cy],
      ])}`;
    }
    case 'subProcess': {
      const r = Math.min(w, h) / 6;
      const s = Math.min(w, h) * 0.16;
      const cx = x + w / 2;
      return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z M ${r2(cx - s / 2)} ${r2(y + h - s - 4)} h ${r2(s)} v ${r2(s)} h ${r2(-s)} Z`;
    }
    case 'taskMarker': {
      const r = Math.min(w, h) / 6;
      const c = Math.min(12, w * 0.2, h * 0.3);
      return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z M ${x + 2} ${y + c} L ${x + c} ${y + 2}`;
    }
    // --- UML symbols ---
    case 'classBox':
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${hline(x, x + w, y + h / 3)} ${hline(x, x + w, y + (2 * h) / 3)}`;
    case 'packageBox': {
      const tw = w * 0.35;
      const th = Math.min(12, h * 0.2);
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${x} ${y} h ${tw} v ${th} h ${-tw} Z`;
    }
    case 'componentBox': {
      const s = Math.min(12, w * 0.14, h * 0.2);
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${x + w - 2} ${y + h * 0.25} h ${s} v ${s} h ${-s} Z M ${x + w - 2} ${y + h * 0.55} h ${s} v ${s} h ${-s} Z`;
    }
    case 'actorFigure': {
      const cx = x + w / 2;
      const hr = Math.min(w, h) * 0.11;
      const hy = y + h * 0.16;
      const sy = y + h * 0.3;
      const ey = y + h * 0.62;
      return `${circleSub(cx, hy, hr)} M ${r2(cx)} ${r2(sy)} L ${r2(cx)} ${r2(ey)} M ${r2(x + w * 0.28)} ${r2(y + h * 0.4)} L ${r2(x + w * 0.72)} ${r2(y + h * 0.4)} M ${r2(cx)} ${r2(ey)} L ${r2(x + w * 0.3)} ${r2(y + h)} M ${r2(cx)} ${r2(ey)} L ${r2(x + w * 0.7)} ${r2(y + h)}`;
    }
    case 'nodeBox': {
      const dx = w * 0.2;
      const dy = h * 0.2;
      return `M ${x} ${y + dy} h ${w - dx} v ${h - dy} h ${-(w - dx)} Z M ${x} ${y + dy} L ${x + dx} ${y} L ${x + w} ${y} L ${x + w - dx} ${y + dy} Z M ${x + w - dx} ${y + dy} L ${x + w} ${y} L ${x + w} ${y + h - dy} L ${x + w - dx} ${y + h} Z`;
    }
    case 'interfaceBall': {
      const cx = x + w / 2;
      const r = Math.min(w, h) * 0.3;
      const cy = y + h * 0.35;
      return `${circleSub(cx, cy, r)} M ${r2(cx)} ${r2(cy + r)} L ${r2(cx)} ${r2(y + h)}`;
    }
    case 'objectBox':
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${hline(x + 6, x + w - 6, y + h - 8)}`;
    case 'signalReceipt': {
      const n = w * 0.25;
      return polyPath([
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x + n, y + h / 2],
        [x, y],
      ]);
    }
    case 'partitionActivity': {
      const cx = x + w / 2;
      const r = Math.min(w, h) / 2;
      return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z ${vline(cx, y + 4, y + h - 4)}`;
    }
    case 'generalizationTri': {
      const cx = x + w / 2;
      const th = h * 0.7;
      return `${polyPath([
        [x + w * 0.2, y],
        [x + w * 0.8, y],
        [cx, y + th],
      ])} ${vline(cx, y + th, y + h)}`;
    }
    // --- ERD symbols ---
    case 'weakEntity': {
      const ix = w * 0.12;
      const iy = h * 0.12;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${x + ix} ${y + iy} h ${w - 2 * ix} v ${h - 2 * iy} h ${-(w - 2 * ix)} Z`;
    }
    case 'identifyingRel': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const k = 0.18;
      return `${polyPath([
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ])} ${polyPath([
        [cx, y + h * k],
        [x + w - w * k, cy],
        [cx, y + h - h * k],
        [x + w * k, cy],
      ])}`;
    }
    case 'multiAttribute': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      return `M ${r2(cx - rx)} ${r2(cy)} a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0 a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx * 2)} 0 Z ${vline(cx - w * 0.15, cy - h * 0.3, cy + h * 0.3)} ${vline(cx + w * 0.15, cy - h * 0.3, cy + h * 0.3)}`;
    }
    case 'keyAttribute': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `${(() => {
        const rx = w / 2;
        const ry = h / 2;
        return `M ${r2(cx - rx)} ${r2(cy)} a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0 a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx * 2)} 0 Z`;
      })()} ${hline(cx - w * 0.3, cx + w * 0.3, y + h - 6)}`;
    }
    case 'associativeBox': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const k = 0.22;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${polyPath([
        [cx, cy - h * k],
        [cx + w * k, cy],
        [cx, cy + h * k],
        [cx - w * k, cy],
      ])}`;
    }
    case 'categoryCluster': {
      const cx = x + w / 2;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${circleSub(cx, y + h, h * 0.12)} ${vline(cx, y + h, y + h + h * 0.12)}`;
    }
    case 'ternaryInner': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const k = 0.35;
      return `${polyPath([
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ])} ${polyPath([
        [cx, cy - h * k * 0.6],
        [cx + w * k * 0.5, cy + h * k * 0.4],
        [cx - w * k * 0.5, cy + h * k * 0.4],
      ])}`;
    }
    // --- Data-flow symbols ---
    case 'datastoreOpen':
      return `${hline(x, x + w, y)} ${hline(x, x + w, y + h)} ${vline(x, y, y + h)}`;
    case 'yourdonStore':
      return `${hline(x, x + w, y + h * 0.35)} ${hline(x, x + w, y + h * 0.65)}`;
    case 'diskStack': {
      const cx = x + w / 2;
      const rx = w * 0.42;
      const ry = h * 0.13;
      return [y + h * 0.25, y + h * 0.5, y + h * 0.75]
        .map(
          (ey) =>
            `M ${r2(cx - rx)} ${r2(ey)} a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0 a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx * 2)} 0 Z`,
        )
        .join(' ');
    }
    case 'fileRuled': {
      const f = Math.min(14, w * 0.2, h * 0.25);
      return `M ${x} ${y} h ${w - f} l ${f} ${f} v ${h - f} h ${-w} Z M ${x + w - f} ${y} L ${x + w - f} ${y + f} L ${x + w} ${y + f} ${hline(x + 8, x + w - 8, y + h * 0.45)} ${hline(x + 8, x + w - 8, y + h * 0.6)}`;
    }
    case 'punchCard': {
      const c = Math.min(14, w * 0.25, h * 0.25);
      const s = Math.min(10, w * 0.12, h * 0.16);
      const hx = x + w * 0.35;
      const hx2 = x + w * 0.6;
      const hy = y + h * 0.42;
      return `M ${x} ${y} L ${x + w - c} ${y} L ${x + w} ${y + c} L ${x + w} ${y + h} L ${x} ${y + h} Z M ${r2(hx)} ${r2(hy)} h ${r2(s)} v ${r2(s)} h ${r2(-s)} Z M ${r2(hx2)} ${r2(hy)} h ${r2(s)} v ${r2(s)} h ${r2(-s)} Z`;
    }
    // --- Network symbols ---
    case 'serverBox': {
      const ly1 = y + h * 0.35;
      const ly2 = y + h * 0.6;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${hline(x + 8, x + w * 0.3, ly1)} ${hline(x + 8, x + w * 0.3, ly2)} ${circleSub(x + w * 0.85, ly1, 2.5)} ${circleSub(x + w * 0.85, ly2, 2.5)}`;
    }
    case 'routerBox': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${circleSub(cx, cy, Math.min(w, h) * 0.25)}`;
    }
    case 'cloudShape': {
      return `M ${r2(x + w * 0.18)} ${r2(y + h * 0.78)} A ${r2(w * 0.16)} ${r2(h * 0.2)} 0 0 1 ${r2(x + w * 0.2)} ${r2(y + h * 0.42)} A ${r2(w * 0.2)} ${r2(h * 0.24)} 0 0 1 ${r2(x + w * 0.5)} ${r2(y + h * 0.22)} A ${r2(w * 0.17)} ${r2(h * 0.22)} 0 0 1 ${r2(x + w * 0.78)} ${r2(y + h * 0.4)} A ${r2(w * 0.15)} ${r2(h * 0.2)} 0 0 1 ${r2(x + w * 0.82)} ${r2(y + h * 0.78)} Z`;
    }
    case 'firewallBox': {
      const cy = y + h / 2;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${r2(x + w * 0.3)} ${r2(cy - h * 0.2)} L ${r2(x + w * 0.45)} ${r2(cy + h * 0.05)} L ${r2(x + w * 0.55)} ${r2(cy + h * 0.05)} L ${r2(x + w * 0.7)} ${r2(cy - h * 0.2)}`;
    }
    case 'antennaTower': {
      const cx = x + w / 2;
      const tw = w * 0.16;
      return `${polyPath([
        [cx - tw / 2, y + h * 0.3],
        [cx + tw / 2, y + h * 0.3],
        [cx, y],
      ])} ${vline(cx, y + h * 0.3, y + h)} ${(() => {
        const my = y + h * 0.42;
        const r = w * 0.1;
        return `M ${r2(cx - r)} ${r2(my)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(cx - r * 0.4)} ${r2(my - r * 0.9)} M ${r2(cx + r)} ${r2(my)} A ${r2(r)} ${r2(r)} 0 0 0 ${r2(cx + r * 0.4)} ${r2(my - r * 0.9)}`;
      })()}`;
    }
    case 'printerBox': {
      const pw = w * 0.5;
      const px = x + (w - pw) / 2;
      // Paper tray protrudes above the body; capped so small thumbs stay in-bounds.
      const tray = Math.min(12, h * 0.3);
      const trayH = Math.min(22, h * 0.8);
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${r2(px)} ${r2(y - tray)} h ${r2(pw)} v ${r2(trayH)} h ${r2(-pw)} Z`;
    }
    case 'switchStack': {
      const s = Math.min(12, w * 0.14, h * 0.24);
      const cy = y + h / 2;
      const xs = [0.22, 0.44, 0.66].map((f) => x + w * f - s / 2);
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${xs
        .map((sx) => `M ${r2(sx)} ${r2(cy - s / 2)} h ${r2(s)} v ${r2(s)} h ${r2(-s)} Z`)
        .join(' ')}`;
    }
    case 'hubSpoke': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.42;
      const spokes = [45, 135, 225, 315]
        .map((deg) => {
          const a = (deg * Math.PI) / 180;
          return `M ${r2(cx + r * 0.55 * Math.cos(a))} ${r2(cy + r * 0.55 * Math.sin(a))} L ${r2(cx + r * 0.8 * Math.cos(a))} ${r2(cy + r * 0.8 * Math.sin(a))}`;
        })
        .join(' ');
      return `${circleSub(cx, cy, r)} ${spokes}`;
    }
    case 'modemBox': {
      const cy = y + h / 2;
      const dots = [0.3, 0.5, 0.7].map((f) => circleSub(x + w * f, cy, 3)).join(' ');
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${dots}`;
    }
    case 'satelliteDish': {
      const cx = x + w / 2;
      return `M ${r2(x + w * 0.2)} ${r2(y + h * 0.25)} A ${r2(w * 0.3)} ${r2(h * 0.3)} 0 0 1 ${r2(x + w * 0.75)} ${r2(y + h * 0.55)} M ${r2(x + w * 0.55)} ${r2(y + h * 0.5)} L ${r2(cx)} ${r2(y + h * 0.72)} M ${r2(cx)} ${r2(y + h * 0.72)} L ${r2(cx)} ${r2(y + h)} ${hline(cx - w * 0.18, cx + w * 0.18, y + h)}`;
    }
    case 'laptopSlab': {
      const sy = y + h * 0.62;
      return `M ${r2(x + w * 0.1)} ${r2(y)} h ${r2(w * 0.8)} v ${r2(sy - y)} h ${r2(-w * 0.8)} Z ${polyPath([
        [x, y + h],
        [x + w, y + h],
        [x + w * 0.85, sy],
        [x + w * 0.15, sy],
      ])}`;
    }
    case 'rackCabinet':
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${hline(x, x + w, y + h * 0.2)} ${hline(x, x + w, y + h * 0.4)} ${hline(x, x + w, y + h * 0.6)} ${hline(x, x + w, y + h * 0.8)}`;
    case 'loadBalancer': {
      const cx = x + w / 2;
      return `${polyPath([
        [x + w * 0.2, y + h * 0.62],
        [x + w * 0.8, y + h * 0.62],
        [cx, y],
      ])} ${hline(x, x + w, y + h)} ${circleSub(cx, y + h, 3)}`;
    }
    // --- Kubernetes symbols (simplified glyphs; official image glyphs are a follow-up) ---
    case 'podHex': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.22;
      const ticks = [0, 60, 120, 180, 240, 300]
        .map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return `M ${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))} L ${r2(cx + r * 1.45 * Math.cos(a))} ${r2(cy + r * 1.45 * Math.sin(a))}`;
        })
        .join(' ');
      return `${ngonPath(x, y, w, h, 6, -90)} ${circleSub(cx, cy, r)} ${ticks}`;
    }
    case 'serviceMesh': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const dots = [0.3, 0.5, 0.7].map((f) => circleSub(x + w * f, cy, 2.5)).join(' ');
      return `M ${r2(cx - rx)} ${r2(cy)} a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0 a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx * 2)} 0 Z ${hline(cx - rx * 0.7, cx + rx * 0.7, cy)} ${dots}`;
    }
    case 'deployBox': {
      const bw = w * 0.16;
      const bars = [0.4, 0.6, 0.85].map((f, i) => {
        const bx = x + w * (0.2 + i * 0.24);
        const bh = (h - 8) * f;
        return `M ${r2(bx)} ${r2(y + h - 4 - bh)} h ${r2(bw)} v ${r2(bh)} h ${r2(-bw)} Z`;
      });
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${bars.join(' ')}`;
    }
    case 'ingressArrow': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2;
      const chx = cx - w * 0.12;
      return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z ${polyPath([
        [chx, cy - h * 0.18],
        [chx + w * 0.22, cy],
        [chx, cy + h * 0.18],
        [chx, cy + h * 0.18 - h * 0.12],
        [chx + w * 0.22 - w * 0.12, cy],
        [chx, cy - h * 0.18 + h * 0.12],
      ])}`;
    }
    case 'configBox':
      return `${polyPath([
        [x + w * 0.25, y],
        [x + w, y],
        [x + w * 0.75, y + h],
        [x, y + h],
      ])} ${hline(x + w * 0.2, x + w * 0.8, y + h * 0.35)} ${hline(x + w * 0.15, x + w * 0.75, y + h * 0.6)}`;
    case 'namespaceBox': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const inner: Array<[number, number]> = [];
      for (let i = 0; i < 6; i += 1) {
        const a = ((-90 + 60 * i) * Math.PI) / 180;
        inner.push([cx + ((w * 0.65) / 2) * Math.cos(a), cy + ((h * 0.65) / 2) * Math.sin(a)]);
      }
      return `${ngonPath(x, y, w, h, 6, -90)} ${polyPath(inner)}`;
    }
    case 'cronBox': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.3;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${r2(cx)} ${r2(cy)} L ${r2(cx)} ${r2(cy - r)} M ${r2(cx)} ${r2(cy)} L ${r2(cx + r * 0.7)} ${r2(cy + r * 0.4)}`;
    }
    case 'secretVault': {
      const cx = x + w / 2;
      const ky = y + h * 0.38;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z ${circleSub(cx, ky, h * 0.09)} M ${r2(cx)} ${r2(ky + h * 0.09)} L ${r2(cx)} ${r2(ky + h * 0.28)}`;
    }
    case 'bandedCylinder': {
      const ry = Math.max(2, h * 0.2);
      const cy = y + ry;
      return `M ${x} ${cy} a ${w / 2} ${ry} 0 0 0 ${w} 0 v ${h - 2 * ry} a ${w / 2} ${ry} 0 0 1 ${-w} 0 Z ${hline(x, x + w, cy + (h - 2 * ry) / 2)}`;
    }
    case 'sidecarBox': {
      const sw = w * 0.3;
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z M ${r2(x + w - 2)} ${r2(y + h * 0.3)} h ${r2(sw)} v ${r2(h * 0.4)} h ${r2(-sw)} Z`;
    }
    case 'readinessProbe': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `${polyPath([
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ])} M ${r2(cx - w * 0.14)} ${r2(cy)} L ${r2(cx - w * 0.03)} ${r2(cy + h * 0.12)} L ${r2(cx + w * 0.15)} ${r2(cy - h * 0.14)}`;
    }
    case 'replicaBars': {
      const bw = w * 0.16;
      const bars = [0.4, 0.65, 0.9].map((f, i) => {
        const bx = x + w * (0.14 + i * 0.28);
        const bh = (h - 4) * f;
        return `M ${r2(bx)} ${r2(y + h - 2 - bh)} h ${r2(bw)} v ${r2(bh)} h ${r2(-bw)} Z`;
      });
      return bars.join(' ');
    }
    case 'triangleUp':
      return `M ${x} ${y + h} L ${x + w / 2} ${y} L ${x + w} ${y + h} Z`;
    case 'triangleDown':
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w / 2} ${y + h} Z`;
    case 'capsule': {
      const r = Math.min(w, h) / 2;
      return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z`;
    }
    default:
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
  }
}

/** Line height used when rendering wrapped text elements (matches sticky line spacing). */
export function textLineHeight(fontSize: number): number {
  return Math.ceil(fontSize * 1.35);
}

/** Wraps text to maxWidth line by line, preserving explicit newlines (Shift+Enter). */
export function wrapTextLines(text: string, fontSize: number, maxWidth: number, weight = 400): string[] {
  return text.split('\n').flatMap((line) => wrapToWidth(line, fontSize, maxWidth, Infinity, weight));
}

export function elementBounds(el: Partial<WhiteboardElement> & { kind: string }): Rect {
  switch (el.kind) {
    case 'stroke': {
      const pts = el.points ?? [];
      if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [px, py] of pts) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
      const pad = (el.width ?? 2) / 2 + 2;
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    case 'sticky':
    case 'shape':
    case 'boundary':
    case 'embed':
      return { x: el.x ?? 0, y: el.y ?? 0, w: el.w ?? 0, h: el.h ?? 0 };
    case 'text': {
      const fontSize = el.fontSize ?? 16;
      const x = el.x ?? 0;
      const y = (el.y ?? 0) - fontSize;
      const wrapW = el.w ?? 0;
      if (wrapW > 0) {
        const lines = wrapTextLines(el.text ?? '', fontSize, wrapW);
        return { x, y, w: wrapW, h: lines.length * textLineHeight(fontSize) + 2 };
      }
      const w = approxTextWidth(el.text ?? '', fontSize);
      return { x, y, w, h: fontSize + 4 };
    }
    case 'edge': {
      const x1 = el.x1 ?? 0;
      const y1 = el.y1 ?? 0;
      const x2 = el.x2 ?? 0;
      const y2 = el.y2 ?? 0;
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
    }
    case 'ref':
      return { x: el.x ?? 0, y: el.y ?? 0, w: REF_W, h: REF_H };
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function unionBounds(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export const SNAP_STEP = 32;
export const SNAP_RADIUS = 8;
export const ALIGN_RADIUS = 4;

export function snapToGrid(value: number, step = SNAP_STEP, radius = SNAP_RADIUS): number {
  const mod = value % step;
  if (Math.abs(mod) <= radius) return value - mod;
  if (Math.abs(mod - step) <= radius) return value - mod + step;
  return value;
}

export interface Guide {
  axis: 'x' | 'y';
  coord: number;
  min: number;
  max: number;
}

function rectEdges(rect: Rect): { x: number[]; y: number[] } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return {
    x: [rect.x, cx, rect.x + rect.w],
    y: [rect.y, cy, rect.y + rect.h],
  };
}

/** Alignment guides between the moving selection bounds and other element bounds. */
export function alignmentGuides(bounds: Rect, others: Rect[]): { guides: Guide[]; dx: number; dy: number } {
  const moving = rectEdges(bounds);
  const guides: Guide[] = [];
  let dx = 0;
  let dy = 0;
  for (const other of others) {
    const edges = rectEdges(other);
    for (const mx of moving.x) {
      for (const ox of edges.x) {
        const d = ox - mx;
        if (Math.abs(d) <= ALIGN_RADIUS && (dx === 0 || Math.abs(d) < Math.abs(dx))) dx = d;
        if (Math.abs(d) <= ALIGN_RADIUS) {
          guides.push({ axis: 'x', coord: ox, min: Math.min(bounds.y, other.y), max: Math.max(bounds.y + bounds.h, other.y + other.h) });
        }
      }
    }
    for (const my of moving.y) {
      for (const oy of edges.y) {
        const d = oy - my;
        if (Math.abs(d) <= ALIGN_RADIUS && (dy === 0 || Math.abs(d) < Math.abs(dy))) dy = d;
        if (Math.abs(d) <= ALIGN_RADIUS) {
          guides.push({ axis: 'y', coord: oy, min: Math.min(bounds.x, other.x), max: Math.max(bounds.x + bounds.w, other.x + other.w) });
        }
      }
    }
  }
  return { guides, dx, dy };
}

/** Spreads selected elements evenly between the first and last along an axis. */
export function distributeSelection(
  elements: Array<{ id: string; x: number; y: number; w: number; h: number }>,
  ids: string[],
  axis: 'x' | 'y',
): Map<string, number> {
  const sel = elements.filter((el) => ids.includes(el.id));
  if (sel.length < 3) return new Map();
  // WB-9: distribute CENTERS so unequal widths keep even visual gaps.
  const center = (el: { x: number; y: number; w: number; h: number }) =>
    axis === 'x' ? el.x + el.w / 2 : el.y + el.h / 2;
  const size = (el: { w: number; h: number }) => (axis === 'x' ? el.w : el.h);
  const sorted = [...sel].sort((a, b) => center(a) - center(b));
  const firstC = center(sorted[0]!);
  const lastC = center(sorted[sorted.length - 1]!);
  const gap = (lastC - firstC) / (sorted.length - 1);
  const out = new Map<string, number>();
  for (let i = 1; i < sorted.length - 1; i += 1) {
    const el = sorted[i]!;
    out.set(el.id, firstC + gap * i - size(el) / 2);
  }
  return out;
}

export type MatchSizeMode = 'width' | 'height' | 'both';

/**
 * WB-9: match the size of the selection to the most recently selected element
 * (last id in `ids` is the reference, Figma key-object style).
 */
export function matchSizeSelection(
  elements: Array<{ id: string; w: number; h: number }>,
  ids: string[],
  mode: MatchSizeMode,
): Map<string, { w: number; h: number }> {
  const sel = elements.filter((el) => ids.includes(el.id));
  if (sel.length < 2) return new Map();
  const ref = sel.find((el) => el.id === ids[ids.length - 1]) ?? sel[0]!;
  const out = new Map<string, { w: number; h: number }>();
  for (const el of sel) {
    if (el.id === ref.id) continue;
    out.set(el.id, {
      w: mode === 'height' ? el.w : ref.w,
      h: mode === 'width' ? el.h : ref.h,
    });
  }
  return out;
}

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom';

/** Aligns selected elements against the selection's bounding box along one axis. */
export function alignSelection(
  elements: Array<{ id: string; x: number; y: number; w: number; h: number }>,
  ids: string[],
  mode: AlignMode,
): Map<string, { x: number; y: number }> {
  const sel = elements.filter((el) => ids.includes(el.id));
  if (sel.length < 2) return new Map();
  const minX = Math.min(...sel.map((el) => el.x));
  const maxX = Math.max(...sel.map((el) => el.x + el.w));
  const minY = Math.min(...sel.map((el) => el.y));
  const maxY = Math.max(...sel.map((el) => el.y + el.h));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const out = new Map<string, { x: number; y: number }>();
  for (const el of sel) {
    let nx = el.x;
    let ny = el.y;
    if (mode === 'left') nx = minX;
    else if (mode === 'centerX') nx = cx - el.w / 2;
    else if (mode === 'right') nx = maxX - el.w;
    if (mode === 'top') ny = minY;
    else if (mode === 'middleY') ny = cy - el.h / 2;
    else if (mode === 'bottom') ny = maxY - el.h;
    out.set(el.id, { x: nx, y: ny });
  }
  return out;
}

/** World-space viewport rect for a canvas of w×h pixels under a view transform. */
export function worldViewportRect(view: ViewState, w: number, h: number): Rect {
  const tl = screenToWorld(view, 0, 0);
  const br = screenToWorld(view, w, h);
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}

export function clampPopover(
  raw: { x: number; y: number },
  containerW: number,
  containerH: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const MARGIN = 8;
  const maxX = Math.max(MARGIN, containerW - w - MARGIN);
  const maxY = Math.max(MARGIN, containerH - h - MARGIN);
  const x = Math.min(Math.max(raw.x, MARGIN), maxX);
  const fitsBelow = raw.y + h <= containerH - MARGIN;
  const y = fitsBelow
    ? Math.min(Math.max(raw.y, MARGIN), maxY)
    : Math.max(MARGIN, raw.y - h - 10);
  return { x, y };
}

export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      if (lines.length === maxLines) break;
      current = word;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines;
}

export { TEXT_LINE_H };

/** Rotate (px,py) around (cx,cy) by deg degrees clockwise (SVG y-down). */
export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export const ROTATE_SNAP = 15;
export const ROTATE_SNAP_SHIFT = 45;

/** Snap a rotation angle: 15° steps, 45° with Shift. Clamped to ±360 like the schema. */
export function snapRotation(deg: number, shift: boolean): number {
  const step = shift ? ROTATE_SNAP_SHIFT : ROTATE_SNAP;
  return Math.max(-360, Math.min(360, Math.round(deg / step) * step));
}

/**
 * Rotation pivot matching the render transform: text rotates around (x,y),
 * every other kind around its bounds center.
 */
export function rotationCenter(el: { kind: string; x?: number; y?: number }, bounds: Rect): { x: number; y: number } {
  if (el.kind === 'text' && typeof el.x === 'number' && typeof el.y === 'number') {
    return { x: el.x, y: el.y };
  }
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

/** FigJam-style rotate zone: offset outward from a scale corner (screen px). */
export const ROTATE_ZONE_OFFSET = 22;
export const ROTATE_ZONE_R = 12;

/**
 * Center of the rotate zone beside a corner: pushed outward along the
 * corner→pivot axis. All inputs/outputs are in the same (screen) space.
 */
export function rotateZoneCenter(corner: { x: number; y: number }, pivot: { x: number; y: number }): { x: number; y: number } {
  const dx = corner.x - pivot.x;
  const dy = corner.y - pivot.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: corner.x + (dx / len) * ROTATE_ZONE_OFFSET, y: corner.y + (dy / len) * ROTATE_ZONE_OFFSET };
}

/** True when a screen point sits in the rotate zone beside a corner. */
export function inRotateZone(pt: { x: number; y: number }, corner: { x: number; y: number }, pivot: { x: number; y: number }): boolean {
  const z = rotateZoneCenter(corner, pivot);
  return Math.hypot(pt.x - z.x, pt.y - z.y) <= ROTATE_ZONE_R;
}