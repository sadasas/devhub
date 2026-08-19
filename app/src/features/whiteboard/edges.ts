import type { Rect } from './geometry';
import { elementBounds } from './geometry';
import type { WhiteboardEdge, WhiteboardElement } from '../../lib/types';

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

export function edgeMidpoint(ep: EdgeEndpoints): Point {
  return { x: (ep.x1 + ep.x2) / 2, y: (ep.y1 + ep.y2) / 2 };
}

export function effectiveArrowStyle(
  edge: Pick<WhiteboardEdge, 'arrowhead' | 'arrowStyle'>,
): WhiteboardEdge['arrowStyle'] {
  if (edge.arrowStyle !== 'none') return edge.arrowStyle;
  return edge.arrowhead ? 'solid' : 'none';
}

export const ORTHO_LEAD = 24;

function leadPoint(p: Point, side: PortSide, amount: number): Point {
  switch (side) {
    case 'right':
      return { x: p.x + amount, y: p.y };
    case 'left':
      return { x: p.x - amount, y: p.y };
    case 'top':
      return { x: p.x, y: p.y - amount };
    case 'bottom':
      return { x: p.x, y: p.y + amount };
  }
}

function collapseColinear(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (out.length >= 2) {
      const last = out[out.length - 1]!;
      const prev = out[out.length - 2]!;
      const sameRun = (last.x === p.x && last.x === prev.x) || (last.y === p.y && last.y === prev.y);
      if (sameRun) {
        out[out.length - 1] = p;
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/**
 * Render-time Manhattan routing between two ports. Not stored in the schema
 * (ADR-026): endpoints + ports fully determine the path, so undo/redo, public
 * share and port edits stay consistent. 3 segments for opposite/perpendicular
 * ports, 5 segments (U-bend) for same-direction ports.
 */
export function orthogonalPath(ep: EdgeEndpoints, sourcePort: PortSide, targetPort: PortSide): Point[] {
  const start: Point = { x: ep.x1, y: ep.y1 };
  const end: Point = { x: ep.x2, y: ep.y2 };
  const a = leadPoint(start, sourcePort, ORTHO_LEAD);
  const b = leadPoint(end, targetPort, ORTHO_LEAD);
  const sourceHorizontal = sourcePort === 'left' || sourcePort === 'right';
  const targetHorizontal = targetPort === 'left' || targetPort === 'right';

  let mid: Point[];
  if (sourceHorizontal && targetHorizontal) {
    const sameDir =
      (sourcePort === 'right' && targetPort === 'right') || (sourcePort === 'left' && targetPort === 'left');
    if (sameDir) {
      const midY = a.y === b.y ? a.y + ORTHO_LEAD : (a.y + b.y) / 2;
      mid = [
        start,
        a,
        { x: a.x, y: midY },
        { x: b.x, y: midY },
        b,
        end,
      ];
    } else {
      mid = [start, a, { x: b.x, y: a.y }, b, end];
    }
  } else if (!sourceHorizontal && !targetHorizontal) {
    const sameDir =
      (sourcePort === 'top' && targetPort === 'top') || (sourcePort === 'bottom' && targetPort === 'bottom');
    if (sameDir) {
      const midX = a.x === b.x ? a.x + ORTHO_LEAD : (a.x + b.x) / 2;
      mid = [
        start,
        a,
        { x: midX, y: a.y },
        { x: midX, y: b.y },
        b,
        end,
      ];
    } else {
      mid = [start, a, { x: a.x, y: b.y }, b, end];
    }
  } else {
    mid = [start, a, { x: b.x, y: a.y }, b, end];
  }
  return collapseColinear(mid);
}

export function pathMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  let total = 0;
  const segs: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    segs.push(d);
    total += d;
  }
  let walk = total / 2;
  for (let i = 1; i < points.length; i += 1) {
    const d = segs[i - 1]!;
    if (walk <= d && d > 0) {
      const t = walk / d;
      return {
        x: points[i - 1]!.x + (points[i]!.x - points[i - 1]!.x) * t,
        y: points[i - 1]!.y + (points[i]!.y - points[i - 1]!.y) * t,
      };
    }
    walk -= d;
  }
  return points[points.length - 1]!;
}

export function edgeHitsPoint(el: WhiteboardEdge, pt: Point, tolerance: number): boolean {
  const raw: Point[] = [
    { x: el.x1, y: el.y1 },
    { x: el.x2, y: el.y2 },
  ];
  const path =
    el.sourcePort && el.targetPort
      ? orthogonalPath({ x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 }, el.sourcePort, el.targetPort)
      : raw;
  const minX = Math.min(...path.map((p) => p.x)) - tolerance;
  const maxX = Math.max(...path.map((p) => p.x)) + tolerance;
  const minY = Math.min(...path.map((p) => p.y)) - tolerance;
  const maxY = Math.max(...path.map((p) => p.y)) + tolerance;
  if (pt.x < minX || pt.x > maxX || pt.y < minY || pt.y > maxY) return false;
  for (let i = 1; i < path.length; i += 1) {
    if (distToSegment(pt, path[i - 1]!, path[i]!) <= tolerance) return true;
  }
  return false;
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
  excludeKinds?: ReadonlySet<string>,
): WhiteboardElement | null {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i]!;
    if (excludeKinds?.has(el.kind)) continue;
    if (el.kind === 'edge') {
      if (edgeHitsPoint(el, pt, tolerance)) return el;
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