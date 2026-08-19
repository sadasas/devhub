import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { State, Whiteboard, WhiteboardElement } from '../../lib/types';
import { WhiteboardEditorShell } from './WhiteboardEditorShell';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
  useProjectOptional: useProjectMock,
}));

function makeState(): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

function renderShell(board: Whiteboard, onBack: () => void = () => {}) {
  return render(
    <MemoryRouter>
      <WhiteboardEditorShell board={board} state={makeState()} onBack={onBack} />
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
      <WhiteboardEditorShell board={board} state={makeState()} onBack={() => {}} />
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
  authorId: null,};


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
  Object.defineProperty(Element.prototype, 'requestFullscreen', {
    value: vi.fn().mockResolvedValue(undefined),
    configurable: true,
  });
  Object.defineProperty(Document.prototype, 'exitFullscreen', {
    value: vi.fn().mockResolvedValue(undefined),
    configurable: true,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    value: null,
    writable: true,
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
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} state={makeState()} onBack={() => {}} /></MemoryRouter>);
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
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} state={makeState()} onBack={() => {}} /></MemoryRouter>);
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
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={BOARD} state={makeState()} onBack={() => {}} /></MemoryRouter>);
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
    expect(movedA).toMatchObject({ x: 32, y: 32 });
    const keptB = action.patch.elements.find((el) => el.id === 'b');
    expect(keptB).toMatchObject({ x: 300, y: 0 });
  });

  it('drags all marquee-selected elements when grabbing one of them', () => {
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
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Marquee world (0,0) → (300,60): touches both a and b.
    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 76 });
    expect(screen.getByRole('button', { name: 'Delete selected' })).not.toBeNull();

    // Switch to select and drag a → the multi-selection is kept and both move.
    fireEvent.click(screen.getByRole('button', { name: 'Select — 1' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 50, clientY: 30 });
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 80 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 80 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      patch: { elements: Array<Record<string, unknown>> };
    };
    const moved = Object.fromEntries(
      action.patch.elements.map((el) => [el.id as string, { x: el.x as number, y: el.y as number }]),
    );
    expect(moved['a']).toEqual({ x: 50, y: 50 });
    expect(moved['b']).toEqual({ x: 250, y: 50 });
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
          label: '',
          arrowStyle: 'solid',
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
      label: '',
      arrowStyle: 'solid',
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
          label: '',
          arrowStyle: 'solid',
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

    const polylines = svg.querySelectorAll('polyline');
    const edgePoly = Array.from(polylines).find((l) => l.getAttribute('points')?.startsWith('100,30'));
    expect(edgePoly).toBeDefined();
    expect(edgePoly!.getAttribute('points')).toContain('50,222');

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

  it('lists milestones and endpoints in the ref picker and places a milestone ref', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [],
        issues: [],
        milestones: [{ id: 'm1', name: 'M18 Ship', status: 'planned', version: 'v0.12.0' }],
        apiEndpoints: [{ id: 'e1', name: 'List projects', method: 'GET', path: '/api/projects' }],
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

    const endpoint = screen.getByRole('button', { name: /List projects/ });
    expect(endpoint.textContent).toContain('GET /api/projects');

    const milestone = screen.getByRole('button', { name: /M18 Ship/ });
    expect(milestone.textContent).toContain('Milestone');
    fireEvent.click(milestone);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      type: 'whiteboard/update';
      id: string;
      patch: { elements: Array<Record<string, unknown>> };
    };
    expect(action.patch.elements[0]).toMatchObject({
      kind: 'ref',
      entity: 'milestones',
      entityId: 'm1',
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

  it('opens the edge popover on double-click and edits label, color and arrow style', () => {
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
        { id: 'e1', kind: 'edge', sourceNodeId: 'a', targetNodeId: 'b', arrowhead: true, label: '', arrowStyle: 'solid', x1: 200, y1: 60, x2: 300, y2: 60, color: '#8b5cf6', width: 2 },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 266, clientY: 76 });

const dialog = screen.getByRole('dialog', { name: 'Edit edge' });
    expect(dialog).not.toBeNull();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Label' }), { target: { value: 'HTTP' } });

    const labelPatch = dispatch.mock.calls.at(-1)![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(labelPatch.patch.elements.find((e) => e.kind === 'edge')).toMatchObject({ label: 'HTTP' });

    fireEvent.click(within(dialog).getByRole('radio', { name: 'diamond' }));
    const arrowPatch = dispatch.mock.calls.at(-1)![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(arrowPatch.patch.elements.find((e) => e.kind === 'edge')).toMatchObject({ arrowStyle: 'diamond' });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Edit edge' })).toBeNull();
  });

  it('renders a wrapped shape label centered in the shape', () => {
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
        { id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 200, h: 120, color: '#6ea8fe', fill: false, strokeWidth: 2, label: 'Decide approach' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    expect(svg.querySelector('.wb-shape-label')?.textContent).toContain('Decide');
  });

  it('renders an edge label at the midpoint with a halo', () => {
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
        { id: 'e1', kind: 'edge', x1: 0, y1: 0, x2: 200, y2: 100, color: '#e4e4e7', width: 2, arrowhead: false, label: 'Yes', arrowStyle: 'none' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    const label = svg.querySelector('.wb-edge-label');
    expect(label?.textContent).toBe('Yes');
    expect(label?.getAttribute('x')).toBe('100');
    expect(label?.getAttribute('y')).toBe('50');
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

  it('shows milestone data on an expanded ref card', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [{ id: 't1', title: 'Ship refs', status: 'todo', priority: 'medium', milestoneId: 'm1' }],
        issues: [],
        milestones: [{ id: 'm1', name: 'M18 Ship', status: 'planned', version: 'v0.12.0', changelog: 'Ref cards for all entities' }],
      },
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'r1', kind: 'ref', entity: 'milestones', entityId: 'm1', x: 0, y: 0 }],
    };
    renderShell(board);

    expect(screen.getByText('M18 Ship')).not.toBeNull();
    expect(screen.getByText('v0.12.0 · Planned')).not.toBeNull();
    expect(screen.getByText('1 tasks')).not.toBeNull();
    expect(screen.getByText('Ref cards for all entities')).not.toBeNull();
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
          label: '',
          arrowStyle: 'solid',
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
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} state={makeState()} onBack={() => {}} /></MemoryRouter>);

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

  it('eraser removes pen stroke points along its path', () => {
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
        {
          id: 's1',
          kind: 'stroke',
          tool: 'pen',
          color: '#e4e4e7',
          width: 2,
          thinning: 2,
          points: [
            [0, 20],
            [10, 20],
            [20, 20],
            [30, 20],
            [40, 20],
          ],
        },
      ],
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Eraser — 3' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Eraser drag from world (20,20) to (30,20) — client coords add 16.
    fireEvent.pointerDown(svg, { button: 0, clientX: 36, clientY: 36 });
    fireEvent.pointerMove(svg, { clientX: 46, clientY: 36 });
    fireEvent.pointerUp(svg, { clientX: 46, clientY: 36 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      type: 'whiteboard/update';
      id: string;
      patch: { elements: unknown[] };
    };
    expect(action.patch.elements).toHaveLength(1);
    const stroke = action.patch.elements[0] as { kind: string; tool: string; points: Array<[number, number]> };
    expect(stroke.kind).toBe('stroke');
    expect(stroke.tool).toBe('pen');
    expect(stroke.points).toEqual([
      [0, 20],
      [10, 20],
      [40, 20],
    ]);
  });

  it('eraser removes a pen stroke entirely when fewer than two points remain', () => {
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
        {
          id: 's1',
          kind: 'stroke',
          tool: 'pen',
          color: '#e4e4e7',
          width: 2,
          thinning: 2,
          points: [
            [0, 0],
            [4, 0],
          ],
        },
      ],
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Eraser — 3' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Eraser drag over both points: world (0,0) → (4,0).
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 20, clientY: 16 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 16 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      type: 'whiteboard/update';
      id: string;
      patch: { elements: unknown[] };
    };
    expect(action.patch.elements).toHaveLength(0);
  });

  it('eraser does not dispatch when nothing is erased', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Eraser — 3' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Eraser drag over empty space: world (100,100) → (110,100).
    fireEvent.pointerDown(svg, { button: 0, clientX: 116, clientY: 116 });
    fireEvent.pointerMove(svg, { clientX: 126, clientY: 116 });
    fireEvent.pointerUp(svg, { clientX: 126, clientY: 116 });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('selects elements intersecting the marquee box', () => {
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
        { id: 'c', kind: 'sticky', x: 400, y: 0, w: 100, h: 60, color: '#e8b955', text: 'C' },
      ],
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    expect(screen.queryByRole('button', { name: 'Delete selected' })).toBeNull();

    // Marquee world (0,0) → (200,60): touches a and b, not c.
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 216, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 216, clientY: 76 });

    expect(screen.getByRole('button', { name: 'Delete selected' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: { id: string }[] } };
    expect(action.patch.elements.map((el) => el.id)).toEqual(['c']);
  });

  it('marquee selection replaces the previous selection', () => {
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
        { id: 'c', kind: 'sticky', x: 400, y: 0, w: 100, h: 60, color: '#e8b955', text: 'C' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Select a with the select tool first.
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));

    // Marquee world (250,0) → (350,60): only b.
    fireEvent.pointerDown(svg, { button: 0, clientX: 266, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 366, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 366, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: { id: string }[] } };
    expect(action.patch.elements.map((el) => el.id)).toEqual(['a', 'c']);
  });

  it('shift-marquee adds to the existing selection', () => {
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
        { id: 'c', kind: 'sticky', x: 400, y: 0, w: 100, h: 60, color: '#e8b955', text: 'C' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Select a by clicking it, then shift+marquee over b.
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));
    // jsdom does not apply modifier keys from the PointerEvent init dict, so
    // define shiftKey on the constructed event directly.
    const shiftDown = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 266,
      clientY: 16,
    });
    Object.defineProperty(shiftDown, 'shiftKey', { value: true });
    svg.dispatchEvent(shiftDown);
    fireEvent.pointerMove(svg, { clientX: 366, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 366, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: { id: string }[] } };
    expect(action.patch.elements.map((el) => el.id)).toEqual(['c']);
  });

  it('shows the marquee preview while dragging and clears it on release', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    expect(document.querySelector('[data-testid="wb-marquee"]')).toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 116, clientY: 76 });
    expect(document.querySelector('[data-testid="wb-marquee"]')).not.toBeNull();

    fireEvent.pointerUp(svg, { clientX: 116, clientY: 76 });
    expect(document.querySelector('[data-testid="wb-marquee"]')).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('activates the select area tool with the digit 9 shortcut', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    const btn = screen.getByRole('button', { name: 'Select area — 9' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(window, { key: '9' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the element limit warning banner at 800 elements', () => {
    const board = {
      ...BOARD,
      elements: Array.from({ length: 800 }, (_, i) => ({
        id: `s${i}`,
        kind: 'sticky' as const,
        x: i * 10,
        y: 0,
        w: 100,
        h: 60,
        color: '#e8b955',
        text: '',
      })),
    };
    renderShell(board);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('800/1000 elements');
    expect(alert.textContent).toContain('Approaching the element limit');
  });

  it('hides the element limit banner below 800 elements', () => {
    const board = {
      ...BOARD,
      elements: Array.from({ length: 799 }, (_, i) => ({
        id: `s${i}`,
        kind: 'sticky' as const,
        x: i * 10,
        y: 0,
        w: 100,
        h: 60,
        color: '#e8b955',
        text: '',
      })),
    };
    renderShell(board);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('blocks adding elements at 1000 elements and shows the danger banner', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board = {
      ...BOARD,
      elements: Array.from({ length: 1000 }, (_, i) => ({
        id: `s${i}`,
        kind: 'sticky' as const,
        x: i * 10,
        y: 0,
        w: 100,
        h: 60,
        color: '#e8b955',
        text: '',
      })),
    };
    renderShell(board);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('1000/1000 elements');
    expect(alert.textContent).toContain('Element limit reached');
    expect(screen.getByRole('button', { name: 'Pen — 2' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Sticky note — 5' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Shape — 6' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Select — 1' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Eraser — 3' }).hasAttribute('disabled')).toBe(false);

    // The shortcut is blocked too, and the canvas guard rejects placement.
    const stickyBtn = screen.getByRole('button', { name: 'Sticky note — 5' });
    expect(stickyBtn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(window, { key: '5' });
    expect(stickyBtn.getAttribute('aria-pressed')).toBe('false');

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('still allows drawing at 999 elements', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board = {
      ...BOARD,
      elements: Array.from({ length: 999 }, (_, i) => ({
        id: `s${i}`,
        kind: 'sticky' as const,
        x: i * 10,
        y: 0,
        w: 100,
        h: 60,
        color: '#e8b955',
        text: '',
      })),
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Pen — 2' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(svg, { clientX: 40, clientY: 50 });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(svg, { clientX: 60, clientY: 70 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('keeps edge endpoints stable while dragging an unconnected node', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      id: 'wb1',
      createdAt: '',
      updatedAt: '',
      name: 'Board',
      description: '',
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 200, y: 0, w: 100, h: 60, color: '#e8b955', text: 'B' },
        { id: 'c', kind: 'sticky', x: 400, y: 0, w: 100, h: 60, color: '#e8b955', text: 'C' },
        {
          id: 'e1',
          kind: 'edge',
          sourceNodeId: 'b',
          targetNodeId: 'c',
          sourcePort: 'right',
          targetPort: 'left',
          x1: 300,
          y1: 30,
          x2: 400,
          y2: 30,
          arrowhead: true,
          label: '',
          arrowStyle: 'solid',
          color: '#8b5cf6',
          width: 2,
        },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 80, clientY: 120 });
    const edgePoly = document.querySelector('svg.wb-svg polyline') as SVGElement;
    expect(edgePoly.getAttribute('points')).toContain('300,30');
    expect(edgePoly.getAttribute('points')).toContain('400,30');
    fireEvent.pointerUp(svg, { clientX: 80, clientY: 120 });
  });

  it('toggles browser fullscreen with the toolbar button and the F key', () => {
    renderShell(BOARD);
    const shell = document.querySelector('.wb-shell') as HTMLElement;
    const requestFullscreen = Element.prototype.requestFullscreen as ReturnType<typeof vi.fn>;
    const exitFullscreen = Document.prototype.exitFullscreen as ReturnType<typeof vi.fn>;

    screen.getByRole('button', { name: 'Fullscreen — F' }).click();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'fullscreenElement', { value: shell, writable: true, configurable: true });
    fireEvent(document, new Event('fullscreenchange'));
    const exitBtn = screen.getByRole('button', { name: 'Exit fullscreen — F' });
    expect(exitBtn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.keyDown(window, { key: 'f' });
    expect(exitFullscreen).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
    fireEvent(document, new Event('fullscreenchange'));
    screen.getByRole('button', { name: 'Fullscreen — F' });
  });

  it('does not toggle fullscreen while typing', () => {
    renderShell(BOARD);
    const requestFullscreen = Element.prototype.requestFullscreen as ReturnType<typeof vi.fn>;
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'f' });
    expect(requestFullscreen).not.toHaveBeenCalled();
    input.remove();
  });

  it('snaps a drag to the 32px grid', () => {
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
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Drag a from (0,0) by (+33,+65): snaps to (32,64).
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 53, clientY: 85 });
    fireEvent.pointerUp(svg, { clientX: 53, clientY: 85 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const moved = action.patch.elements.find((el) => el.id === 'a');
    expect(moved).toMatchObject({ x: 32, y: 64 });
  });

  it('shows alignment guides when dragging near another element edge', () => {
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
        { id: 'b', kind: 'sticky', x: 200, y: 2, w: 100, h: 60, color: '#e8b955', text: 'B' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Select a, drag it so its top approaches b's top (y diff within 4px).
    fireEvent.pointerDown(svg, { button: 0, clientX: 50, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 50, clientY: 24 });
    expect(document.querySelectorAll('[data-testid="wb-guide"]').length).toBeGreaterThan(0);
    fireEvent.pointerUp(svg, { clientX: 50, clientY: 24 });

    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const moved = action.patch.elements.find((el) => el.id === 'a');
    expect(moved).toMatchObject({ y: 2 });
  });

  it('distributes selected elements evenly from the selection bar', () => {
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
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 60, h: 40, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 300, y: 0, w: 60, h: 40, color: '#e8b955', text: 'B' },
        { id: 'c', kind: 'sticky', x: 600, y: 0, w: 60, h: 40, color: '#e8b955', text: 'C' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Marquee over all three, then distribute horizontally.
    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 676, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 676, clientY: 76 });

    fireEvent.click(screen.getByRole('button', { name: 'Distribute horizontally' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const moved = Object.fromEntries(action.patch.elements.map((el) => [el.id as string, el.x as number]));
    expect(moved['b']).toBe(300);
  });



  it('copies a selection and pastes it with remapped edges and +24 offset', () => {
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
        { id: 'e1', kind: 'edge', sourceNodeId: 'a', targetNodeId: 'b', sourcePort: 'right', targetPort: 'left', x1: 100, y1: 30, x2: 200, y2: 30, arrowhead: true, label: '', arrowStyle: 'solid', color: '#8b5cf6', width: 2 },
        { id: 'c', kind: 'sticky', x: 400, y: 0, w: 100, h: 60, color: '#e8b955', text: 'C' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Marquee a + b + e1 (not c).
    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Select — 1' }));

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const added = action.patch.elements.slice(4);
    expect(added).toHaveLength(3);
    const stickies = added.filter((el) => el.kind === 'sticky');
    expect(stickies.map((el) => el.x as number).sort((a, b) => a - b)).toEqual([24, 224]);
    const edge = added.find((el) => el.kind === 'edge')!;
    expect(edge.sourceNodeId).not.toBe('a');
    expect(edge.targetNodeId).not.toBe('b');
    const newIds = new Set(stickies.map((el) => el.id as string));
    expect(newIds.has(edge.sourceNodeId as string)).toBe(true);
    expect(newIds.has(edge.targetNodeId as string)).toBe(true);
  });

  it('drops edges that cross the selection on copy', () => {
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
        { id: 'e1', kind: 'edge', sourceNodeId: 'a', targetNodeId: 'b', sourcePort: 'right', targetPort: 'left', x1: 100, y1: 30, x2: 200, y2: 30, arrowhead: true, label: '', arrowStyle: 'solid', color: '#8b5cf6', width: 2 },
        { id: 'c', kind: 'sticky', x: 400, y: 0, w: 100, h: 60, color: '#e8b955', text: 'C' },
        { id: 'e2', kind: 'edge', sourceNodeId: 'b', targetNodeId: 'c', sourcePort: 'right', targetPort: 'left', x1: 300, y1: 30, x2: 400, y2: 30, arrowhead: true, label: '', arrowStyle: 'solid', color: '#8b5cf6', width: 2 },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Select — 1' }));

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const added = action.patch.elements.slice(5);
    expect(added.filter((el) => el.kind === 'edge')).toHaveLength(1);
  });

  it('duplicates a selection with Ctrl+D and selects the copies', () => {
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
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.click(screen.getByRole('button', { name: 'Select area — 9' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Select — 1' }));

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const added = action.patch.elements.slice(2);
    expect(added).toHaveLength(2);
    expect(added.map((el) => el.x as number).sort((x, y) => x - y)).toEqual([24, 224]);
  });

  it('ignores paste when the element cap would be exceeded', () => {
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
        ...Array.from({ length: 1000 }, (_, i) => ({
          id: 'x'.concat(String(i).padStart(3, '0')),
          kind: 'sticky' as const,
          x: i,
          y: 0,
          w: 10,
          h: 10,
          color: '#e8b955',
          text: '',
        })),
      ],
    };
renderShell(board);
    // Select the first two elements directly (marquee is useless at the cap), copy via selection-less guard: select none -> Ctrl+C no-op;
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('activates the boundary tool with the B shortcut', () => {
    renderShell(BOARD);
    fireEvent.keyDown(window, { key: 'b' });
    expect(screen.getByRole('button', { name: 'Boundary — b' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('places a boundary by drag-to-size with snapped coordinates', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Boundary — b' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 216 });
    expect(document.querySelector('[data-testid="wb-boundary-draft"]')).not.toBeNull();
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 216 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
const boundary = action.patch.elements.find((el) => el.kind === 'boundary');
    expect(boundary).toMatchObject({ x: 0, y: 0, w: 300, h: 192 });
  });

  it('cancels a boundary smaller than the minimum size', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Boundary — b' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 36, clientY: 36 });
    fireEvent.pointerUp(svg, { clientX: 36, clientY: 36 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('renders a boundary behind other elements with a label chip', () => {
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
        { id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
        { id: 'bd1', kind: 'boundary', x: -20, y: -20, w: 300, h: 200, color: '#6ea8fe', label: 'System' },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
const children = Array.from(svg.querySelectorAll('g')).map((g) => g.children[0]);
    const boundaryIdx = children.findIndex((el) => el?.getAttribute('stroke-dasharray'));
    const stickyIdx = children.findIndex((el) => el?.getAttribute('width') === '100');
    expect(boundaryIdx).toBeGreaterThan(-1);
    expect(stickyIdx).toBeGreaterThan(boundaryIdx);
    expect(svg.textContent).toContain('System');
  });

  it('opens the boundary popover on double-click and patches label and color', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'bd1', kind: 'boundary', x: 0, y: 0, w: 300, h: 200, color: '#6ea8fe', label: '' }],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 50, clientY: 50 });
    const dialog = screen.getByRole('dialog', { name: 'Edit boundary' });
    expect(dialog).not.toBeNull();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Label' }), { target: { value: 'System' } });
    const patch = dispatch.mock.calls.at(-1)![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(patch.patch.elements.find((el) => el.kind === 'boundary')).toMatchObject({ label: 'System' });
  });

  it('cannot start or end an edge on a boundary', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'bd1', kind: 'boundary', x: 0, y: 0, w: 300, h: 200, color: '#6ea8fe', label: '' }],
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Edge — 7' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 120, clientY: 120 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('renders the new shape types with distinct paths', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: (['cylinder', 'parallelogram', 'hexagon', 'roundedRect'] as const).map((shapeType, i) => ({
        id: 's' + i,
        kind: 'shape' as const,
        shapeType,
        x: i * 120,
        y: 0,
        w: 100,
        h: 60,
        color: '#6ea8fe',
        fill: false,
        strokeWidth: 2,
        label: '',
      })),
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
const paths = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d'));
    expect(paths.some((d) => d!.includes('v 36'))).toBe(true);
    expect(paths.some((d) => d!.includes('L 195 60'))).toBe(true);
    expect(paths.some((d) => d!.includes('L 340 15'))).toBe(true);
    expect(paths.some((d) => d!.includes('a 15 15'))).toBe(true);
  });

  it('renders arrowheads per arrowStyle and legacy arrowhead as solid', () => {
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
        { id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' },
        { id: 's2', kind: 'shape', shapeType: 'rect', x: 300, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' },
        { id: 'e1', kind: 'edge', sourceNodeId: 's1', targetNodeId: 's2', sourcePort: 'right', targetPort: 'left', x1: 100, y1: 30, x2: 300, y2: 30, arrowhead: true, label: '', arrowStyle: 'diamond', color: '#8b5cf6', width: 2 },
        { id: 'e2', kind: 'edge', x1: 0, y1: 100, x2: 200, y2: 100, arrowhead: false, label: '', arrowStyle: 'circle', color: '#e4e4e7', width: 2 },
        { id: 'e3', kind: 'edge', x1: 0, y1: 150, x2: 200, y2: 150, arrowhead: true, label: '', arrowStyle: 'none', color: '#e4e4e7', width: 2 },
        { id: 'e4', kind: 'edge', x1: 0, y1: 200, x2: 200, y2: 200, arrowhead: false, label: '', arrowStyle: 'none', color: '#e4e4e7', width: 2 },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    const diamonds = Array.from(svg.querySelectorAll('polygon')).filter((p) => p.getAttribute('points') === '-8,0 0,-5 8,0 0,5');
    expect(diamonds.length).toBe(1);
    expect(diamonds[0]!.getAttribute('fill')).toBe('#8b5cf6');
    const circles = svg.querySelectorAll('circle');
    expect(Array.from(circles).some((c) => c.getAttribute('r') === '4')).toBe(true);
    const solids = Array.from(svg.querySelectorAll('polygon')).filter((p) => p.getAttribute('points') === '-8,-4 0,0 -8,4' && p.getAttribute('fill') !== 'none');
    expect(solids.length).toBe(1);
    const opens = Array.from(svg.querySelectorAll('polygon')).filter((p) => p.getAttribute('points') === '-8,-4 0,0 -8,4' && p.getAttribute('fill') === 'none');
    expect(opens.length).toBe(0);
  });

  it('brings a selected element forward in z-order', () => {
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
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Bring forward' }));
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements.map((el) => el.id)).toEqual(['b', 'a']);
  });

  it('sends a selected element backward in z-order', () => {
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
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 220, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 220, clientY: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Send backward' }));
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements.map((el) => el.id)).toEqual(['b', 'a']);
  });

  it('resizes a sticky via the bottom-right handle with grid snap and min size', () => {
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
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    expect(document.querySelector('[data-testid="wb-resize-handle"]')).not.toBeNull();

    // Handle sits at world (100,60) → client (116,76); drag to (156,106): +40,+30.
    fireEvent.pointerDown(svg, { button: 0, clientX: 116, clientY: 76 });
    fireEvent.pointerMove(svg, { clientX: 156, clientY: 106 });
    expect(document.querySelector('[data-testid="wb-resize-preview"]')).not.toBeNull();
    fireEvent.pointerUp(svg, { clientX: 156, clientY: 106 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
const el = action.patch.elements.find((e) => e.id === 'a');
    expect(el).toMatchObject({ w: 140, h: 96 });
  });

it('clamps resize to the minimum size and hides the handle for non-resizeable kinds', () => {
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
        {
          id: 'r1',
          kind: 'ref',
          entity: 'tasks',
          entityId: '11111111-1111-4111-8111-111111111111',
          x: 0,
          y: 0,
        },
      ],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    expect(document.querySelector('[data-testid="wb-resize-handle"]')).toBeNull();
  });

  it('resizes a text element via the bottom-right handle, patching only the wrap width', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 't1', kind: 'text', x: 0, y: 0, color: '#e4e4e7', fontSize: 16, text: 'alpha beta gamma delta epsilon zeta eta theta' }],
    };
    renderShell(board);
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 26, clientY: 12 });
    fireEvent.pointerUp(svg, { clientX: 26, clientY: 12 });
    expect(document.querySelector('[data-testid="wb-resize-handle"]')).not.toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 422, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 462, clientY: 60 });
    expect(document.querySelector('[data-testid="wb-resize-preview"]')).not.toBeNull();
    fireEvent.pointerUp(svg, { clientX: 462, clientY: 60 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const el = action.patch.elements.find((e) => e.id === 't1');
    expect(el).toMatchObject({ kind: 'text', w: 448 });
    expect(el).not.toHaveProperty('h');
  });

  it('inserts a newline on Shift+Enter in the text popover and finishes on plain Enter', () => {
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
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} state={makeState()} onBack={() => {}} /></MemoryRouter>);
    fireEvent.keyDown(window, { key: '4' });

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });
    rerender();

    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: 'line one' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    rerender();
    expect(screen.getByRole('dialog', { name: 'Edit text' })).not.toBeNull();

    fireEvent.change(textbox, { target: { value: 'line one\nline two' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });
    rerender();
    expect(screen.queryByRole('dialog', { name: 'Edit text' })).toBeNull();

    const placed = dispatch.mock.calls.find((c) => {
      const action = c[0] as { patch?: { elements: Array<Record<string, unknown>> } };
      return action.patch?.elements.some((el) => el.text === 'line one\nline two');
    });
    expect(placed).toBeTruthy();
  });

  describe('export PNG/SVG', () => {
    const STICKY: WhiteboardElement = { id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' };

    it('disables the export button on an empty board', () => {
      renderShell(BOARD);
      expect(screen.getByRole('button', { name: 'Export diagram' }).hasAttribute('disabled')).toBe(true);
    });

    it('opens the export menu with PNG and SVG options', () => {
      renderShell({ ...BOARD, elements: [STICKY] });
      const btn = screen.getByRole('button', { name: 'Export diagram' });
      expect(btn.hasAttribute('disabled')).toBe(false);
      fireEvent.click(btn);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      const menu = screen.getByRole('menu', { name: 'Export diagram' });
      expect(within(menu).getByRole('menuitem', { name: 'PNG image' })).not.toBeNull();
      expect(within(menu).getByRole('menuitem', { name: 'SVG image' })).not.toBeNull();
    });

    it('closes the export menu on Escape', () => {
      renderShell({ ...BOARD, elements: [STICKY] });
      const btn = screen.getByRole('button', { name: 'Export diagram' });
      fireEvent.click(btn);
      expect(screen.getByRole('menu', { name: 'Export diagram' })).not.toBeNull();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('menu', { name: 'Export diagram' })).toBeNull();
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('downloads the board as an SVG file from the menu', () => {
      const createObjectURL = vi.fn().mockReturnValue('blob:mock');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
      Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          expect(this.download).toBe('plan.svg');
        });
      renderShell({ ...BOARD, elements: [STICKY] });
      fireEvent.click(screen.getByRole('button', { name: 'Export diagram' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'SVG image' }));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0]![0] as Blob;
      expect(blob.type).toBe('image/svg+xml');
      clickSpy.mockRestore();
    });
  });

});