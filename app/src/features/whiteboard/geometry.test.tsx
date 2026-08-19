import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Whiteboard, WhiteboardShape, WhiteboardShapeType } from '../../lib/types';
import {
  alignmentGuides,
  alignSelection,
  clampPopover,
  distributeSelection,
  elementBounds,
  panBy,
  refCardLayout,
  refCardRect,
  screenToWorld,
  shapePath,
  snapToGrid,
  TEXT_LINE_H,
  textLineHeight,
  wrapText,
  wrapTextLines,
  wrapToWidth,
  worldToScreen,
  worldViewportRect,
  zoomAtPoint,
  type RefCardData,
} from './geometry';
import { WhiteboardCanvas } from './WhiteboardCanvas';


describe('snapToGrid', () => {
  it('snaps within radius and keeps values outside', () => {
    expect(snapToGrid(34)).toBe(32);
    expect(snapToGrid(39)).toBe(32);
    expect(snapToGrid(41)).toBe(41);
    expect(snapToGrid(30)).toBe(32);
    expect(snapToGrid(23)).toBe(23);
    expect(snapToGrid(63)).toBe(64);
  });
});

describe('alignmentGuides', () => {
  it('finds guides within 4px and returns the snap delta', () => {
    const moving = { x: 100, y: 100, w: 40, h: 20 };
    const other = { x: 200, y: 102, w: 40, h: 20 };
    const { guides, dy } = alignmentGuides(moving, [other]);
    expect(guides.length).toBeGreaterThan(0);
    expect(dy).toBe(2);
    expect(guides.some((g) => g.axis === 'y' && g.coord === 102)).toBe(true);
  });

  it('returns no guides beyond the radius', () => {
    const moving = { x: 100, y: 100, w: 40, h: 20 };
    const other = { x: 200, y: 130, w: 40, h: 20 };
    const { guides, dx, dy } = alignmentGuides(moving, [other]);
    expect(guides).toHaveLength(0);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });
});

describe('alignSelection', () => {
  const els = [
    { id: 'a', x: 10, y: 20, w: 20, h: 10 },
    { id: 'b', x: 60, y: 60, w: 30, h: 20 },
  ];
  it('aligns left to the selection min-x', () => {
    const out = alignSelection(els, ['a', 'b'], 'left');
    expect(out.get('b')).toEqual({ x: 10, y: 60 });
  });
  it('aligns right to the selection max-x edge', () => {
    const out = alignSelection(els, ['a', 'b'], 'right');
    expect(out.get('a')).toEqual({ x: 70, y: 20 });
  });
  it('centers horizontally on the bounding box center', () => {
    const out = alignSelection(els, ['a', 'b'], 'centerX');
    expect(out.get('a')!.x).toBeCloseTo(40);
    expect(out.get('b')!.x).toBeCloseTo(35);
  });
  it('aligns top / middle / bottom on y', () => {
    const top = alignSelection(els, ['a', 'b'], 'top');
    expect(top.get('b')).toEqual({ x: 60, y: 20 });
    const bottom = alignSelection(els, ['a', 'b'], 'bottom');
    expect(bottom.get('a')).toEqual({ x: 10, y: 70 });
    const middle = alignSelection(els, ['a', 'b'], 'middleY');
    expect(middle.get('a')!.y).toBeCloseTo(45);
    expect(middle.get('b')!.y).toBeCloseTo(40);
  });
  it('requires at least 2 selected', () => {
    expect(alignSelection(els, ['a'], 'left').size).toBe(0);
  });
});

describe('distributeSelection', () => {
  const els = [
    { id: 'a', x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', x: 30, y: 0, w: 10, h: 10 },
    { id: 'c', x: 90, y: 0, w: 10, h: 10 },
  ];
  it('spreads selected elements evenly on x', () => {
    const out = distributeSelection(els, ['a', 'b', 'c'], 'x');
    expect(out.get('b')).toBe(45);
  });
  it('spreads on y', () => {
    const ys = els.map((e) => ({ ...e, y: e.x, x: 0 }));
    const out = distributeSelection(ys, ['a', 'b', 'c'], 'y');
    expect(out.get('b')).toBe(45);
  });
  it('requires at least 3 selected', () => {
    expect(distributeSelection(els, ['a', 'b'], 'x').size).toBe(0);
  });
});

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
  useProjectOptional: useProjectMock,
}));

beforeEach(() => {
  useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
});

const VIEW = { x: 100, y: 50, s: 2 };

