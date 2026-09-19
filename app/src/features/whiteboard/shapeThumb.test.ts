import { describe, expect, it } from 'vitest';
import { LIBRARY_ITEM_BY_ID } from './libraries';
import { shapePath } from './geometry';
import { SHAPE_THUMB_BOX } from './ShapeThumb';
import type { WhiteboardShapeType } from '../../lib/types';

interface Pt {
  x: number;
  y: number;
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const ARG_COUNTS: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function quadAt(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/** Endpoint-to-center arc sampling (W3C SVG impl notes). */
function arcPoints(p0: Pt, rx0: number, ry0: number, phiDeg: number, large: number, sweep: number, p1: Pt): Pt[] {
  const phi = (phiDeg * Math.PI) / 180;
  const dx = (p0.x - p1.x) / 2;
  const dy = (p0.y - p1.y) / 2;
  let rx = Math.abs(rx0);
  let ry = Math.abs(ry0);
  const x1p = Math.cos(phi) * dx + Math.sin(phi) * dy;
  const y1p = -Math.sin(phi) * dx + Math.cos(phi) * dy;
  const lam = (x1p * x1p) / (rx * rx || 1) + (y1p * y1p) / (ry * ry || 1);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rx *= s;
    ry *= s;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let f = den === 0 ? 0 : num / den;
  f = Math.max(0, f);
  const sign = large === sweep ? -1 : 1;
  const coef = sign * Math.sqrt(f);
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = Math.cos(phi) * cxp - Math.sin(phi) * cyp + (p0.x + p1.x) / 2;
  const cy = Math.sin(phi) * cxp + Math.cos(phi) * cyp + (p0.y + p1.y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = len === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const v1x = (x1p - cxp) / rx;
  const v1y = (y1p - cyp) / ry;
  const v2x = (-x1p - cxp) / rx;
  const v2y = (-y1p - cyp) / ry;
  let t1 = ang(1, 0, v1x, v1y);
  let dt = ang(v1x, v1y, v2x, v2y);
  if (sweep === 0 && dt > 0) dt -= 2 * Math.PI;
  if (sweep === 1 && dt < 0) dt += 2 * Math.PI;
  const pts: Pt[] = [];
  const n = 24;
  for (let i = 0; i <= n; i += 1) {
    const th = t1 + (dt * i) / n;
    pts.push({
      x: cx + rx * Math.cos(phi) * Math.cos(th) - ry * Math.sin(phi) * Math.sin(th),
      y: cy + rx * Math.sin(phi) * Math.cos(th) + ry * Math.cos(phi) * Math.sin(th),
    });
  }
  return pts;
}

/** Tight-enough bbox walker for shapePath output (abs+rel, sampled curves). */
export function pathBBox(d: string): BBox {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) ?? [];
  const box: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const eat = (pts: Pt[]) => {
    for (const p of pts) {
      if (p.x < box.minX) box.minX = p.x;
      if (p.y < box.minY) box.minY = p.y;
      if (p.x > box.maxX) box.maxX = p.x;
      if (p.y > box.maxY) box.maxY = p.y;
    }
  };
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let pc: Pt | null = null; // last cubic control (S reflection)
  let pq: Pt | null = null; // last quad control (T reflection)
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    const tk = tokens[i]!;
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tk)) {
      cmd = tk;
      i += 1;
      if (cmd === 'Z' || cmd === 'z') {
        x = sx;
        y = sy;
        pc = null;
        pq = null;
      }
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const op = cmd.toUpperCase();
    const need = ARG_COUNTS[op] ?? 0;
    const args: number[] = [];
    for (let k = 0; k < need && i < tokens.length; k += 1, i += 1) args.push(Number(tokens[i]));
    const X = (v: number) => (rel ? x + v : v);
    const Y = (v: number) => (rel ? y + v : v);
    if (op === 'M') {
      x = X(args[0]!);
      y = Y(args[1]!);
      sx = x;
      sy = y;
      eat([{ x, y }]);
      cmd = rel ? 'l' : 'L'; // further pairs are implicit lineto
      pc = null;
      pq = null;
    } else if (op === 'L') {
      x = X(args[0]!);
      y = Y(args[1]!);
      eat([{ x, y }]);
      pc = null;
      pq = null;
    } else if (op === 'H') {
      x = X(args[0]!);
      eat([{ x, y }]);
      pc = null;
      pq = null;
    } else if (op === 'V') {
      y = Y(args[0]!);
      eat([{ x, y }]);
      pc = null;
      pq = null;
    } else if (op === 'C') {
      const p0 = { x, y };
      const p1 = { x: X(args[0]!), y: Y(args[1]!) };
      const p2 = { x: X(args[2]!), y: Y(args[3]!) };
      const p3 = { x: X(args[4]!), y: Y(args[5]!) };
      for (let s = 0; s <= 12; s += 1) eat([cubicAt(p0, p1, p2, p3, s / 12)]);
      pc = p2;
      pq = null;
      x = p3.x;
      y = p3.y;
    } else if (op === 'S') {
      const p0 = { x, y };
      const p1 = pc ?? p0;
      const p2 = { x: X(args[0]!), y: Y(args[1]!) };
      const p3 = { x: X(args[2]!), y: Y(args[3]!) };
      for (let s = 0; s <= 12; s += 1) eat([cubicAt(p0, p1, p2, p3, s / 12)]);
      pc = p2;
      pq = null;
      x = p3.x;
      y = p3.y;
    } else if (op === 'Q') {
      const p0 = { x, y };
      const p1 = { x: X(args[0]!), y: Y(args[1]!) };
      const p2 = { x: X(args[2]!), y: Y(args[3]!) };
      for (let s = 0; s <= 12; s += 1) eat([quadAt(p0, p1, p2, s / 12)]);
      pq = p1;
      pc = null;
      x = p2.x;
      y = p2.y;
    } else if (op === 'T') {
      const p0 = { x, y };
      const p1: Pt = pq ?? p0;
      const p2 = { x: X(args[0]!), y: Y(args[1]!) };
      for (let s = 0; s <= 12; s += 1) eat([quadAt(p0, p1, p2, s / 12)]);
      pq = p1;
      pc = null;
      x = p2.x;
      y = p2.y;
    } else if (op === 'A') {
      const p1 = { x: X(args[5]!), y: Y(args[6]!) };
      eat(arcPoints({ x, y }, args[0]!, args[1]!, args[2]!, args[3]!, args[4]!, p1));
      x = p1.x;
      y = p1.y;
      pc = null;
      pq = null;
    }
  }
  return box;
}

