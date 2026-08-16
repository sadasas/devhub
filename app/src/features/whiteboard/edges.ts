import type { Rect } from './geometry';
import { elementBounds } from './geometry';
import type { WhiteboardElement } from '../../lib/types';

export const EDGE_SNAP = 12;
export const EDGE_TOUCH_TOLERANCE = 8;

export interface Point {
  x: number;
  y: number;
}

export interface EdgeEndpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function edgePorts(bounds: Rect): Point[] {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  return [
    { x: cx, y: bounds.y },
    { x: bounds.x + bounds.w, y: cy },
    { x: cx, y: bounds.y + bounds.h },
    { x: bounds.x, y: cy },
  ];
}

export type PortSide = 'top' | 'right' | 'bottom' | 'left';

export function portPoint(bounds: Rect, side: PortSide): Point {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  switch (side) {
    case 'top':
      return { x: cx, y: bounds.y };
    case 'right':
      return { x: bounds.x + bounds.w, y: cy };
    case 'bottom':
      return { x: cx, y: bounds.y + bounds.h };
    case 'left':
      return { x: bounds.x, y: cy };
  }
}

export function portSideToward(bounds: Rect, targetCenter: Point): PortSide {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const dx = targetCenter.x - cx;
  const dy = targetCenter.y - cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

export function nearestPortSide(pt: Point, bounds: Rect, snap = EDGE_SNAP): PortSide | null {
  const ports: PortSide[] = ['top', 'right', 'bottom', 'left'];
  let best: PortSide | null = null;
  let bestDist = snap;
  for (const side of ports) {
    const p = portPoint(bounds, side);
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d <= bestDist) {
      bestDist = d;
      best = side;
    }
  }
  return best;
}

export function portToward(bounds: Rect, target: Point): Point {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const px = Math.min(Math.max(target.x, bounds.x), bounds.x + bounds.w);
  const py = Math.min(Math.max(target.y, bounds.y), bounds.y + bounds.h);
  if (Math.abs(px - cx) >= Math.abs(py - cy)) {
    return { x: px > cx ? bounds.x + bounds.w : bounds.x, y: cy };
  }
  return { x: cx, y: py > cy ? bounds.y + bounds.h : bounds.y };
}

export function snapPointToBounds(pt: Point, bounds: Rect, snap = EDGE_SNAP): Point {
  const ports = edgePorts(bounds);
  let best = ports[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const port of ports) {
    const d = Math.hypot(port.x - pt.x, port.y - pt.y);
    if (d < bestDist) {
      bestDist = d;
      best = port;
    }
  }
  if (bestDist <= snap) return best;
  return {
    x: Math.min(Math.max(pt.x, bounds.x), bounds.x + bounds.w),
    y: Math.min(Math.max(pt.y, bounds.y), bounds.y + bounds.h),
  };
}

export function edgeEndpoints(fromBounds: Rect, toBounds: Rect, releasePt: Point): EdgeEndpoints {
  const start = portToward(fromBounds, releasePt);
  const end = snapPointToBounds(releasePt, toBounds);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

export function pointInRect(pt: Point, rect: Rect): boolean {
  return pt.x >= rect.x && pt.x <= rect.x + rect.w && pt.y >= rect.y && pt.y <= rect.y + rect.h;
}

export function distToSegment(pt: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

export function elementsAtPoint(
  elements: WhiteboardElement[],
  pt: Point,
  tolerance = EDGE_TOUCH_TOLERANCE,
  refRects?: Map<string, Rect>,
): WhiteboardElement | null {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i]!;
    if (el.kind === 'edge') {
      const minX = Math.min(el.x1, el.x2) - tolerance;
      const maxX = Math.max(el.x1, el.x2) + tolerance;
      const minY = Math.min(el.y1, el.y2) - tolerance;
      const maxY = Math.max(el.y1, el.y2) + tolerance;
      if (pt.x < minX || pt.x > maxX || pt.y < minY || pt.y > maxY) continue;
      if (distToSegment(pt, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }) <= tolerance) return el;
      continue;
    }
    const bounds = el.kind === 'ref' && refRects ? refRects.get(el.id) : undefined;
    if (pointInRect(pt, bounds ?? elementBounds(el))) return el;
  }
  return null;
}

export function eraseStrokes(
  elements: WhiteboardElement[],
  eraserPoints: Point[],
  radius: number,
): { elements: WhiteboardElement[]; changed: boolean } {
  let changed = false;
  const next: WhiteboardElement[] = [];
  for (const el of elements) {
    if (el.kind !== 'stroke' || el.tool !== 'pen') {
      next.push(el);
      continue;
    }
    const kept = el.points.filter(([px, py]) => {
      for (const ep of eraserPoints) {
        if (Math.hypot(px - ep.x, py - ep.y) <= radius) return false;
      }
      return true;
    });
    if (kept.length === el.points.length) {
      next.push(el);
      continue;
    }
    changed = true;
    if (kept.length >= 2) next.push({ ...el, points: kept });
  }
  return { elements: next, changed };
}