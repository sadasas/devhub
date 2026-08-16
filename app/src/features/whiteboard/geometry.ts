import type { WhiteboardElement } from '../../lib/types';

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
  const titleLines = wrapToWidth(data.title, 12, titleW);
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
export function truncateToWidth(text: string, fontSize: number, maxWidth: number): string {
  if (approxTextWidth(text, fontSize) <= maxWidth) return text;
  let lo = 1;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (approxTextWidth(text.slice(0, mid), fontSize) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, Math.max(1, lo - 1))}…`;
}

/** Greedy word wrap by measured width; hard-breaks over-long words. No line cap when maxLines is omitted. */
export function wrapToWidth(text: string, fontSize: number, maxWidth: number, maxLines = Infinity): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const lines: string[] = [];
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * 0.62)));
  let current = '';
  const pushLine = (line: string) => {
    lines.push(line);
    return lines.length >= maxLines;
  };
  for (const word of words) {
    if (approxTextWidth(word, fontSize) <= maxWidth) {
      const candidate = current ? `${current} ${word}` : word;
      if (approxTextWidth(candidate, fontSize) > maxWidth && current) {
        if (pushLine(current)) return lines;
        current = word;
      } else {
        current = candidate;
      }
      continue;
    }
    if (current && pushLine(current)) return lines;
    current = '';
    let rest = word;
    while (rest.length > maxChars) {
      if (pushLine(rest.slice(0, maxChars))) return lines;
      rest = rest.slice(maxChars);
    }
    current = rest;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

/** Estimated glyph width per latin char at 9px chip text (0.62em). */
export const CHIP_CHAR_W = 5.6;

const MEASURE_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
let measureCtx: CanvasRenderingContext2D | null | undefined;
const measureCache = new Map<string, number>();

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
    measureCtx.font = `${weight} ${fontSize}px ${MEASURE_STACK}`;
    const w = measureCtx.measureText(text).width;
    measureCache.set(key, w);
    return w;
  }
  let w = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    w += c > 0x2e7f ? 1 : c === 0x20 ? 0.3 : 0.62; // CJK/wide 1em, space 0.3em, latin 0.62em
  }
  return Math.max(w * fontSize, 40);
}

function approxTextWidth(text: string, fontSize: number, weight = 400): number {
  return measureTextWidth(text, fontSize, weight);
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
      return { x: el.x ?? 0, y: el.y ?? 0, w: el.w ?? 0, h: el.h ?? 0 };
    case 'text': {
      const w = approxTextWidth(el.text ?? '', el.fontSize ?? 16);
      return { x: el.x ?? 0, y: (el.y ?? 0) - (el.fontSize ?? 16), w, h: (el.fontSize ?? 16) + 4 };
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