describe('shape thumbnails', () => {
  it('keeps all 100 library thumbs inside the padded viewport', () => {
    expect(LIBRARY_ITEM_BY_ID.size).toBe(100);
    const pad = 4; // strokeWidth 2 + sampling slack; svg overflow is visible
    const bad: string[] = [];
    for (const item of LIBRARY_ITEM_BY_ID.values()) {
      const d = shapePath({
        id: `t-${item.id}`,
        kind: 'shape',
        shapeType: item.shapeType as WhiteboardShapeType,
        x: SHAPE_THUMB_BOX.x,
        y: SHAPE_THUMB_BOX.y,
        w: SHAPE_THUMB_BOX.w,
        h: SHAPE_THUMB_BOX.h,
        color: '#6ea8fe',
        fill: false,
        strokeWidth: 2,
        label: '',
      });
      const b = pathBBox(d);
      if (b.minX < -pad || b.minY < -pad || b.maxX > 40 + pad || b.maxY > 40 + pad) {
        bad.push(`${item.id} [${b.minX.toFixed(1)},${b.minY.toFixed(1)} ${b.maxX.toFixed(1)},${b.maxY.toFixed(1)}]`);
      }
    }
    expect(bad, `overflowing thumbs:\n${bad.join('\n')}`).toEqual([]);
  });
});
