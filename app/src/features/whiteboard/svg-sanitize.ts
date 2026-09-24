/**
 * Sanitizer SVG render-time (lapis kedua) untuk kind `embed`.
 * Cermin server `server/src/modules/projects/domain/sanitize-svg.ts`
 * (sumber kebenaran allowlist) — diimplementasi ulang dengan DOMParser
 * karena browser memilikinya. Dipakai WhiteboardCanvas + export sebelum
 * markup AI disisipkan ke DOM/SVG hasil.
 */

const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'text',
  'tspan',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
]);

const TAG_CANONICAL = new Map([
  ['lineargradient', 'linearGradient'],
  ['radialgradient', 'radialGradient'],
  ['clippath', 'clipPath'],
]);

const ALLOWED_ATTRS = new Set([
  'id',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'points',
  'd',
  'dx',
  'dy',
  'rotate',
  'textlength',
  'lengthadjust',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'opacity',
  'font-size',
  'font-weight',
  'font-family',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'transform',
  'gradientunits',
  'gradienttransform',
  'offset',
  'stop-color',
  'stop-opacity',
  'clip-path',
  'clip-rule',
  'viewbox',
  'preserveaspectratio',
]);

const ATTR_CANONICAL = new Map([
  ['textlength', 'textLength'],
  ['lengthadjust', 'lengthAdjust'],
  ['viewbox', 'viewBox'],
  ['preserveaspectratio', 'preserveAspectRatio'],
  ['gradientunits', 'gradientUnits'],
  ['gradienttransform', 'gradientTransform'],
]);

const RENDERABLE_TAGS = new Set([
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'text',
]);

function cleanAttrValue(name: string, value: string): string | null {
  if (/javascript\s*:/i.test(value)) return null;
  if ((name === 'clip-path' || name === 'fill' || name === 'stroke') && value.includes('url(')) {
    if (!/^url\(#[^)\s]+\)$/.test(value.trim())) return null;
  }
  return value;
}

function sanitizeNode(node: Element): void {
  const children = Array.from(node.children);
  for (const child of children) {
    const lower = child.tagName.toLowerCase();
    if (lower === 'script' || lower === 'style') {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(lower)) {
      // Tag tak dikenal: ganti dengan children-nya (kecuali foreignObject/image/use/a/media).
      if (['foreignobject', 'image', 'use', 'a', 'iframe', 'embed', 'object', 'video', 'audio', 'animate', 'animatetransform', 'set'].includes(lower)) {
        child.remove();
      } else {
        child.replaceWith(...Array.from(child.childNodes));
        // Children yang baru naik belum disanitasi — proses ulang node ini.
        sanitizeNode(node);
        return;
      }
      continue;
    }
    // Normalisasi kapital (clippath -> clipPath) via ganti node.
    const canon = TAG_CANONICAL.get(lower);
    let target: Element = child;
    if (canon && child.tagName !== canon) {
      const repl = document.createElementNS('http://www.w3.org/2000/svg', canon);
      for (const attr of Array.from(child.attributes)) repl.setAttribute(attr.name, attr.value);
      repl.replaceChildren(...Array.from(child.childNodes));
      child.replaceWith(repl);
      target = repl;
    }
    for (const attr of Array.from(target.attributes)) {
      const raw = attr.name.toLowerCase();
      const base = raw.includes(':') ? (raw.split(':').pop() ?? '') : raw;
      if (base.startsWith('on') || base === 'href' || base === 'style') {
        target.removeAttribute(attr.name);
        continue;
      }
      if (base.startsWith('data-')) continue;
      const attrCanon = ATTR_CANONICAL.get(base) ?? base;
      if (!ALLOWED_ATTRS.has(base)) {
        target.removeAttribute(attr.name);
        continue;
      }
      const clean = cleanAttrValue(attrCanon, attr.value);
      if (clean === null) {
        target.removeAttribute(attr.name);
        continue;
      }
      if (attrCanon !== attr.name) {
        target.removeAttribute(attr.name);
        target.setAttribute(attrCanon, clean);
      }
    }
    sanitizeNode(target);
  }
}

/**
 * Kembalikan markup aman untuk disisipkan, atau string kosong bila tak ada
 * konten renderable tersisa (pemanggil tampilkan fallback).
 */
export function sanitizeSvgForRender(input: string): string {
  if (typeof input !== 'string' || input.trim() === '') return '';
  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') return '';
  const noComments = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^<>]*>/gi, '')
    .replace(/<\?[\s\S]*?\?>/g, '');
  // Unwrap outer svg tunggal (renderer menyediakan viewport sendiri).
  const outer = noComments.match(/^\s*<svg\b[^<>]*>([\s\S]*)<\/svg>\s*$/i);
  const body = outer?.[1] ?? noComments;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`, 'image/svg+xml');
  } catch {
    return '';
  }
  if (doc.querySelector('parsererror')) return '';
  const root = doc.documentElement;
  sanitizeNode(root);
  let renderable = false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Element | null = walker.currentNode as Element;
  while (node) {
    if (RENDERABLE_TAGS.has(node.tagName.toLowerCase())) {
      renderable = true;
      break;
    }
    node = walker.nextNode() as Element | null;
  }
  if (!renderable) return '';
  return root.innerHTML;
}
