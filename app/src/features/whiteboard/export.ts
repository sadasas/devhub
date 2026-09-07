import type { Whiteboard, WhiteboardEdge, WhiteboardElement } from '../../lib/types';
import {
  elementBounds,
  refCardLayout,
  refCardRect,
  shapePath,
  textLineHeight,
  truncateToWidth,
  unionBounds,
  wrapTextLines,
  wrapToWidth,
  CHIP_CHAR_W,
  REF_LAYOUT,
  type Rect,
  type RefCardData,
} from './geometry';
import { effectiveArrowStyle, orthogonalPath, pathMidpoint, portPoint, portToward, type Point } from './edges';

const EXPORT_MARGIN = 32;

/** WB-4: baked canvas background (standalone SVG files can't resolve CSS vars). */
export type ExportTheme = 'light' | 'dark';
export type ExportBackground = 'theme' | 'transparent';
export interface ExportOptions {
  background?: ExportBackground;
  theme?: ExportTheme;
}

export interface DownloadOptions extends ExportOptions {
  onError?: () => void;
}

const EXPORT_BG: Record<ExportTheme, string> = { light: '#f4f3f0', dark: '#0f0f11' };
const EXPORT_DOT: Record<ExportTheme, string> = { light: 'rgba(0,0,0,0.11)', dark: 'rgba(255,255,255,0.11)' };

