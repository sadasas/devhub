import type { WhiteboardElement } from '../../lib/types';
import { sanitizeSvgForRender } from './svg-sanitize';

/**
 * Kontrak grouping + reverse-compile untuk SVG AI (kind `embed`).
 *
 * Kontrak grouping (sisi AI): tiap widget dibungkus
 * `<g data-component="nama">` — mis. `card`, `input-email`, `submit`.
 * Fungsi di file ini di sisi kita:
 * 1. `splitSvgComponents` — potong satu blob SVG per grup komponen.
 * 2. `reverseCompileComponent` — terjemahkan grup berprimitif sederhana
 *    menjadi elemen whiteboard natif (editable, searchable); grup yang
 *    memuat path/polyline/gradien dikembalikan utuh sebagai embed.
 */

export interface SvgComponent {
  /** Nilai `data-component`; '' untuk sisa tanpa grup. */
  name: string;
  /** Markup grup (sudah lolos sanitizer). Koordinat masih lokal. */
  svg: string;
}

function parseFragment(svg: string): SVGSVGElement | null {
  const clean = sanitizeSvgForRender(svg);
  if (!clean) return null;
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${clean}</svg>`,
    'image/svg+xml',
  );
  if (doc.querySelector('parsererror')) return null;
  const root = doc.documentElement as unknown as SVGSVGElement | null;
  if (!root || root.tagName.toLowerCase() !== 'svg') return null;
  return root;
}

/** Potong blob SVG menjadi komponen per `<g data-component>`. */
export function splitSvgComponents(svg: string): SvgComponent[] {
  const root = parseFragment(svg);
  if (!root) return [];
  const out: SvgComponent[] = [];
  const rest = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (const child of Array.from(root.children)) {
    const name = child.tagName.toLowerCase() === 'g' ? (child.getAttribute('data-component') ?? '') : '';
    if (name) {
      out.push({ name, svg: (child as SVGGElement).outerHTML });
    } else {
      rest.appendChild(child.cloneNode(true));
    }
  }
  if (rest.children.length > 0) out.push({ name: '', svg: rest.innerHTML });
  return out;
}

const num = (v: string | null, fallback = 0): number => {
  const n = v === null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Estimasi lebar teks (cermin geometry.ts approxTextWidth). */
function textWidth(text: string, fontSize: number): number {
  return Math.max(text.length * fontSize * 0.62, 40);
}

interface BBox { x: number; y: number; w: number; h: number; }

/** Bounding box pendekatan dari atribut geometri (tanpa render). */
export function approxComponentBBox(svg: string): BBox | null {
  const root = parseFragment(`<g>${svg}</g>`);
  if (!root) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const eat = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  const els = root.querySelectorAll('rect,circle,ellipse,line,text');
  els.forEach((node) => {
    const el = node as SVGElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'rect') {
      eat(num(el.getAttribute('x')), num(el.getAttribute('y')), num(el.getAttribute('width')), num(el.getAttribute('height')));
    } else if (tag === 'circle') {
      const r = num(el.getAttribute('r'));
      eat(num(el.getAttribute('cx')) - r, num(el.getAttribute('cy')) - r, r * 2, r * 2);
    } else if (tag === 'ellipse') {
      const rx = num(el.getAttribute('rx'));
      const ry = num(el.getAttribute('ry'));
      eat(num(el.getAttribute('cx')) - rx, num(el.getAttribute('cy')) - ry, rx * 2, ry * 2);
    } else if (tag === 'line') {
      const x1 = num(el.getAttribute('x1'));
      const y1 = num(el.getAttribute('y1'));
      const x2 = num(el.getAttribute('x2'));
      const y2 = num(el.getAttribute('y2'));
      eat(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1) || 1, Math.abs(y2 - y1) || 1);
    } else if (tag === 'text') {
      const fs = num(el.getAttribute('font-size'), 16);
      const content = el.textContent ?? '';
      eat(num(el.getAttribute('x')), num(el.getAttribute('y')) - fs, textWidth(content, fs), fs + 4);
    }
  });
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export type ReverseCompileResult =
  | { kind: 'native'; elements: WhiteboardElement[] }
  | { kind: 'embed'; svg: string };

/**
 * Terjemahkan satu komponen ke elemen natif bila SELURUH children-nya
 * primitif sederhana (rect/circle/ellipse/line/text). Selain itu (path,
 * polyline, polygon, gradien, clip) kembalikan utuh sebagai embed.
 * `origin` menggeser koordinat lokal ke kanvas; `newId` injeksi id.
 */
export function reverseCompileComponent(
  componentSvg: string,
  origin: { x: number; y: number },
  newId: () => string,
): ReverseCompileResult {
  const root = parseFragment(`<g>${componentSvg}</g>`);
  if (!root) return { kind: 'embed', svg: componentSvg };
  // `<g>` transparan (wadah grup); selain primitif di bawah → fallback embed.
  const PRIMITIVES = new Set(['rect', 'circle', 'ellipse', 'line', 'text']);
  const descendants = Array.from(root.querySelectorAll('*'));
  const convertible: Element[] = [];
  for (const node of descendants) {
    const tag = (node as Element).tagName.toLowerCase();
    if (tag === 'g') continue;
    if (!PRIMITIVES.has(tag)) return { kind: 'embed', svg: componentSvg };
    convertible.push(node as Element);
  }
  if (convertible.length === 0) return { kind: 'embed', svg: componentSvg };
  const elements: WhiteboardElement[] = [];
  let ok = true;
  convertible.forEach((node) => {
    if (!ok) return;
    const el = node as SVGElement;
    const tag = el.tagName.toLowerCase();
    const fill = el.getAttribute('fill') ?? '#374151';
    if (tag === 'rect') {
      const rx = num(el.getAttribute('rx'));
      elements.push({
        id: newId(),
        kind: 'shape',
        shapeType: rx > 0 ? 'roundedRect' : 'rect',
        x: origin.x + num(el.getAttribute('x')),
        y: origin.y + num(el.getAttribute('y')),
        w: Math.max(1, num(el.getAttribute('width'))),
        h: Math.max(1, num(el.getAttribute('height'))),
        color: fill === 'none' ? '#374151' : fill,
        fill: fill !== 'none',
        strokeWidth: num(el.getAttribute('stroke-width'), 2) || 2,
        label: '',
      });
    } else if (tag === 'circle' || tag === 'ellipse') {
      const rx = tag === 'circle' ? num(el.getAttribute('r')) : num(el.getAttribute('rx'));
      const ry = tag === 'circle' ? num(el.getAttribute('r')) : num(el.getAttribute('ry'));
      const cx = num(el.getAttribute('cx'));
      const cy = num(el.getAttribute('cy'));
      elements.push({
        id: newId(),
        kind: 'shape',
        shapeType: 'ellipse',
        x: origin.x + cx - rx,
        y: origin.y + cy - ry,
        w: Math.max(1, rx * 2),
        h: Math.max(1, ry * 2),
        color: fill === 'none' ? '#374151' : fill,
        fill: fill !== 'none',
        strokeWidth: 2,
        label: '',
      });
    } else if (tag === 'line') {
      elements.push({
        id: newId(),
        kind: 'edge',
        x1: origin.x + num(el.getAttribute('x1')),
        y1: origin.y + num(el.getAttribute('y1')),
        x2: origin.x + num(el.getAttribute('x2')),
        y2: origin.y + num(el.getAttribute('y2')),
        color: el.getAttribute('stroke') ?? '#374151',
        width: 2,
        arrowhead: false,
        label: '',
        arrowStyle: 'none',
        dash: 'solid',
      });
    } else if (tag === 'text') {
      const content = (el.textContent ?? '').trim();
      if (!content) return;
      elements.push({
        id: newId(),
        kind: 'text',
        x: origin.x + num(el.getAttribute('x')),
        y: origin.y + num(el.getAttribute('y')),
        color: fill,
        fontSize: Math.min(200, Math.max(4, num(el.getAttribute('font-size'), 16))),
        text: content.slice(0, 1000),
      });
    } else {
      ok = false;
    }
  });
  if (!ok || elements.length === 0) return { kind: 'embed', svg: componentSvg };
  return { kind: 'native', elements };
}
