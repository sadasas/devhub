/* DevHub ERD area bounds (client-side, pure, zero-dep).
   ErdGroup[] + node layouts -> bounding boxes for the dashed boundary render.
   Bounds derive render-time from member tables (no stored x/y): min/max over
   placed members inflated by GROUP_MARGIN. Groups with zero placed members
   are skipped (nothing to bound). Deterministic, never throws. */

import type { ErdGroup, Table } from '../../lib/types';

export interface ErdNodeBox {
  table: Table;
  x: number;
  y: number;
  h: number;
}

export interface ErdGroupBox {
  group: ErdGroup;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ERD_GROUP_MARGIN = 16;

/** Ukuran minimum rect area eksplisit (disamakan dengan validasi server). */
export const ERD_GROUP_MIN_W = 120;
export const ERD_GROUP_MIN_H = 80;

/** Ukuran default rect area baru saat create dari kanvas. */
export const ERD_GROUP_DEFAULT_W = 480;
export const ERD_GROUP_DEFAULT_H = 320;

export type GroupCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface ErdGroupRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Rect hasil resize dari sudut: sisi berlawanan dikunci, ukuran dijepit
 * ke minimum. Murni, never-throw, deterministik.
 */
export function resizeBox(
  orig: ErdGroupRect,
  corner: GroupCorner,
  dx: number,
  dy: number,
): ErdGroupRect {
  try {
    const ox = Number.isFinite(orig?.x) ? orig.x : 0;
    const oy = Number.isFinite(orig?.y) ? orig.y : 0;
    const ow = Number.isFinite(orig?.w) && orig.w > 0 ? orig.w : ERD_GROUP_MIN_W;
    const oh = Number.isFinite(orig?.h) && orig.h > 0 ? orig.h : ERD_GROUP_MIN_H;
    const ddx = Number.isFinite(dx) ? dx : 0;
    const ddy = Number.isFinite(dy) ? dy : 0;
    const x2 = ox + ow;
    const y2 = oy + oh;
    switch (corner) {
      case 'nw': {
        const nx = Math.min(ox + ddx, x2 - ERD_GROUP_MIN_W);
        const ny = Math.min(oy + ddy, y2 - ERD_GROUP_MIN_H);
        return { x: round1(nx), y: round1(ny), w: round1(x2 - nx), h: round1(y2 - ny) };
      }
      case 'ne': {
        const ny = Math.min(oy + ddy, y2 - ERD_GROUP_MIN_H);
        return { x: round1(ox), y: round1(ny), w: round1(Math.max(ow + ddx, ERD_GROUP_MIN_W)), h: round1(y2 - ny) };
      }
      case 'sw': {
        const nx = Math.min(ox + ddx, x2 - ERD_GROUP_MIN_W);
        return { x: round1(nx), y: round1(oy), w: round1(x2 - nx), h: round1(Math.max(oh + ddy, ERD_GROUP_MIN_H)) };
      }
      case 'se':
      default: {
        return { x: round1(ox), y: round1(oy), w: round1(Math.max(ow + ddx, ERD_GROUP_MIN_W)), h: round1(Math.max(oh + ddy, ERD_GROUP_MIN_H)) };
      }
    }
  } catch {
    return { x: 0, y: 0, w: ERD_GROUP_MIN_W, h: ERD_GROUP_MIN_H };
  }
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Bounds final sebuah grup: geometri eksplisit bila lengkap, else bounds
 * turunan dari tabel anggota. Null bila keduanya tak tersedia.
 * Murni, never-throw.
 */
export function resolveGroupBox(
  group: ErdGroup,
  layouts: readonly ErdNodeBox[],
  tableW: number,
): ErdGroupBox | null {
  try {
    if (!group || typeof group.id !== 'string') return null;
    if (isFiniteNum(group.x) && isFiniteNum(group.y) && isFiniteNum(group.w) && isFiniteNum(group.h)) {
      return { group, x: group.x, y: group.y, w: Math.max(group.w, 1), h: Math.max(group.h, 1) };
    }
    const [box] = layoutGroups([group], layouts ?? [], tableW);
    return box ?? null;
  } catch {
    return null;
  }
}

export interface ErdDropPoint {
  x: number;
  y: number;
}

/**
 * Grup target saat node di-drop: bounds dihitung TANPA tabel yang digeser
 * (agar bounds tidak "mengikuti" node), titik = tengah node hasil drop.
 * Beberapa grup menampung -> terkecil (paling spesifik) menang.
 * Di luar semua bounds -> null (caller melepas membership bila ada).
 * Murni, never-throw, deterministik.
 */
export function dropTargetGroup(
  groups: readonly ErdGroup[],
  layouts: readonly ErdNodeBox[],
  tableW: number,
  tableId: string,
  point: ErdDropPoint,
): ErdGroup | null {
  try {
    if (typeof tableId !== 'string' || tableId === '') return null;
    if (point == null || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const rest = Array.isArray(layouts) ? layouts.filter((l) => l && l.table && l.table.id !== tableId) : [];
    // Rect eksplisit selalu ikut (tak terpengaruh tabel yang digeser);
    // sisanya bounds turunan tanpa tabel yang digeser.
    const explicit: ErdGroupBox[] = [];
    const derivedGroups: ErdGroup[] = [];
    for (const g of groups ?? []) {
      if (!g || typeof g.id !== 'string') continue;
      if (isFiniteNum(g.x) && isFiniteNum(g.y) && isFiniteNum(g.w) && isFiniteNum(g.h)) {
        explicit.push({ group: g, x: g.x, y: g.y, w: Math.max(g.w, 1), h: Math.max(g.h, 1) });
      } else {
        derivedGroups.push(g);
      }
    }
    const boxes = [...explicit, ...layoutGroups(derivedGroups, rest, tableW)];
    const hits = boxes.filter((b) => {
      const inX = point.x >= b.x && point.x <= b.x + b.w;
      const inY = point.y >= b.y && point.y <= b.y + b.h;
      return inX && inY;
    });
    if (hits.length === 0) return null;
    hits.sort((a, b) => a.w * a.h - b.w * b.h);
    return hits[0]!.group;
  } catch {
    return null;
  }
}

export function layoutGroups(
  groups: readonly ErdGroup[],
  layouts: readonly ErdNodeBox[],
  tableW: number,
): ErdGroupBox[] {
  try {
    if (!Array.isArray(groups) || !Array.isArray(layouts)) return [];
    const byId = new Map<string, ErdNodeBox>();
    for (const l of layouts) {
      if (!l || !l.table || typeof l.table.id !== 'string') continue;
      if (!byId.has(l.table.id)) byId.set(l.table.id, l);
      else {
        // Drag preview can duplicate ids — keep the first (stable) box.
      }
    }
    const out: ErdGroupBox[] = [];
    for (const g of groups ?? []) {
      if (!g || typeof g.id !== 'string') continue;
      const ids = Array.isArray(g.tableIds) ? g.tableIds : [];
      const members: ErdNodeBox[] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        if (typeof id !== 'string' || seen.has(id)) continue;
        seen.add(id);
        const box = byId.get(id);
        if (box) members.push(box);
      }
      if (members.length === 0) continue;
      let minX = Infinity;
      let minY = Infinity;
      let maxR = -Infinity;
      let maxB = -Infinity;
      for (const m of members) {
        if (!Number.isFinite(m.x) || !Number.isFinite(m.y) || !Number.isFinite(m.h)) continue;
        if (m.x < minX) minX = m.x;
        if (m.y < minY) minY = m.y;
        const r = m.x + tableW;
        const b = m.y + m.h;
        if (r > maxR) maxR = r;
        if (b > maxB) maxB = b;
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY)) continue;
      out.push({
        group: g,
        x: minX - ERD_GROUP_MARGIN,
        y: minY - ERD_GROUP_MARGIN,
        w: maxR - minX + ERD_GROUP_MARGIN * 2,
        h: maxB - minY + ERD_GROUP_MARGIN * 2,
      });
    }
    return out;
  } catch {
    return [];
  }
}
