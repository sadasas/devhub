import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { Whiteboard, WhiteboardElement } from '../../lib/types';
import { WhiteboardEditorShell } from './WhiteboardEditorShell';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function renderShell(board: Whiteboard, onBack: () => void = () => {}) {
  return render(
    <MemoryRouter>
      <WhiteboardEditorShell board={board} onBack={onBack} />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{`${loc.pathname}${loc.search}`}</span>;
}

function renderShellWithProbe(board: Whiteboard) {
  return render(
    <MemoryRouter>
      <WhiteboardEditorShell board={board} onBack={() => {}} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const BOARD: Whiteboard = {
  id: 'wb1',
  name: 'Plan',
  description: '',
  elements: [],
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  authorId: null,
};

beforeEach(() => {
  useProjectMock.mockReturnValue({
    state: null,
    role: 'owner',
    canEdit: true,
    dispatch: vi.fn(),
  });
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    value: vi.fn(),
    configurable: true,
  });
});

describe('whiteboard editor shell', () => {
  it('enables all tools and keeps undo/redo disabled until history exists', () => {
    renderShell(BOARD);
    const toolbar = screen.getByRole('toolbar', { name: 'Whiteboard tools' });

    for (const name of ['Select — 1', 'Pen — 2', 'Eraser — 3', 'Entity ref card — 8']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.hasAttribute('disabled')).toBe(false);
      expect(btn.parentElement).toBe(toolbar);
    }
    for (const name of ['Undo — Ctrl+Z', 'Redo — Ctrl+Y']) {
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
  });

  it('toggles the active tool with aria-pressed on click', () => {
    renderShell(BOARD);
    const select = screen.getByRole('button', { name: 'Select — 1' });
    const pen = screen.getByRole('button', { name: 'Pen — 2' });

    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(pen.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(pen);
    expect(pen.getAttribute('aria-pressed')).toBe('true');
    expect(select.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(select);
    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(pen.getAttribute('aria-pressed')).toBe('false');
  });

  it('commits a pen gesture as a single dispatched stroke', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Pen — 2' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    expect(svg).not.toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(svg, { clientX: 40, clientY: 50 });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(svg, { clientX: 60, clientY: 70 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      type: 'whiteboard/update';
      id: string;
      patch: { elements: unknown[] };
    };
    expect(action.type).toBe('whiteboard/update');
    expect(action.id).toBe('wb1');
    expect(action.patch.elements).toHaveLength(1);
    const stroke = action.patch.elements[0] as { kind: string; tool: string; points: Array<[number, number]> };
    expect(stroke.kind).toBe('stroke');
    expect(stroke.tool).toBe('pen');
    expect(stroke.points).toHaveLength(3);
  });

  it('discards a gesture with fewer than two points', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Pen — 2' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 30 });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('activates text/sticky/shape via number shortcuts 4-6', () => {
    renderShell(BOARD);
    const text = screen.getByRole('button', { name: 'Text — 4' });
    const sticky = screen.getByRole('button', { name: 'Sticky note — 5' });
    const shape = screen.getByRole('button', { name: 'Shape — 6' });

    fireEvent.keyDown(window, { key: '4' });
    expect(text.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: '5' });
    expect(sticky.getAttribute('aria-pressed')).toBe('true');
    expect(text.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(window, { key: '6' });
    expect(shape.getAttribute('aria-pressed')).toBe('true');
  });

  it('places a sticky on click and commits color and text via the popover', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const boardWithSticky: Whiteboard = {
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'Hi' }],
    };
    let current: Whiteboard = { ...boardWithSticky };
    dispatch.mockImplementation((action: { type: string; id: string; patch?: { elements: WhiteboardElement[] } }) => {
      if (action.type === 'whiteboard/update' && action.patch) {
        current = { ...current, elements: action.patch.elements };
      }
    });
    const view = renderShell(current);
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} onBack={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Sticky note — 5' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const placed = dispatch.mock.calls[0]![0] as {
      type: 'whiteboard/update';
      id: string;
      patch: { elements: Array<Record<string, unknown>> };
    };
    expect(placed.type).toBe('whiteboard/update');
    expect(placed.id).toBe('wb1');
    expect(placed.patch.elements).toHaveLength(2);
    expect(placed.patch.elements[1]).toMatchObject({ kind: 'sticky', text: '' });
    rerender();

    const dialog = screen.getByRole('dialog', { name: 'Edit sticky' });
    expect(dialog).not.toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: '#f4706d' }));
    expect(dispatch).toHaveBeenCalledTimes(2);
    const colored = (dispatch.mock.calls[1]![0] as { patch: { elements: Array<Record<string, unknown>> } }).patch.elements;
    expect(colored.some((el) => el.color === '#f4706d')).toBe(true);
    rerender();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Meeting notes' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(dispatch).toHaveBeenCalledTimes(3);
    const edited = (dispatch.mock.calls[2]![0] as { patch: { elements: Array<Record<string, unknown>> } }).patch.elements;
    expect(edited.some((el) => el.text === 'Meeting notes')).toBe(true);
  });

  it('removes an empty sticky when cancelled with Escape', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const boardWithSticky: Whiteboard = {
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'Hi' }],
    };
    let current: Whiteboard = { ...boardWithSticky };
    dispatch.mockImplementation((action: { type: string; id: string; patch?: { elements: WhiteboardElement[] } }) => {
      if (action.type === 'whiteboard/update' && action.patch) {
        current = { ...current, elements: action.patch.elements };
      }
    });
    const view = renderShell(current);
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} onBack={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Sticky note — 5' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });
    rerender();

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Edit sticky' }), { key: 'Escape' });

    expect(dispatch).toHaveBeenCalledTimes(2);
    const remaining = (dispatch.mock.calls[1]![0] as { patch: { elements: Array<Record<string, unknown>> } }).patch.elements;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: 's1', text: 'Hi' });
  });

  it('keeps the edit popover usable when placing an element at the bottom-right corner', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const view = renderShell(BOARD);
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={BOARD} onBack={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Sticky note — 5' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 700, clientY: 500 });
    fireEvent.pointerUp(svg, { clientX: 700, clientY: 500 });
    rerender();

    expect(screen.getByRole('dialog', { name: 'Edit sticky' })).not.toBeNull();

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Edit sticky' }), { key: 'Escape' });
    rerender();
    expect(screen.queryByRole('dialog', { name: 'Edit sticky' })).toBeNull();
  });

  it('selects a node on click and moves it with a single dispatched update', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 300, y: 0, w: 200, h: 120, color: '#e8b955', text: 'B' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    expect(document.querySelector('[data-testid="wb-selection"]')).not.toBeNull();

    fireEvent.pointerMove(svg, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(svg, { clientX: 50, clientY: 50 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      type: 'whiteboard/update';
      id: string;
      patch: { elements: Array<Record<string, unknown>> };
    };
    expect(action.type).toBe('whiteboard/update');
    const movedA = action.patch.elements.find((el) => el.id === 'a');
    expect(movedA).toMatchObject({ x: 30, y: 30 });
    const keptB = action.patch.elements.find((el) => el.id === 'b');
    expect(keptB).toMatchObject({ x: 300, y: 0 });
  });

  it('removes a selected node together with its incident edges', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 300, y: 0, w: 200, h: 120, color: '#e8b955', text: 'B' },
        {
          id: 'e1',
          kind: 'edge',
          x1: 200,
          y1: 60,
          x2: 300,
          y2: 60,
          color: '#e4e4e7',
          width: 2,
          arrowhead: true,
          sourceNodeId: 'a',
          targetNodeId: 'b',
        },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.keyDown(window, { key: 'Delete' });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      patch: { elements: Array<Record<string, unknown>> };
    };
    const ids = action.patch.elements.map((el) => el.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('e1');
    expect(ids).toContain('b');
  });

  it('draws an edge from one node to another with snap and arrowhead', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 300, y: 0, w: 200, h: 120, color: '#e8b955', text: 'B' },
      ],
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Edge — 7' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 320, clientY: 80 });
    fireEvent.pointerUp(svg, { clientX: 320, clientY: 80 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      patch: { elements: Array<Record<string, unknown>> };
    };
    const edge = action.patch.elements.find((el) => el.kind === 'edge');
    expect(edge).toBeDefined();
    expect(edge).toMatchObject({
      kind: 'edge',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      arrowhead: true,
      x1: 200,
      y1: 60,
      x2: 300,
      y2: 60,
      sourcePort: 'right',
      targetPort: 'left',
    });
  });

  it('locks edge ports to the side the mouse aims at when connecting diagonally', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 300, y: 300, w: 100, h: 60, color: '#e8b955', text: 'B' },
      ],
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Edge — 7' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 356, clientY: 361 });
    fireEvent.pointerUp(svg, { clientX: 356, clientY: 361 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      patch: { elements: Array<Record<string, unknown>> };
    };
    const edge = action.patch.elements.find((el) => el.kind === 'edge');
    expect(edge).toBeDefined();
    expect(edge).toMatchObject({
      kind: 'edge',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourcePort: 'bottom',
      targetPort: 'bottom',
    });
  });

  it('keeps edge ports on the locked side when a connected shape moves', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 200, y: 0, w: 100, h: 60, color: '#e8b955', text: 'B' },
        {
          id: 'e1',
          kind: 'edge',
          x1: 100,
          y1: 30,
          x2: 200,
          y2: 30,
          color: '#e4e4e7',
          width: 2,
          arrowhead: true,
          sourceNodeId: 'a',
          targetNodeId: 'b',
          sourcePort: 'right',
          targetPort: 'left',
        },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 266, clientY: 46 });
    fireEvent.pointerMove(svg, { clientX: 116, clientY: 246 });

    const lines = svg.querySelectorAll('line');
    const edgeLine = Array.from(lines).find((l) => l.getAttribute('x1') === '100' && l.getAttribute('y1') === '30');
    expect(edgeLine).toBeDefined();
    expect(edgeLine!.getAttribute('x2')).toBe('50');
    expect(edgeLine!.getAttribute('y2')).toBe('230');

    fireEvent.pointerUp(svg, { clientX: 116, clientY: 246 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('selects the edge tool with the digit 7 shortcut', () => {
    renderShell(BOARD);
    const edge = screen.getByRole('button', { name: 'Edge — 7' });
    fireEvent.keyDown(window, { key: '7' });
    expect(edge.getAttribute('aria-pressed')).toBe('true');
  });

  it('activates the ref tool with the digit 8 shortcut', () => {
    renderShell(BOARD);
    const refBtn = screen.getByRole('button', { name: 'Entity ref card — 8' });
    fireEvent.keyDown(window, { key: '8' });
    expect(refBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('places a ref card via the picker after clicking the canvas with the ref tool', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [{ id: 't1', title: 'Build login', status: 'todo' }],
        issues: [{ id: 'i1', title: 'Flaky test', status: 'open' }],
      },
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Entity ref card — 8' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });

    const dialog = screen.getByRole('dialog', { name: 'Link an entity' });
    expect(dialog).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Build login/ }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      type: 'whiteboard/update';
      id: string;
      patch: { elements: Array<Record<string, unknown>> };
    };
    expect(action.type).toBe('whiteboard/update');
    expect(action.id).toBe('wb1');
    expect(action.patch.elements).toHaveLength(1);
    expect(action.patch.elements[0]).toMatchObject({
      kind: 'ref',
      entity: 'tasks',
      entityId: 't1',
      x: 84,
      y: 104,
    });
  });

  it('cancels ref placement without dispatching when the picker is closed', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [{ id: 't1', title: 'Build login', status: 'todo' }],
        issues: [],
      },
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Entity ref card — 8' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });

    const dialog = screen.getByRole('dialog', { name: 'Link an entity' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('opens the linked entity deep link when a ref card is double-clicked', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [{ id: 't1', title: 'Build login', status: 'todo', priority: 'medium' }],
        issues: [{ id: 'i1', title: 'Flaky test', status: 'open' }],
      },
      role: 'owner',
      canEdit: true,
      projectId: 'p1',
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'r1', kind: 'ref', entity: 'tasks', entityId: 't1', x: 0, y: 0 }],
    };
    renderShellWithProbe(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    expect(screen.getByTestId('loc').textContent).toBe('/');
    fireEvent.doubleClick(svg, { clientX: 20, clientY: 20 });

    expect(screen.getByTestId('loc').textContent).toBe('/project/p1?tab=board&entity=tasks&id=t1');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not navigate when a ref card points at a deleted entity', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [{ id: 't1', title: 'Build login', status: 'todo' }],
        issues: [],
      },
      role: 'owner',
      canEdit: true,
      projectId: 'p1',
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'r1', kind: 'ref', entity: 'tasks', entityId: 'ghost', x: 0, y: 0 }],
    };
    renderShellWithProbe(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 20, clientY: 20 });

    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it('opens the edit popover when a sticky is double-clicked', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'A' }],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 20, clientY: 20 });

    expect(screen.getByRole('dialog', { name: 'Edit sticky' })).not.toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Edit sticky' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Edit sticky' })).toBeNull();
  });

  it('opens the edit popover when a shape is double-clicked', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [
        { id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', fill: true, strokeWidth: 2, label: '' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 20, clientY: 20 });

    expect(screen.getByRole('dialog', { name: 'Edit shape' })).not.toBeNull();
  });

  it('does not open a popover when an edge is double-clicked', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 300, y: 0, w: 200, h: 120, color: '#e8b955', text: 'B' },
        { id: 'e1', kind: 'edge', sourceNodeId: 'a', targetNodeId: 'b', arrowhead: true, x1: 200, y1: 60, x2: 300, y2: 60, color: '#8b5cf6', width: 2 },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 266, clientY: 76 });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the cursor of the selected tool on the canvas', () => {
    renderShell(BOARD);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    expect(svg.style.cursor).toBe('grab');

    fireEvent.click(screen.getByRole('button', { name: 'Text — 4' }));
    expect(svg.style.cursor).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Pen — 2' }));
    expect(svg.style.cursor).toBe('crosshair');

    fireEvent.click(screen.getByRole('button', { name: 'Select — 1' }));
    expect(svg.style.cursor).toBe('grab');
  });

  it('shows all task data on an expanded ref card and toggles it collapsed with the corner button', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [
          {
            id: 't1',
            title: 'Build login',
            status: 'todo',
            priority: 'medium',
            estimate: 5,
            actualHours: 2,
            labels: ['api', 'ux'],
            blockedBy: ['t2'],
            milestoneId: 'm1',
            description: 'Fix the login flow',
          },
          { id: 't2', title: 'Design auth', status: 'inProgress', priority: 'high' },
        ],
        issues: [],
        milestones: [{ id: 'm1', name: 'M1 Launch' }],
        testCases: [{ id: 'tc1', taskId: 't1' }],
      },
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'r1', kind: 'ref', entity: 'tasks', entityId: 't1', x: 0, y: 0 }],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });

    expect(screen.getByText('Build login')).not.toBeNull();
    expect(screen.getByText('Todo · Medium')).not.toBeNull();
    expect(screen.getByText('M1 Launch')).not.toBeNull();
    expect(screen.getByText('api')).not.toBeNull();
    expect(screen.getByText('ux')).not.toBeNull();
    expect(screen.getByText('2/5h · 1 blocked · 1 tests')).not.toBeNull();
    expect(screen.getByText('Fix the login flow')).not.toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 257, clientY: 22 });
    fireEvent.pointerUp(svg, { clientX: 257, clientY: 22 });

    expect(screen.queryByText('M1 Launch')).toBeNull();
    expect(screen.queryByText('api')).toBeNull();
    expect(screen.queryByText('2/5h · 1 blocked · 1 tests')).toBeNull();
    expect(screen.getByText('Build login')).not.toBeNull();
    expect(screen.getByText('Todo · Medium')).not.toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 177, clientY: 22 });
    fireEvent.pointerUp(svg, { clientX: 177, clientY: 22 });

    expect(screen.getByText('M1 Launch')).not.toBeNull();
    expect(screen.getByText('2/5h · 1 blocked · 1 tests')).not.toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('keeps expanded card text inside the card when the card is not at the origin', () => {
    useProjectMock.mockReturnValue({
      state: {
        tasks: [{ id: 't1', title: 'Build login', status: 'todo', priority: 'medium' }],
        issues: [],
        milestones: [],
        testCases: [],
      },
      role: 'owner',
      canEdit: true,
      dispatch: vi.fn(),
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'r1', kind: 'ref', entity: 'tasks', entityId: 't1', x: 40, y: 300 }],
    };
    renderShell(board);

    // Card at (40, 300): title first line must sit at y = 300 + pad(8) + 13 = 321,
    // meta at 321 + 18 - 3 = 336 — not at the layout offsets relative to 0.
    const titleText = screen.getByText('Build login');
    expect(Number(titleText.getAttribute('y'))).toBe(321);
    const metaText = screen.getByText('Todo · Medium');
    expect(Number(metaText.getAttribute('y'))).toBe(336);
  });

  it('does not truncate long text on an expanded ref card', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [
          {
            id: 't1',
            title: 'Tugas berjudul sangat panjang sekali yang harus diwrap penuh sampai ke ujung akhir',
            status: 'todo',
            priority: 'medium',
            labels: ['api', 'ux'],
            milestoneId: 'm1',
            description: Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join(' '),
          },
        ],
        issues: [],
        milestones: [{ id: 'm1', name: 'Milestone dengan nama yang sangat panjang untuk uji wrap tidak dipotong ujung' }],
        testCases: [],
      },
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'r1', kind: 'ref', entity: 'tasks', entityId: 't1', x: 0, y: 0 }],
    };
    renderShell(board);

    expect(screen.getByText((content) => content.includes('sampai ke ujung akhir'))).not.toBeNull();
    expect(screen.getByText((content) => content.includes('dipotong'))).not.toBeNull();
    expect(screen.getAllByText((content) => content.includes('ujung')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText((content) => content.includes('line30'))).not.toBeNull();
    expect(screen.getAllByText((content) => content.includes('line')).length).toBeGreaterThan(3);
  });

  it('deletes the selected element via the trash button', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 300, y: 0, w: 200, h: 120, color: '#e8b955', text: 'B' },
        {
          id: 'e1',
          kind: 'edge',
          x1: 200,
          y1: 60,
          x2: 300,
          y2: 60,
          color: '#e4e4e7',
          width: 2,
          arrowhead: true,
          sourceNodeId: 'a',
          targetNodeId: 'b',
        },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    expect(screen.queryByRole('button', { name: 'Delete selected' })).toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      patch: { elements: Array<Record<string, unknown>> };
    };
    const ids = action.patch.elements.map((el) => el.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('e1');
    expect(ids).toContain('b');
  });

  it('undoes a committed gesture with Ctrl+Z', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    let current: Whiteboard = { ...BOARD };
    dispatch.mockImplementation((action: { type: string; id: string; patch?: { elements: WhiteboardElement[] } }) => {
      if (action.type === 'whiteboard/update' && action.patch) {
        current = { ...current, elements: action.patch.elements };
      }
    });
    const view = renderShell(current);
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} onBack={() => {}} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Pen — 2' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(svg, { clientX: 40, clientY: 50 });
    fireEvent.pointerUp(svg, { clientX: 40, clientY: 50 });
    rerender();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(
      (dispatch.mock.calls[0]![0] as { patch: { elements: WhiteboardElement[] } }).patch.elements,
    ).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(dispatch).toHaveBeenCalledTimes(2);
    const undone = (dispatch.mock.calls[1]![0] as { patch: { elements: WhiteboardElement[] } }).patch.elements;
    expect(undone).toHaveLength(0);
  });

  it('pans the canvas when dragging empty space with the select tool', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'a', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' }],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // World = client - 16; (184,184) is empty space, not the sticky at (0,0,100,60).
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 210, clientY: 210 });
    fireEvent.pointerMove(svg, { clientX: 240, clientY: 240 });
    fireEvent.pointerUp(svg, { clientX: 240, clientY: 240 });

    const g = document.querySelector('svg.wb-svg > g') as SVGGraphicsElement;
    // Absolute-from-start pan: two moves totaling +40,+40 land exactly at 56,56
    // (a cumulative-delta bug would accumulate to 66,66).
    expect(g.getAttribute('transform')).toContain('translate(56 56)');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
