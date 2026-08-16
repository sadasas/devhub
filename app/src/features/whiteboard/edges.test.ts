import { describe, expect, it } from 'vitest';
import {
  EDGE_SNAP,
  EDGE_TOUCH_TOLERANCE,
  edgeEndpoints,
  edgePorts,
  elementsAtPoint,
  pointInRect,
  portToward,
  snapPointToBounds,
} from './edges';

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
    const edge = { id: 'e1', kind: 'edge', x1: 0, y1: 0, x2: 100, y2: 0, color: '#e4e4e7', width: 2, arrowhead: true } as const;
    const hit = elementsAtPoint([edge], { x: 50, y: 4 }, 8);
    expect(hit?.id).toBe('e1');
    expect(elementsAtPoint([edge], { x: 50, y: 20 }, 8)).toBeNull();
  });
});