describe('geometry', () => {
  it('round-trips screen and world coordinates', () => {
    const world = screenToWorld(VIEW, 260, 130);
    expect(world).toEqual({ x: 80, y: 40 });
    expect(worldToScreen(VIEW, world.x, world.y)).toEqual({ x: 260, y: 130 });
  });

  it('maps a container rect into world coordinates for culling', () => {
    expect(worldViewportRect({ x: 16, y: 16, s: 1 }, 800, 600)).toEqual({ x: -16, y: -16, w: 800, h: 600 });
    expect(worldViewportRect(VIEW, 800, 600)).toEqual({ x: -50, y: -25, w: 400, h: 300 });
  });

  it('keeps the world point under the cursor fixed when zooming about a point', () => {
    const before = screenToWorld(VIEW, 260, 130);
    const zoomed = zoomAtPoint(VIEW, 260, 130, 1.25);
    const after = screenToWorld(zoomed, 260, 130);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomed.s).toBeCloseTo(2.5, 6);
  });

  it('clamps zoom between 0.3 and 3', () => {
    expect(zoomAtPoint({ x: 0, y: 0, s: 3 }, 0, 0, 2).s).toBe(3);
    expect(zoomAtPoint({ x: 0, y: 0, s: 0.01 }, 0, 0, 0.5).s).toBe(0.3);
    expect(zoomAtPoint({ x: 0, y: 0, s: 1 }, 0, 0, 1).s).toBe(1);
  });

  it('pans by screen pixels and keeps the scale', () => {
    expect(panBy(VIEW, -40, 20)).toEqual({ x: 60, y: 70, s: 2 });
  });

  it('computes bounds for every element kind', () => {
    const stroke = elementBounds({
      id: 'a',
      kind: 'stroke',
      tool: 'pen',
      color: '#e4e4e7',
      width: 4,
      thinning: 2,
      points: [
        [0, 0],
        [100, 50],
      ],
    });
    expect(stroke).toEqual({ x: -4, y: -4, w: 108, h: 58 });

    const sticky = elementBounds({
      id: 'b',
      kind: 'sticky',
      x: 10,
      y: 20,
      w: 200,
      h: 120,
      color: '#e8b955',
      text: '',
    });
    expect(sticky).toEqual({ x: 10, y: 20, w: 200, h: 120 });

    const text = elementBounds({
      id: 'c',
      kind: 'text',
      x: 30,
      y: 40,
      color: '#e4e4e7',
      fontSize: 16,
      text: 'Hello',
    });
    expect(text.x).toBe(30);
    expect(text.y).toBe(24);
    expect(text.h).toBe(20);

    const shape = elementBounds({
      id: 'd',
      kind: 'shape',
      shapeType: 'diamond',
      x: 5,
      y: 6,
      w: 80,
      h: 60,
      color: '#6ea8fe',
      fill: false,
      strokeWidth: 2,
      label: '',
    });
    expect(shape).toEqual({ x: 5, y: 6, w: 80, h: 60 });

    const edge = elementBounds({
      id: 'e',
      kind: 'edge',
          label: '',
          arrowStyle: 'solid',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: -50,
      color: '#e4e4e7',
      width: 2,
      arrowhead: true,
    });
    expect(edge).toEqual({ x: 0, y: -50, w: 100, h: 50 });

    const ref = elementBounds({
      id: 'f',
      kind: 'ref',
      entity: 'tasks',
      entityId: '11111111-1111-4111-8111-111111111111',
      x: 50,
      y: 60,
    });
    expect(ref).toEqual({ x: 50, y: 60, w: 180, h: 44 });
  });

  it('returns zeros for an empty stroke', () => {
    const bounds = elementBounds({
      id: 'a',
      kind: 'stroke',
      tool: 'eraser',
      color: '#e4e4e7',
      width: 2,
      thinning: 2,
      points: [],
    });
    expect(bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('wraps long text and caps the number of lines', () => {
    expect(wrapText('one two three four', 10, 2)).toEqual(['one two', 'three four']);
    expect(wrapText('a '.repeat(50).trim(), 10, 2)).toHaveLength(2);
    expect(wrapText('short', 10, 3)).toEqual(['short']);
  });

  it('wraps text elements per line, preserving explicit newlines', () => {
    const lines = wrapTextLines('first line\nsecond line', 16, 200);
    expect(lines).toEqual(['first line', 'second line']);
    const wrapped = wrapTextLines('one two three four five six seven eight', 16, 90);
    expect(wrapped.length).toBeGreaterThan(1);
    expect(wrapped.join(' ')).toBe('one two three four five six seven eight');
    expect(wrapTextLines('', 16, 100)).toEqual([]);
  });

  it('sizes wrapped text elements by their wrap width and line count', () => {
    const el = {
      id: 't1',
      kind: 'text' as const,
      x: 30,
      y: 40,
      color: '#e4e4e7',
      fontSize: 16,
      text: 'alpha beta gamma delta epsilon zeta eta theta',
      w: 80,
    };
    const bounds = elementBounds(el);
    expect(bounds.x).toBe(30);
    expect(bounds.y).toBe(24);
    expect(bounds.w).toBe(80);
    expect(bounds.h).toBeGreaterThan(20);
    expect(bounds.h).toBe(wrapTextLines(el.text, 16, 80).length * textLineHeight(16) + 2);
  });

  it('keeps single-line bounds for text without a wrap width', () => {
    const bounds = elementBounds({
      id: 't2',
      kind: 'text',
      x: 30,
      y: 40,
      color: '#e4e4e7',
      fontSize: 16,
      text: 'Hi',
    });
    expect(bounds.w).toBeGreaterThan(0);
    expect(bounds.h).toBe(20);
  });

  it('exposes the text line height used by sticky labels', () => {
    expect(TEXT_LINE_H).toBe(20);
  });

  it('sizes ref cards collapsed or without data at the fallback bounds', () => {
    const el = { x: 10, y: 20 };
    expect(refCardRect(el, null, false)).toEqual({ x: 10, y: 20, w: 180, h: 44 });
    const data: RefCardData = { title: 'T', meta: 'Todo · Medium', labels: [], counts: [], description: '' };
    expect(refCardRect(el, data, true)).toEqual({ x: 10, y: 20, w: 180, h: 44 });
  });

  it('sizes expanded ref cards by content and description lines', () => {
    const base: RefCardData = { title: 'Build login', meta: 'Todo · Medium', labels: [], counts: [], description: '' };
    const short = refCardRect({ x: 0, y: 0 }, base, false);
    expect(short.w).toBe(260);
    const withDesc = refCardRect({ x: 0, y: 0 }, { ...base, description: 'A short description.' }, false);
    expect(withDesc.h).toBeGreaterThan(short.h);
    const long = refCardRect({ x: 0, y: 0 }, { ...base, description: 'word '.repeat(60) }, false);
    expect(long.h).toBeGreaterThan(withDesc.h);
    const full = refCardRect(
      { x: 0, y: 0 },
      { ...base, sub: 'M1', labels: ['api', 'ux'], hours: '2/5h', counts: ['1 blocked'] },
      false,
    );
    expect(full.h).toBeGreaterThan(short.h);
  });

  it('wraps long titles and subs instead of truncating on the expanded card', () => {
    const data: RefCardData = {
      title: 'A task title that is long enough to wrap onto a second line of the card',
      meta: 'Todo · Medium',
      sub: 'Milestone: a very long milestone name that definitely wraps onto another row',
      labels: [],
      counts: [],
      description: '',
    };
    const layout = refCardLayout(data);
    expect(layout.title.lines.length).toBeGreaterThan(1);
    expect(layout.sub).not.toBeNull();
    expect(layout.sub!.lines.length).toBeGreaterThan(1);
    expect(layout.height).toBe(refCardRect({ x: 0, y: 0 }, data, false).h);
  });

  it('wraps label chips onto multiple rows when they do not fit', () => {
    const data: RefCardData = {
      title: 'T',
      meta: 'M',
      labels: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'],
      counts: [],
      description: '',
    };
    const layout = refCardLayout(data);
    expect(layout.labelRows.length).toBeGreaterThan(1);
    const all = layout.labelRows.flatMap((row) => row.labels);
    expect(all).toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']);
  });

  it('lays out every description line without a cap', () => {
    const data: RefCardData = {
      title: 'T',
      meta: 'M',
      labels: [],
      counts: [],
      description: 'word '.repeat(120),
    };
    const layout = refCardLayout(data);
    expect(layout.desc!.lines.length).toBeGreaterThan(5);
    expect(layout.desc!.lines[layout.desc!.lines.length - 1]).toContain('word');
    expect(layout.height).toBe(refCardRect({ x: 0, y: 0 }, data, false).h);
  });

  it('keeps every wrapped line within the available width under the fallback estimator', () => {
    const maxWidth = 244;
    const dense = 'm'.repeat(60);
    for (const line of wrapToWidth(dense, 10, maxWidth)) {
      expect(line.length * 0.62 * 10).toBeLessThanOrEqual(maxWidth + 1);
    }
  });
});

describe('WhiteboardCanvas', () => {
  it('renders an svg with all elements and the count in the aria label', () => {
    const board: Whiteboard = {
      id: 'wb1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      authorId: null,
      name: 'Plan',
      description: '',
      elements: [
        {
          id: 'e1',
          kind: 'sticky',
          x: 10,
          y: 10,
          w: 200,
          h: 120,
          color: '#e8b955',
          text: 'Notes',
        },
        {
          id: 'e2',
          kind: 'stroke',
          tool: 'pen',
          color: '#e4e4e7',
          width: 2,
          thinning: 2,
          points: [
            [0, 0],
            [50, 50],
          ],
        },
      ],
    };

    render(
      <MemoryRouter>
        <WhiteboardCanvas
          board={board}
          tool="select"
          history={{ canUndo: false, canRedo: false, record: () => {}, undo: () => {}, redo: () => {} }}
        />
      </MemoryRouter>,
    );
    expect(document.querySelector('svg.wb-svg')).not.toBeNull();
    expect(screen.getByRole('group', { name: /Whiteboard Plan/ }).getAttribute('aria-label')).toBe(
      'Whiteboard Plan — 2 elements',
    );
  });

  it('renders wrapped text as tspans when a wrap width is set and a single line otherwise', () => {
    const board: Whiteboard = {
      id: 'wb1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      authorId: null,
      name: 'Plan',
      description: '',
      elements: [
        {
          id: 't1',
          kind: 'text',
          x: 10,
          y: 20,
          color: '#e4e4e7',
          fontSize: 16,
          text: 'alpha beta gamma delta epsilon zeta eta theta',
          w: 80,
        },
        {
          id: 't2',
          kind: 'text',
          x: 10,
          y: 60,
          color: '#e4e4e7',
          fontSize: 16,
          text: 'plain',
        },
      ],
    };
    render(
      <MemoryRouter>
        <WhiteboardCanvas
          board={board}
          tool="select"
          history={{ canUndo: false, canRedo: false, record: () => {}, undo: () => {}, redo: () => {} }}
        />
      </MemoryRouter>,
    );
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    const tspans = svg.querySelectorAll('text tspan');
    expect(tspans.length).toBeGreaterThanOrEqual(1);
    const single = Array.from(svg.querySelectorAll('text')).filter((t) => t.textContent === 'plain');
    expect(single).toHaveLength(1);
    expect(single[0]!.querySelector('tspan')).toBeNull();
  });
});

describe('clampPopover', () => {
  const containerW = 800;
  const containerH = 600;

  it('flips above the anchor when the popover would overflow the bottom edge', () => {
    const raw = { x: 100, y: 570 };
    const pos = clampPopover(raw, containerW, containerH, 220, 180);
    expect(pos.y).toBe(380);
    expect(pos.x).toBe(100);
  });

  it('keeps the popover below the anchor when it fits', () => {
    const raw = { x: 100, y: 120 };
    const pos = clampPopover(raw, containerW, containerH, 220, 180);
    expect(pos.y).toBe(120);
  });

  it('clamps to the right and left edges with an 8px margin', () => {
    const right = clampPopover({ x: 700, y: 100 }, containerW, containerH, 220, 180);
    expect(right.x).toBe(572);
    const left = clampPopover({ x: -5, y: 100 }, containerW, containerH, 220, 180);
    expect(left.x).toBe(8);
  });

  it('falls back to the margin when the container is smaller than the popover', () => {
    const pos = clampPopover({ x: 50, y: 50 }, 100, 100, 220, 180);
    expect(pos.x).toBe(8);
    expect(pos.y).toBe(8);
  });
describe('shapePath', () => {
  const shape = (shapeType: WhiteboardShapeType): WhiteboardShape => ({
    id: 's1',
    kind: 'shape',
    shapeType,
    x: 0,
    y: 0,
    w: 100,
    h: 60,
    color: '#6ea8fe',
    fill: false,
    strokeWidth: 2,
    label: '',
  });
  it('keeps the legacy shapes', () => {
    expect(shapePath(shape('rect'))).toMatch(/^M 0 0 h 100 v 60 h -100 Z/);
    expect(shapePath(shape('diamond'))).toContain('M 50 0 L 100 30');
    expect(shapePath(shape('ellipse'))).toContain('a 50 30 0 1 0 0.01 0');
  });
  it('draws a parallelogram with a skew', () => {
    const d = shapePath(shape('parallelogram'));
    expect(d).toContain('M 25 0 L 100 0');
    expect(d).toContain('L 75 60 L 0 60');
    expect(d.endsWith('Z')).toBe(true);
  });
  it('draws a hexagon with six points', () => {
    const d = shapePath(shape('hexagon'));
    expect(d).toContain('M 50 0 L 100 15');
    expect(d).toContain('L 100 45 L 50 60 L 0 45 L 0 15');
    expect(d.endsWith('Z')).toBe(true);
  });
  it('draws a rounded rect with arcs', () => {
    const d = shapePath(shape('roundedRect'));
    expect(d).toMatch(/a 15 15 0 0 1 15 15/);
    expect(d.endsWith('Z')).toBe(true);
  });
  it('draws a cylinder with elliptical caps', () => {
    const d = shapePath(shape('cylinder'));
    expect(d).toContain('a 50 12 0 0 0 100 0');
    expect(d).toContain('a 50 12 0 0 1 -100 0');
  });
});

});