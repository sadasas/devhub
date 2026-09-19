/* DevHub ERD exporter (client-side, pure serialize, zero-dep).
   Table[] + Relation[] -> standalone SVG string, faithful to ERD.tsx:
   same grid layout (TABLE_W 208, HEADER_H 30, ROW_H 20, GAP 48, COLS 4),
   same truncate limits (title 24, col name 20, col type 16) and PK dot.
   Snapshot-safe: tables/relations are passed as arguments, never read
   from global state — callers pass displayTables/displayRelations (?v=).
   Dark-only palette mirrors the app CSS vars as literal hex/rgba so the
   file renders standalone (incl. a solid canvas background). */

import type { ErdGroup, Relation, Table } from '../../lib/types';
import { safeFileName, triggerDownload } from '../whiteboard/export';
import { headerTitleColor, normalizeHeaderColor } from './erd-header-color';
import { resolveGroupBox } from './erd-groups';

export const ERD_TABLE_W = 208;
export const ERD_HEADER_H = 30;
export const ERD_ROW_H = 20;
const ERD_GAP = 48;
const ERD_COLS = 4;
const ERD_EXPORT_MARGIN = 32;

/* Dark-only equivalents of the app CSS vars (see styles/tokens.css). */
const ERD_BG = '#131316';
const ERD_TABLE_FILL = '#18181b';
const ERD_TABLE_STROKE = 'rgba(255, 255, 255, 0.07)';
const ERD_HEADER_FILL = 'rgba(93, 182, 155, 0.12)';
const ERD_ACCENT = '#5db69b';
const ERD_TEXT = '#e8e8ea';
const ERD_TEXT_MUTED = '#8e8e98';
const ERD_REL_STROKE = 'rgba(255, 255, 255, 0.11)';
const ERD_GROUP_STROKE = 'rgba(255, 255, 255, 0.25)';
const ERD_FONT = "ui-monospace, 'Cascadia Code', Consolas, Menlo, monospace";

interface ErdBox {
  table: Table;
  x: number;
  y: number;
  h: number;
}

/** Grid layout copied 1:1 from ERD.tsx `layoutTables`. */
function layoutTables(tables: readonly Table[]): ErdBox[] {
  const rows: Table[][] = [];
  tables.forEach((t, i) => {
    const r = Math.floor(i / ERD_COLS);
    if (rows[r]) rows[r]!.push(t);
    else rows[r] = [t];
  });
  const rowHeights = rows.map((r) =>
    Math.max(...r.map((t) => ERD_HEADER_H + t.columns.length * ERD_ROW_H + 14)),
  );
  const out: ErdBox[] = [];
  let y = 16;
  rows.forEach((r, ri) => {
    r.forEach((t, ci) => {
      out.push({ table: t, x: 16 + ci * (ERD_TABLE_W + ERD_GAP), y, h: rowHeights[ri]! });
    });
    y += rowHeights[ri]! + ERD_GAP;
  });
  return out;
}

/** Truncation copied 1:1 from ERD.tsx. */
function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

function columnY(index: number): number {
  return ERD_HEADER_H + index * ERD_ROW_H + ERD_ROW_H / 2;
}

