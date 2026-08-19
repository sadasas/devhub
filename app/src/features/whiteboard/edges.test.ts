import { describe, expect, it } from 'vitest';
import {
  EDGE_SNAP,
  EDGE_TOUCH_TOLERANCE,
  edgeEndpoints,
  edgeHitsPoint,
  edgePorts,
  effectiveArrowStyle,
  elementsAtPoint,
  orthogonalPath,
  pathMidpoint,
  pointInRect,
  portToward,
  snapPointToBounds,
} from './edges';

describe('orthogonalPath', () => {
  it('routes opposite horizontal ports with 3 segments', () => {
    const path = orthogonalPath({ x1: 100, y1: 50, x2: 400, y2: 150 }, 'right', 'left');
    expect(path[0]).toEqual({ x: 100, y: 50 });
    expect(path[path.length - 1]).toEqual({ x: 400, y: 150 });
    // Middle vertical segment: (b.x, a.y) → (b.x, b.y)
    const bend = path[1]!;
    expect(bend.y).toBe(50);
    const mid = path[2]!;
    expect(mid.x).toBe(400 - 24);
    expect(mid.y).toBe(150);
    // Manhattan: only axis-aligned runs
    for (let i = 1; i < path.length; i += 1) {
      expect(path[i]!.x === path[i - 1]!.x || path[i]!.y === path[i - 1]!.y).toBe(true);
    }
  });

  it('routes same-direction ports with a 5-segment U-bend', () => {
    const path = orthogonalPath({ x1: 100, y1: 50, x2: 400, y2: 50 }, 'right', 'right');
    expect(path[0]).toEqual({ x: 100, y: 50 });
    expect(path[path.length - 1]).toEqual({ x: 400, y: 50 });
    expect(path.length).toBeGreaterThanOrEqual(5);
    // U-bend dips below the shared row
    expect(Math.min(...path.map((p) => p.y))).toBe(50);
    expect(Math.max(...path.map((p) => p.y))).toBeGreaterThan(50);
  });

  it('routes perpendicular ports with a corner', () => {
    const path = orthogonalPath({ x1: 100, y1: 50, x2: 400, y2: 300 }, 'right', 'bottom');
    expect(path[0]).toEqual({ x: 100, y: 50 });
    expect(path[path.length - 1]).toEqual({ x: 400, y: 300 });
  });

  it('collapses colinear runs', () => {
    const path = orthogonalPath({ x1: 0, y1: 0, x2: 100, y2: 0 }, 'right', 'left');
    // Same row: straight run, no redundant bends
    for (const p of path) expect(p.y).toBe(0);
  });
});

describe('pathMidpoint', () => {
  it('returns the middle of a straight run', () => {
    expect(pathMidpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toEqual({ x: 50, y: 0 });
  });
});

describe('edgeHitsPoint', () => {
  const edge = {
    id: 'e1',
    kind: 'edge' as const,
    x1: 100,
    y1: 50,
    x2: 400,
    y2: 50,
    color: '#e4e4e7',
    width: 2,
    arrowhead: true,
    label: '',
    arrowStyle: 'solid' as const,
    sourcePort: 'right' as const,
    targetPort: 'right' as const,
  };

  it('hits the U-bend path but not the straight chord', () => {
    const path = orthogonalPath({ x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2 }, edge.sourcePort!, edge.targetPort!);
    const deep = path.find((p) => p.y > 50)!;
    expect(edgeHitsPoint(edge, { x: deep.x, y: deep.y }, 4)).toBe(true);
    expect(edgeHitsPoint(edge, { x: 250, y: 50 }, 4)).toBe(false);
    expect(elementsAtPoint([edge], { x: deep.x, y: deep.y }, 4)).toBe(edge);
  });
});

describe('effectiveArrowStyle', () => {
  it('prefers an explicit arrowStyle', () => {
    expect(effectiveArrowStyle({ arrowhead: false, arrowStyle: 'diamond' })).toBe('diamond');
    expect(effectiveArrowStyle({ arrowhead: true, arrowStyle: 'open' })).toBe('open');
  });
  it('derives solid from legacy arrowhead', () => {
    expect(effectiveArrowStyle({ arrowhead: true, arrowStyle: 'none' })).toBe('solid');
  });
  it('defaults to none', () => {
    expect(effectiveArrowStyle({ arrowhead: false, arrowStyle: 'none' })).toBe('none');
  });
});

const RECT = { x: 0, y: 0, w: 100, h: 50 };

describe('whiteboard edges', () => {
  it('returns the four side midpoints of a bounds rect', () => {
    expect(edgePorts(RECT)).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 25 },
      { x: 50, y: 50 },
      { x: 0, y: 25 },
    ]);
  });

  it('picks the port that faces the target', () => {
    expect(portToward(RECT, { x: 200, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(portToward(RECT, { x: -50, y: 25 })).toEqual({ x: 0, y: 25 });
    expect(portToward(RECT, { x: 50, y: -20 })).toEqual({ x: 50, y: 0 });
    expect(portToward(RECT, { x: 50, y: 80 })).toEqual({ x: 50, y: 50 });
  });

  it('snaps a point to a port when within the snap distance', () => {
    expect(snapPointToBounds({ x: 100, y: 23 }, RECT)).toEqual({ x: 100, y: 25 });
  });

  it('clamps a nearby point onto the bounds edge otherwise', () => {
    expect(snapPointToBounds({ x: 80, y: 80 }, RECT)).toEqual({ x: 80, y: 50 });
  });

  it('clamps distant points onto the bounds edge', () => {
    expect(snapPointToBounds({ x: 500, y: 500 }, RECT)).toEqual({ x: 100, y: 50 });
  });

  it('computes endpoints from source bounds toward the release point', () => {
    const from = { x: 0, y: 0, w: 40, h: 40 };
    const to = { x: 200, y: 0, w: 40, h: 40 };
    const ep = edgeEndpoints(from, to, { x: 220, y: 20 });
    expect(ep).toEqual({ x1: 40, y1: 20, x2: 220, y2: 20 });
  });

  it('tests point-in-rect and constants', () => {
    expect(pointInRect({ x: 50, y: 25 }, RECT)).toBe(true);
    expect(pointInRect({ x: 101, y: 25 }, RECT)).toBe(false);
    expect(EDGE_SNAP).toBe(12);
    expect(EDGE_TOUCH_TOLERANCE).toBe(8);
  });

  it('hit-tests elements top-most first (stroke vs shape)', () => {
    const shape = { id: 'a', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 50, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' } as const;
    const text = { id: 'b', kind: 'text', x: 10, y: 20, color: '#e4e4e7', fontSize: 16, text: 'hi' } as const;
    const hit = elementsAtPoint([shape, text], { x: 20, y: 20 }, 8);
    expect(hit?.id).toBe('b');
  });

  it('hit-tests edges by segment distance', () => {
    const edge = { id: 'e1', kind: 'edge', x1: 0, y1: 0, x2: 100, y2: 0, color: '#e4e4e7', width: 2, arrowhead: true, label: '', arrowStyle: 'solid' } as const;
    const hit = elementsAtPoint([edge], { x: 50, y: 4 }, 8);
    expect(hit?.id).toBe('e1');
    expect(elementsAtPoint([edge], { x: 50, y: 20 }, 8)).toBeNull();
  });
});
