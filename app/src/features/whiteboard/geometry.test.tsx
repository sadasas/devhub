import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Whiteboard } from '../../lib/types';
import {
  elementBounds,
  panBy,
  refCardLayout,
  refCardRect,
  screenToWorld,
  TEXT_LINE_H,
  wrapText,
  wrapToWidth,
  worldToScreen,
  zoomAtPoint,
  type RefCardData,
} from './geometry';
import { WhiteboardCanvas } from './WhiteboardCanvas';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
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
});