/** Serializes tables + relations (+ optional area groups) to a standalone SVG document (no DOM needed). */
export function serializeERD(
  tables: readonly Table[] | null | undefined,
  relations: readonly Relation[] | null | undefined,
  groups: readonly ErdGroup[] | null | undefined = [],
): string {
  const safeTables = tables ?? [];
  const safeRelations = relations ?? [];
  const layout = layoutTables(safeTables);
  const byId = new Map(layout.map((l) => [l.table.id, l]));

  const groupBoxes = (groups ?? [])
    .map((group) => resolveGroupBox(group, layout, ERD_TABLE_W))
    .filter((b): b is NonNullable<typeof b> => b !== null);
  const groupSvg = groupBoxes
    .map(({ group, x, y, w, h }) => {
      let stroke = ERD_GROUP_STROKE;
      try {
        const c = normalizeHeaderColor(group.color ?? null);
        if (c) stroke = c;
      } catch {
        /* fallback default */
      }
      const label = group.name.trim() !== '' ? group.name : 'Area';
      const custom = stroke !== ERD_GROUP_STROKE;
      const labelFill = custom ? headerTitleColor(stroke) : ERD_TEXT_MUTED;
      const halo = custom
        ? ` paint-order="stroke" stroke="${stroke}" stroke-width="14" stroke-linejoin="round" stroke-opacity="0.25"`
        : '';
      return (
        `<g><title>${esc(label)}</title>` +
        `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="10" fill="${stroke}" fill-opacity="0.08" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="8 6"/>` +
        `<text x="${round(x + 12)}" y="${round(y + 22)}" font-size="11" font-weight="600" fill="${labelFill}"${halo}>${esc(truncate(label, 28))}</text></g>`
      );
    })
    .join('');

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  if (layout.length > 0) {
    minX = Math.min(...layout.map((l) => l.x));
    minY = Math.min(...layout.map((l) => l.y));
    maxX = Math.max(...layout.map((l) => l.x + ERD_TABLE_W));
    maxY = Math.max(...layout.map((l) => l.y + l.h));
  }
  // Rect area eksplisit bisa melampaui tabel — ikutkan ke viewBox.
  for (const b of groupBoxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  const vx = minX - ERD_EXPORT_MARGIN;
  const vy = minY - ERD_EXPORT_MARGIN;
  const vw = maxX - minX + ERD_EXPORT_MARGIN * 2;
  const vh = maxY - minY + ERD_EXPORT_MARGIN * 2;

  const relSvg = safeRelations
    .map((rel) => {
      if (!rel) return '';
      const ft = byId.get(rel.fromTableId);
      const tt = byId.get(rel.toTableId);
      const fi = ft?.table.columns.findIndex((c) => c.id === rel.fromColumnId) ?? -1;
      const ti = tt?.table.columns.findIndex((c) => c.id === rel.toColumnId) ?? -1;
      if (!ft || !tt || fi < 0 || ti < 0) return '';
      const fc = ft.table.columns[fi]!;
      const tc = tt.table.columns[ti]!;
      const fx = ft.x + ERD_TABLE_W;
      const fy = ft.y + columnY(fi);
      const tx = tt.x;
      const ty = tt.y + columnY(ti);
      const mx = (fx + tx) / 2;
      const pts = `${round(fx)},${round(fy)} ${round(mx)},${round(fy)} ${round(mx)},${round(ty)} ${round(tx)},${round(ty)}`;
      const label = `${ft.table.name}.${fc.name} → ${tt.table.name}.${tc.name} (${rel.cardinality}, on delete ${rel.onDelete})`;
      return (
        `<g><title>${esc(label)}</title>` +
        `<polyline points="${pts}" fill="none" stroke="${ERD_REL_STROKE}" stroke-width="1.5"/>` +
        `<text x="${round(mx)}" y="${round((fy + ty) / 2 - 6)}" text-anchor="middle" font-size="10" fill="${ERD_ACCENT}">${esc(rel.cardinality)}</text></g>`
      );
    })
    .join('');

  const tableSvg = layout
    .map((l) => {
      const table = l.table;
      // U11: warna header + judul kontras per tabel (tanpa class animasi — murni fill inline).
      // never-throw: normalize gagal -> fallback default.
      let customFill: string | null = null;
      let titleFill = ERD_ACCENT;
      let headFill = ERD_HEADER_FILL;
      try {
        customFill = normalizeHeaderColor((table as Table).color ?? null);
        if (customFill) {
          headFill = customFill;
          titleFill = headerTitleColor(customFill);
        }
      } catch {
        customFill = null;
      }
      const cols = table.columns
        .map((c, idx) => {
          const y = ERD_HEADER_H + idx * ERD_ROW_H;
          const dot = c.primaryKey
            ? `<circle cx="10" cy="${ERD_ROW_H / 2}" r="2.5" fill="${ERD_ACCENT}"/>`
            : '';
          return (
            `<g transform="translate(0,${y})">${dot}` +
            `<text x="22" y="14" font-size="11" fill="${ERD_TEXT}">${esc(truncate(c.name, 20))}</text>` +
            `<text x="${ERD_TABLE_W - 10}" y="14" text-anchor="end" font-size="10" fill="${ERD_TEXT_MUTED}">${esc(truncate(c.type || '—', 16))}</text></g>`
          );
        })
        .join('');
      return (
        `<g transform="translate(${round(l.x)},${round(l.y)})"><title>${esc(table.name)}</title>` +
        `<rect width="${ERD_TABLE_W}" height="${round(l.h)}" rx="8" fill="${ERD_TABLE_FILL}" stroke="${ERD_TABLE_STROKE}" stroke-width="1"/>` +
        `<rect width="${ERD_TABLE_W}" height="${ERD_HEADER_H}" rx="8" fill="${headFill}"/>` +
        `<rect y="${ERD_HEADER_H - 8}" width="${ERD_TABLE_W}" height="8" fill="${headFill}"/>` +
        `<text x="12" y="20" font-size="11.5" font-weight="600" fill="${titleFill}">${esc(truncate(table.name, 24))}</text>` +
        `${cols}</g>`
      );
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(vx)} ${round(vy)} ${round(vw)} ${round(vh)}" ` +
    `width="${round(vw)}" height="${round(vh)}" font-family="${ERD_FONT}" role="img">` +
    `<rect x="${round(vx)}" y="${round(vy)}" width="${round(vw)}" height="${round(vh)}" fill="${ERD_BG}"/>` +
    `${groupSvg}${relSvg}${tableSvg}</svg>`
  );
}

/** Downloads the ERD as an SVG file (client-side serialization, no server round-trip). */
export function downloadERDSVG(
  tables: readonly Table[],
  relations: readonly Relation[],
  filenameBase: string,
  groups: readonly ErdGroup[] = [],
): void {
  const svg = serializeERD(tables, relations, groups);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  triggerDownload(url, `${safeFileName(filenameBase)}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads the ERD as a PNG rendered at 2× via an offscreen canvas. */
export function downloadERDPNG(
  tables: readonly Table[],
  relations: readonly Relation[],
  filenameBase: string,
  groups: readonly ErdGroup[] = [],
): void {
  const svg = serializeERD(tables, relations, groups);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    try {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      triggerDownload(canvas.toDataURL('image/png'), `${safeFileName(filenameBase)}.png`);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}