function resolveExportTheme(explicit?: ExportTheme): ExportTheme {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  return 'dark';
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textNode(x: number, y: number, fontSize: number, fill: string, content: string, anchor = 'start', weight?: number): string {
  const weightAttr = weight ? ` font-weight="${weight}"` : '';
  return `<text x="${round(x)}" y="${round(y)}" font-size="${fontSize}" fill="${esc(fill)}" text-anchor="${anchor}"${weightAttr}>${esc(content)}</text>`;
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Bounds + lookup shared by elementSvg so node-attached edges resolve like the canvas. */
interface ExportCtx {
  byId: ReadonlyMap<string, WhiteboardElement>;
  refData?: ReadonlyMap<string, RefCardData | null>;
}

function ctxBounds(el: WhiteboardElement, ctx: ExportCtx): Rect {
  if (el.kind === 'ref') return refCardRect(el, ctx.refData?.get(el.id) ?? null, false);
  return elementBounds(el);
}

/** Mirror of WhiteboardCanvas `derivedEdges`: recompute attached endpoints from node bounds. */
function resolveEdgeEndpoints(el: WhiteboardEdge, ctx: ExportCtx): { x1: number; y1: number; x2: number; y2: number } {
  if (el.sourceNodeId && el.targetNodeId) {
    const src = ctx.byId.get(el.sourceNodeId);
    const dst = ctx.byId.get(el.targetNodeId);
    if (src && dst) {
      const sb = ctxBounds(src, ctx);
      const tb = ctxBounds(dst, ctx);
      const sc = { x: sb.x + sb.w / 2, y: sb.y + sb.h / 2 };
      const tc = { x: tb.x + tb.w / 2, y: tb.y + tb.h / 2 };
      const p1 = el.sourcePort ? portPoint(sb, el.sourcePort) : portToward(sb, tc);
      const p2 = el.targetPort ? portPoint(tb, el.targetPort) : portToward(tb, sc);
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
  }
  return { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 };
}

function elementSvg(el: WhiteboardElement, refData: RefCardData | null, ctx: ExportCtx): string {
  switch (el.kind) {
    case 'stroke': {
      const points = el.points.map(([px, py]) => `${round(px)},${round(py)}`).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${esc(el.color)}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case 'sticky': {
      const fontSize = el.fontSize ?? 12;
      const align = el.align ?? 'left';
      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const lineHeight = textLineHeight(fontSize);
      const pad = 8;
      const maxLines = Math.max(1, Math.floor((el.h - pad * 2) / lineHeight));
      const innerW = Math.max(24, el.w - pad * 2);
      const lines = wrapTextLines(el.text, fontSize, innerW)
        .slice(0, maxLines)
        .map((line) => truncateToWidth(line, fontSize, innerW));
      const textFill = el.textColor ?? 'rgba(6,5,4,0.85)';
      const textX = align === 'center' ? el.x + el.w / 2 : align === 'right' ? el.x + el.w - pad : el.x + pad;
      const body = lines
        .map((line, i) => textNode(textX, el.y + pad + 8 + i * lineHeight, fontSize, textFill, line, anchor))
        .join('');
      const rot = el.rotation ? ` transform="rotate(${round(el.rotation)}, ${round(el.x + el.w / 2)}, ${round(el.y + el.h / 2)})"` : '';
      return `<g${rot}><rect x="${round(el.x)}" y="${round(el.y)}" width="${round(el.w)}" height="${round(el.h)}" rx="4" fill="${esc(el.color)}" fill-opacity="0.85"/>${body}</g>`;
    }
    case 'text': {
      const fontSize = el.fontSize;
      const align = el.align ?? 'left';
      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const rot = el.rotation ? ` transform="rotate(${round(el.rotation)}, ${round(el.x)}, ${round(el.y)})"` : '';
      if (el.w) {
        const lines = wrapTextLines(el.text, fontSize, el.w);
        const baseX = align === 'center' ? el.x + el.w / 2 : align === 'right' ? el.x + el.w : el.x;
        const spans = lines
          .map(
            (line, i) =>
              `<tspan x="${round(baseX)}" dy="${i === 0 ? 0 : textLineHeight(fontSize)}">${esc(line)}</tspan>`,
          )
          .join('');
        return `<g${rot}><text x="${round(baseX)}" y="${round(el.y)}" font-size="${fontSize}" fill="${esc(el.color)}" text-anchor="${anchor}">${spans}</text></g>`;
      }
      return `<g${rot}>${textNode(el.x, el.y, fontSize, el.color, el.text, anchor)}</g>`;
    }
    case 'shape': {
      const pad = 8;
      const fontSize = el.fontSize ?? 12;
      const align = el.align ?? 'center';
      const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
      const textX = align === 'left' ? el.x + pad : align === 'right' ? el.x + el.w - pad : el.x + el.w / 2;
      const innerW = Math.max(24, el.w - pad * 2);
      const labelLines = el.label ? wrapToWidth(el.label, fontSize, innerW, 4) : [];
      const fill = el.fill ? ` fill="${esc(el.color)}" fill-opacity="0.15"` : ' fill="none"';
      const isLightFill = el.fill && ["#e4e4e7","#6ea8fe","#f2b8c6","#34c38e","#a78bfa","#e8b955"].includes(el.color);
  const labelFill = el.labelColor ?? (isLightFill ? "#0f172a" : el.color);
      const label =
        labelLines.length > 0
          ? `<text x="${round(textX)}" y="${round(el.y + el.h / 2)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${fontSize}" fill="${esc(labelFill)}">${labelLines
              .map((line, i) => `<tspan x="${round(textX)}" dy="${i === 0 ? 0 : fontSize + 2}">${esc(line)}</tspan>`)
              .join('')}</text>`
          : '';
      const rot = el.rotation ? ` transform="rotate(${round(el.rotation)}, ${round(el.x + el.w / 2)}, ${round(el.y + el.h / 2)})"` : '';
      return `<g${rot}><path d="${shapePath(el)}"${fill} stroke="${esc(el.color)}" stroke-width="${el.strokeWidth}"/>${label}</g>`;
    }
    case 'edge': {
      // WB-1: recompute node-attached endpoints exactly like the live canvas
      // (WhiteboardCanvas derivedEdges) — raw x1/y1/x2/y2 go stale after a drag.
      const ep = resolveEdgeEndpoints(el, ctx);
      const path = el.sourcePort && el.targetPort ? orthogonalPath(ep, el.sourcePort, el.targetPort) : null;
      const points: Point[] = path ?? [
        { x: ep.x1, y: ep.y1 },
        { x: ep.x2, y: ep.y2 },
      ];
      const last = points[points.length - 1]!;
      const prev = points[points.length - 2] ?? last;
      const deg = Math.atan2(last.y - prev.y, last.x - prev.x) * (180 / Math.PI);
      const hasSpan = last.x !== prev.x || last.y !== prev.y;
      const linePoints = points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
      const arrowStyle = effectiveArrowStyle(el);
      const arrow =
        arrowStyle !== 'none' && hasSpan
          ? `<g transform="translate(${round(last.x)},${round(last.y)}) rotate(${round(deg)})">${
              arrowStyle === 'open'
                ? `<polygon points="-8,-4 0,0 -8,4" fill="none" stroke="${esc(el.color)}" stroke-width="${el.width}"/>`
                : arrowStyle === 'solid'
                  ? `<polygon points="-8,-4 0,0 -8,4" fill="${esc(el.color)}" stroke="${esc(el.color)}" stroke-width="${el.width}"/>`
                  : arrowStyle === 'diamond'
                    ? `<polygon points="-8,0 0,-5 8,0 0,5" fill="${esc(el.color)}" stroke="none"/>`
                    : `<circle r="4" fill="${esc(el.color)}" stroke="none"/>`
            }</g>`
          : '';
      const mid = pathMidpoint(points);
      const dash = (el.dash ?? 'solid') === 'dashed' ? ' stroke-dasharray="8 5"' : (el.dash ?? 'solid') === 'dotted' ? ' stroke-dasharray="2 4"' : '';
      const fontSize = el.fontSize ?? 11;
      const align = el.align ?? 'center';
      const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
      const label = el.label ? textNode(mid.x, mid.y, fontSize, el.color, el.label, anchor) : '';
      return `<g><polyline points="${linePoints}" fill="none" stroke="${esc(el.color)}" stroke-width="${el.width}"${dash}/>${arrow}${label}</g>`;
    }
    case 'boundary': {
      const fontSize = el.fontSize ?? 12;
      const labelColor = (el as { labelColor?: string | null }).labelColor ?? '#e4e4e7';
      const chipW = Math.min(el.label.length * 7.5 + 12, Math.max(20, el.w - 12));
 const chip = el.label
        ? `<g transform="translate(${round(el.x + 6)}, ${round(el.y + 6)})"><rect x="-4" y="-16" width="${round(chipW)}" height="18" rx="5" fill="${esc(el.color)}" fill-opacity="0.25"/><text x="0" y="0" font-size="${fontSize}" fill="${esc(labelColor)}">${esc(truncateToWidth(el.label, fontSize, chipW - 12))}</text></g>`
        : '';
      return `<g><rect x="${round(el.x)}" y="${round(el.y)}" width="${round(el.w)}" height="${round(el.h)}" rx="8" fill="${esc(el.color)}" fill-opacity="0.05" stroke="${esc(el.color)}" stroke-width="1.5" stroke-dasharray="6 4"/>${chip}</g>`;
    }
    case 'ref': {
      const rect = refCardRect(el, refData, false);
      const { x, y, w, h } = rect;
      const pad = REF_LAYOUT.pad;
      const card = `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="6" fill="rgba(110,168,254,0.10)" stroke="#6ea8fe" stroke-width="1.5"/>`;
      if (refData) {
        const layout = refCardLayout(refData);
        const blockSvg = (lines: string[], fontSize: number, fill: string, blkY: number, step: number, weight?: number) =>
          lines
            .map((line, i) => textNode(x + pad, y + blkY + i * step, fontSize, fill, line, 'start', weight))
            .join('');
        const title = blockSvg(layout.title.lines, 12, '#6ea8fe', layout.title.y, layout.title.step, 600);
        const meta = blockSvg(layout.meta.lines, 10, '#8a8a93', layout.meta.y, layout.meta.step);
        const sub = layout.sub ? blockSvg(layout.sub.lines, 10, '#8a8a93', layout.sub.y, layout.sub.step) : '';
        const chips = layout.labelRows
          .map((row) => {
            let lx = x + pad;
            return row.labels
              .map((label) => {
                const cw = label.length * CHIP_CHAR_W + 12;
                const chip = `<rect x="${round(lx)}" y="${round(y + row.y - 9)}" width="${round(cw)}" height="13" rx="3" fill="rgba(110,168,254,0.18)"/><text x="${round(lx + 6)}" y="${round(y + row.y)}" font-size="9" fill="#8a8a93">${esc(label)}</text>`;
                lx += cw + 4;
                return chip;
              })
              .join('');
          })
          .join('');
        const counts = layout.counts ? blockSvg(layout.counts.lines, 10, '#8a8a93', layout.counts.y, layout.counts.step) : '';
        const desc = layout.desc ? blockSvg(layout.desc.lines, 10, '#6b7280', layout.desc.y, layout.desc.step) : '';
        return `<g>${card}${title}${meta}${sub}${chips}${counts}${desc}</g>`;
      }
      const title = truncateToWidth(`untitled ${el.entity}`, 12, w - pad * 2 - REF_LAYOUT.toggle.rightOff);
      return `<g>${card}${textNode(x + pad, y + pad + 13, 12, '#8a8a93', title, 'start', 600)}${textNode(x + pad, y + pad + REF_LAYOUT.titleH + 10, 10, '#6b7280', 'Deleted')}</g>`;
    }
    default:
      return '';
  }
}

/** Serializes board elements to a standalone SVG document (viewBox = element bounds + margin). */
export function serializeWhiteboard(
  elements: readonly WhiteboardElement[],
  refData?: ReadonlyMap<string, RefCardData | null>,
  opts?: ExportOptions,
): string {
  const ctx: ExportCtx = { byId: new Map(elements.map((el) => [el.id, el])), refData };
  const bounds: Rect = unionBounds(elements.map((el) => ctxBounds(el, ctx)));
  const x = bounds.x - EXPORT_MARGIN;
  const y = bounds.y - EXPORT_MARGIN;
  const w = bounds.w + EXPORT_MARGIN * 2;
  const h = bounds.h + EXPORT_MARGIN * 2;
  // WB-4: bake the canvas background (theme-aware) unless transparency is asked.
  let chrome = '';
  if ((opts?.background ?? 'theme') === 'theme') {
    const theme = resolveExportTheme(opts?.theme);
    chrome =
      `<defs><pattern id="wb-export-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1.1" fill="${EXPORT_DOT[theme]}"/></pattern></defs>` +
      `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="${EXPORT_BG[theme]}"/>` +
      `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="url(#wb-export-dots)"/>`;
  }
  const body = [...elements]
    .sort((a, b) => Number(b.kind === 'boundary') - Number(a.kind === 'boundary'))
    .map((el) => elementSvg(el, el.kind === 'ref' ? (refData?.get(el.id) ?? null) : null, ctx))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(x)} ${round(y)} ${round(w)} ${round(h)}" width="${round(w)}" height="${round(h)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif">${chrome}${body}</svg>`;
}

export function safeFileName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'whiteboard';
}

export function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Downloads the board as an SVG file (client-side serialization, no server round-trip). */
export function downloadWhiteboardSvg(
  board: Whiteboard,
  refData?: ReadonlyMap<string, RefCardData | null>,
  opts?: ExportOptions,
): void {
  const svg = serializeWhiteboard(board.elements, refData, opts);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  triggerDownload(url, `${safeFileName(board.name)}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Opens the browser print dialog with the board rendered as a printable PDF. */
export function downloadWhiteboardPdf(
  board: Whiteboard,
  refData?: ReadonlyMap<string, RefCardData | null>,
  opts?: DownloadOptions,
): void {
  const svg = serializeWhiteboard(board.elements, refData, opts);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(board.name)}</title><style>
    body { margin: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    h1 { font-size: 16px; margin: 0 0 16px; color: #222; }
    svg { max-width: 100%; height: auto; }
    @media print { body { margin: 0; } h1 { display: none; } }
  </style></head><body><h1>${esc(board.name)}</h1>${svg}</body></html>`;
  const win = window.open('', '_blank');
  if (!win) {
    opts?.onError?.();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

/** Downloads the board as a PNG rendered at 2× via an offscreen canvas. */
export function downloadWhiteboardPng(
  board: Whiteboard,
  refData?: ReadonlyMap<string, RefCardData | null>,
  opts?: DownloadOptions,
): void {
  const svg = serializeWhiteboard(board.elements, refData, opts);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    try {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        opts?.onError?.();
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      triggerDownload(canvas.toDataURL('image/png'), `${safeFileName(board.name)}.png`);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    opts?.onError?.();
  };
  img.src = url;
}
