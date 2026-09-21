import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within, act } from '@testing-library/react';
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

    for (const name of ['Select — V', 'Pen — P', 'Eraser — E', 'Entity ref card — D']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.hasAttribute('disabled')).toBe(false);
      expect(btn.closest('[role="toolbar"]')).toBe(toolbar);
    }
    for (const name of ['Undo — Ctrl+Z', 'Redo — Ctrl+Y']) {
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
  });

  it('toggles the active tool with aria-pressed on click', () => {
    renderShell(BOARD);
    const view = screen.getByRole('button', { name: 'View only — H' });
    const select = screen.getByRole('button', { name: 'Select — V' });
    const pen = screen.getByRole('button', { name: 'Pen — P' });

    expect(view.getAttribute('aria-pressed')).toBe('false');
    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(pen.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(pen);
    expect(pen.getAttribute('aria-pressed')).toBe('true');
    expect(select.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(select);
    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(pen.getAttribute('aria-pressed')).toBe('false');
  });

  it('activates tools via FigJam-style letter aliases as well as digits', () => {
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
    renderShell(BOARD);
    const text = screen.getByRole('button', { name: 'Text — T' });
    const sticky = screen.getByRole('button', { name: 'Sticky note — N' });
    const edge = screen.getByRole('button', { name: 'Edge — L' });
    fireEvent.keyDown(window, { key: 't' });
    expect(text.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'T' });
    expect(text.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'n' });
    expect(sticky.getAttribute('aria-pressed')).toBe('true');
    expect(text.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(window, { key: 'l' });
    expect(edge.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('button', { name: 'View only — H' }).getAttribute('aria-pressed')).toBe('true');
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
    fireEvent.click(screen.getByRole('button', { name: 'Pen — P' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Pen — P' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 30 });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('activates text/sticky/shape via letter shortcuts', () => {
    renderShell(BOARD);
    const text = screen.getByRole('button', { name: 'Text — T' });
    const sticky = screen.getByRole('button', { name: 'Sticky note — N' });
    const shape = screen.getByRole('button', { name: 'Shape — S' });

    fireEvent.keyDown(window, { key: 't' });
    expect(text.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'n' });
    expect(sticky.getAttribute('aria-pressed')).toBe('true');
    expect(text.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(window, { key: 's' });
    expect(shape.getAttribute('aria-pressed')).toBe('true');
  });

  it('places a sticky on click and edits color and text via floating bars', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Sticky note — N' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    // Click on empty canvas (right of the existing sticky) to place.
    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 400, clientY: 120 });

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

    // Element bar (border click): fill dot opens the FigJam color panel.
    fireEvent.click(screen.getByRole('button', { name: 'Fill color #e8b955' }));
    const panel = screen.getByRole('dialog', { name: 'Fill color' });
    expect(panel).not.toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Fill color #f4706d' }));
    expect(dispatch).toHaveBeenCalledTimes(2);
    const colored = (dispatch.mock.calls[1]![0] as { patch: { elements: Array<Record<string, unknown>> } }).patch.elements;
    expect(colored.some((el) => el.color === '#f4706d')).toBe(true);
    rerender();

    // Double-click the s1 text area edits inline; Enter commits once.
    fireEvent.doubleClick(svg, { clientX: 116, clientY: 76 });
    const editor = screen.getByRole('textbox', { name: 'Sticky text' });
    // P8: the canvas text hides while the editor owns it (no double text).
    expect((document.querySelector('svg.wb-svg') as SVGSVGElement).textContent).not.toContain('Hi');
    fireEvent.change(editor, { target: { value: 'Meeting notes' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
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
    fireEvent.click(screen.getByRole('button', { name: 'Sticky note — N' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    // Click on empty canvas (right of the existing sticky) to place.
    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 400, clientY: 120 });
    rerender();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(dispatch).toHaveBeenCalledTimes(2);
    const remaining = (dispatch.mock.calls[1]![0] as { patch: { elements: Array<Record<string, unknown>> } }).patch.elements;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: 's1', text: 'Hi' });
  });

  it('keeps the floating bar usable when placing an element at the bottom-right corner', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Sticky note — N' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 700, clientY: 500 });
    fireEvent.pointerUp(svg, { clientX: 700, clientY: 500 });
    rerender();

    expect(screen.getByRole('group', { name: 'Selection actions' })).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    rerender();
    expect(screen.queryByRole('group', { name: 'Selection actions' })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 76 });
    // Delete lives in the right-click object menu (FigJam parity).
    expect(screen.queryByRole('menu', { name: 'Object actions' })).toBeNull();
    fireEvent.contextMenu(svg, { clientX: 316, clientY: 76 });
    expect(screen.getByRole('menu', { name: 'Object actions' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Delete selected Del' })).not.toBeNull();

    // Switch to select and drag a → the multi-selection is kept and both move.
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Edge — L' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Edge — L' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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

  it('selects the edge tool with the letter shortcut', () => {
    renderShell(BOARD);
    const edge = screen.getByRole('button', { name: 'Edge — L' });
    fireEvent.keyDown(window, { key: 'l' });
    expect(edge.getAttribute('aria-pressed')).toBe('true');
  });

  it('activates the ref tool with the letter shortcut', () => {
    renderShell(BOARD);
    const refBtn = screen.getByRole('button', { name: 'Entity ref card — D' });
    fireEvent.keyDown(window, { key: 'd' });
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
    fireEvent.click(screen.getByRole('button', { name: 'Entity ref card — D' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });

    const dialog = screen.getByRole('dialog', { name: 'Link an entity' });
    expect(dialog).not.toBeNull();

    fireEvent.click(screen.getByRole('option', { name: /Build login/ }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Entity ref card — D' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });

    const endpoint = screen.getByRole('option', { name: /List projects/ });
    expect(endpoint.textContent).toContain('GET /api/projects');

    const milestone = screen.getByRole('option', { name: /M18 Ship/ });
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
    fireEvent.click(screen.getByRole('button', { name: 'Entity ref card — D' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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

  it('edits sticky text inline on double-click and cancels empty edits with Escape', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 20, clientY: 20 });

    const editor = screen.getByRole('textbox', { name: 'Sticky text' });
    expect(editor).not.toBeNull();
    fireEvent.change(editor, { target: { value: 'B' } });
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Sticky text' })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('opens inline editing when a shape label is double-clicked', () => {
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
    let current: Whiteboard = { ...board };
    dispatch.mockImplementation((action: { type: string; patch?: { elements: WhiteboardElement[] } }) => {
      if (action.type === 'whiteboard/update' && action.patch) {
        current = { ...current, elements: action.patch.elements };
      }
    });
    const view = renderShell(current);
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} state={makeState()} onBack={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 20, clientY: 20 });
    const editor = screen.getByRole('textbox', { name: 'Label' });
    fireEvent.change(editor, { target: { value: 'Gateway' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
    rerender();

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements.find((e) => e.id === 's1')).toMatchObject({ label: 'Gateway' });
  });

  it('edits an edge label inline and its style via the floating line panel', () => {
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
    let current: Whiteboard = { ...board };
    dispatch.mockImplementation((action: { type: string; patch?: { elements: WhiteboardElement[] } }) => {
      if (action.type === 'whiteboard/update' && action.patch) {
        current = { ...current, elements: action.patch.elements };
      }
    });
    const view = renderShell(current);
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} state={makeState()} onBack={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 266, clientY: 76 });
    const editor = screen.getByRole('textbox', { name: 'Label' });
    fireEvent.change(editor, { target: { value: 'HTTP' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
    rerender();

    const labelPatch = dispatch.mock.calls.at(-1)![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(labelPatch.patch.elements.find((e) => e.kind === 'edge')).toMatchObject({ label: 'HTTP' });

    // Click the line (away from the label) for the element bar, then open Line style.
    fireEvent.pointerDown(svg, { button: 0, clientX: 231, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 231, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Line style' }));
    fireEvent.click(screen.getByRole('radio', { name: 'diamond' }));
    rerender();
    const arrowPatch = dispatch.mock.calls.at(-1)![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(arrowPatch.patch.elements.find((e) => e.kind === 'edge')).toMatchObject({ arrowStyle: 'diamond' });
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

    fireEvent.click(screen.getByRole('button', { name: 'Text — T' }));
    expect(svg.style.cursor).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Pen — P' }));
    expect(svg.style.cursor).toBe('crosshair');

    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    expect(screen.queryByRole('menu', { name: 'Object actions' })).toBeNull();

    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });

    fireEvent.contextMenu(svg, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete selected Del' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Pen — P' }));
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

  it('WB-7: dragging empty space with the select tool starts a marquee (pan via Space/view)', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // World = client - 16; (184,184) is empty space, not the sticky at (0,0,100,60).
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 210, clientY: 210 });
    expect(document.querySelector('[data-testid="wb-marquee"]')).not.toBeNull();
    fireEvent.pointerMove(svg, { clientX: 240, clientY: 240 });
    fireEvent.pointerUp(svg, { clientX: 240, clientY: 240 });

    // marquee box (184..224) misses the sticky → selection cleared, no pan, no dispatch
    expect(document.querySelector('[data-testid="wb-marquee"]')).toBeNull();
    const g = document.querySelector('svg.wb-svg > g') as SVGGraphicsElement;
    expect(g.getAttribute('transform')).toContain('translate(16 16)');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('WB-7: select-tool marquee selects intersecting elements', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    // drag a box covering the sticky: world (-20,-20)..(150,100)
    fireEvent.pointerDown(svg, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(svg, { clientX: 166, clientY: 116 });
    fireEvent.pointerUp(svg, { clientX: 166, clientY: 116 });
    expect(document.querySelectorAll('[data-testid="wb-selection"]').length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole('button', { name: 'Eraser — E' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Eraser — E' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Eraser — E' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    expect(screen.queryByRole('button', { name: 'Delete selected' })).toBeNull();

    // Marquee world (0,0) → (200,60): touches a and b, not c.
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 216, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 216, clientY: 76 });

    fireEvent.contextMenu(svg, { clientX: 216, clientY: 76 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete selected Del' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));

    // Marquee world (250,0) → (350,60): only b.
    fireEvent.pointerDown(svg, { button: 0, clientX: 266, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 366, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 366, clientY: 76 });
    fireEvent.contextMenu(svg, { clientX: 366, clientY: 76 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete selected Del' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    // Select a by clicking it, then shift+marquee over b.
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
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
    fireEvent.contextMenu(svg, { clientX: 366, clientY: 76 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete selected Del' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));

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
    const btn = screen.getByRole('button', { name: 'Select area — M' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(window, { key: 'm' });
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
    expect(screen.getByRole('button', { name: 'Pen — P' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Sticky note — N' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Shape — S' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Select — V' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Eraser — E' }).hasAttribute('disabled')).toBe(false);

    // The shortcut is blocked too, and the canvas guard rejects placement.
    const stickyBtn = screen.getByRole('button', { name: 'Sticky note — N' });
    expect(stickyBtn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(window, { key: 'n' });
    expect(stickyBtn.getAttribute('aria-pressed')).toBe('false');

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  // Heavy render (999 SVG nodes) — generous timeout under full-suite load.
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
    fireEvent.click(screen.getByRole('button', { name: 'Pen — P' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(svg, { clientX: 40, clientY: 50 });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(svg, { clientX: 60, clientY: 70 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  }, 30000);

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

  it('WB-16/17/19: top bar holds back + name left, Canvas button right', () => {
    renderShell(BOARD);
    const shell = document.querySelector('.wb-shell') as HTMLElement;
    expect(shell.classList.contains('wb-fullscreen')).toBe(false);
    // top bar outside the canvas: back + title left, Canvas button right
    const topbar = document.querySelector('.wb-topbar') as HTMLElement;
    expect(topbar).not.toBeNull();
    expect(topbar.querySelector('.back-btn')).not.toBeNull();
    expect(topbar.textContent).toContain('Plan');
    expect(topbar.textContent).toContain('Canvas');
    // corner panels: undo/redo/layers top-left, board/present/export top-right
    expect(document.querySelector('.wb-corner-tl')).not.toBeNull();
    expect(document.querySelector('.wb-corner-tr .wb-corner-name')?.textContent).toBe('Plan');
    // no in-canvas title in normal mode
    expect(screen.queryByRole('button', { name: 'Exit fullscreen — F' })).toBeNull();

    // enter fullscreen overlay from the top bar
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen — F' }));
    expect(shell.classList.contains('wb-fullscreen')).toBe(true);
    // back + topbar gone; corner panel with name + X visible inside the canvas
    expect(document.querySelector('.wb-topbar')).toBeNull();
    expect(document.querySelector('.wb-corner-tr .wb-corner-name')?.textContent).toBe('Plan');
    const exitBtn = screen.getByRole('button', { name: 'Exit fullscreen — F' });
    expect(exitBtn.closest('.wb-main-canvas')).not.toBeNull();

    // F key exits back to normal
    fireEvent.keyDown(window, { key: 'f' });
    expect(shell.classList.contains('wb-fullscreen')).toBe(false);
    screen.getByRole('button', { name: 'Fullscreen — F' });
  });

  it('top bar wraps the full board name and shows the full description', () => {
    const longName = `s${'s'.repeat(120)}`;
    const desc = 'Line one.\nLine two with details.';
    renderShell({ ...BOARD, name: longName, description: desc });
    const nameEl = document.querySelector('.wb-topbar .wb-board-name') as HTMLElement;
    expect(nameEl.textContent).toBe(longName);
    const descEl = document.querySelector('.wb-topbar .wb-board-desc') as HTMLElement;
    expect(descEl.textContent).toBe(desc);
  });

  it('top bar omits the description slot when the board has none', () => {
    renderShell(BOARD);
    expect(document.querySelector('.wb-topbar .wb-board-desc')).toBeNull();
  });

  it('WB-17/20: Escape and X exit presentation straight to normal', () => {
    renderShell(BOARD);
    const shell = document.querySelector('.wb-shell') as HTMLElement;
    // enter presentation from the pill (true browser fullscreen + hidden chrome)
    fireEvent.click(screen.getByRole('button', { name: 'Present board' }));
    expect(shell.classList.contains('wb-presenting')).toBe(true);
    // all chrome hidden, canvas + corner panel with X remain
    expect(document.querySelector('.board-toolbar')).toBeNull();
    expect(document.querySelector('.wb-dock-right')).toBeNull();
    expect(document.querySelector('.wb-corner-tr')).not.toBeNull();
    expect(document.querySelector('svg.wb-svg')).not.toBeNull();
    screen.getByRole('button', { name: 'Exit presentation' });

    // Esc exits presentation straight to normal mode
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(shell.classList.contains('wb-presenting')).toBe(false);
    expect(shell.classList.contains('wb-fullscreen')).toBe(false);
    expect(document.querySelector('.wb-topbar')).not.toBeNull();
    expect(document.querySelector('.board-toolbar')).not.toBeNull();

    // X also exits everything to normal
    fireEvent.click(screen.getByRole('button', { name: 'Present board' }));
    expect(shell.classList.contains('wb-presenting')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Exit presentation' }));
    expect(shell.classList.contains('wb-presenting')).toBe(false);
    expect(shell.classList.contains('wb-fullscreen')).toBe(false);
    expect(document.querySelector('.wb-topbar')).not.toBeNull();
  });

  it('WB-20: present requests browser fullscreen; browser Esc syncs back', () => {
    renderShell(BOARD);
    const shell = document.querySelector('.wb-shell') as HTMLElement;
    const requestFullscreen = Element.prototype.requestFullscreen as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByRole('button', { name: 'Present board' }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(shell.classList.contains('wb-presenting')).toBe(true);
    // browser takes over Esc: fullscreenchange without an element exits to normal
    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
    fireEvent(document, new Event('fullscreenchange'));
    expect(shell.classList.contains('wb-presenting')).toBe(false);
    expect(shell.classList.contains('wb-fullscreen')).toBe(false);
    expect(document.querySelector('.wb-topbar')).not.toBeNull();
  });

  it('does not toggle fullscreen while typing', () => {
    renderShell(BOARD);
    const shell = document.querySelector('.wb-shell') as HTMLElement;
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'f' });
    expect(shell.classList.contains('wb-fullscreen')).toBe(false);
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 316, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 316, clientY: 76 });
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));

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
    expect(screen.getByRole('button', { name: 'Boundary — B' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('activates the view-only tool with the H shortcut (V selects)', () => {
    renderShell(BOARD);
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('button', { name: 'View only — H' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'v' });
    expect(screen.getByRole('button', { name: 'Select — V' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('view-only mode pans instead of selecting or editing elements', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const boardWithSticky: Whiteboard = {
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' }],
    };
    renderShell(boardWithSticky);
    fireEvent.click(screen.getByRole('button', { name: 'View only — H' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.pointerDown(svg, { button: 0, clientX: 30, clientY: 30 });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 60 });
    fireEvent.pointerUp(svg, { clientX: 60, clientY: 60 });

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Selection actions' })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Boundary — B' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Boundary — B' }));
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

  it('edits a boundary label inline on double-click', () => {
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
    let current: Whiteboard = { ...board };
    dispatch.mockImplementation((action: { type: string; patch?: { elements: WhiteboardElement[] } }) => {
      if (action.type === 'whiteboard/update' && action.patch) {
        current = { ...current, elements: action.patch.elements };
      }
    });
    const view = renderShell(current);
    const rerender = () => view.rerender(<MemoryRouter><WhiteboardEditorShell board={current} state={makeState()} onBack={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;

    fireEvent.doubleClick(svg, { clientX: 50, clientY: 50 });
    const editor = screen.getByRole('textbox', { name: 'Label' });
    fireEvent.change(editor, { target: { value: 'System' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
    rerender();
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
    fireEvent.click(screen.getByRole('button', { name: 'Edge — L' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    fireEvent.contextMenu(svg, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bring forward Ctrl+]' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 220, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 220, clientY: 20 });
    fireEvent.contextMenu(svg, { clientX: 220, clientY: 20 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send backward Ctrl+[' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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

  it('WB-5: rotates a selected shape via the hover-corner gesture (no button, no handle)', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 'a', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' }],
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    // FigJam parity: no rotate handle on canvas, no rotate button in the bar.
    expect(document.querySelector('[data-testid="wb-rotate-handle"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rotate 90°' })).toBeNull();
    // ...but the four corner scale handles are present.
    expect(document.querySelectorAll('[data-testid="wb-resize-handle"]')).toHaveLength(4);

    // SE corner world (100,60) → client (116,76); ring point (130,90) ≈ 19.8px out.
    fireEvent.pointerDown(svg, { button: 0, clientX: 130, clientY: 90 });
    // Drag toward world (134,24): delta ≈ -38.6° → snaps to -45°.
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 40 });
    fireEvent.pointerUp(svg, { clientX: 150, clientY: 40 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const el = action.patch.elements.find((e) => e.id === 'a');
    expect(el).toMatchObject({ rotation: -45 });
  });

  it('WB-5: rotate preview follows the drag angle before commit', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({
      ...BOARD,
      elements: [{ id: 'a', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    // Start the rotate drag but do not release: the element already shows -45°.
    fireEvent.pointerDown(svg, { button: 0, clientX: 130, clientY: 90 });
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 40 });
    expect(svg.querySelector('g[transform*="rotate(-45"]')).not.toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.pointerUp(svg, { clientX: 150, clientY: 40 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('WB-5: hovering beside a corner shows the rotate cursor', () => {
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
    renderShell({
      ...BOARD,
      elements: [{ id: 'a', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    expect(svg.style.cursor).toBe('grab');
    // Beside the SE corner (zone center ≈ 135,87): rotate cursor, no click needed.
    fireEvent.pointerMove(svg, { clientX: 135, clientY: 87 });
    expect(svg.style.cursor).toContain('url(');
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 400 });
    expect(svg.style.cursor).toBe('grab');
  });

  it('WB-5: rotated adornments use a single rotation (handles + ports follow the outline)', () => {
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
    renderShell({
      ...BOARD,
      elements: [{ id: 'a', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '', rotation: 90 }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 66, clientY: 46 });
    fireEvent.pointerUp(svg, { clientX: 66, clientY: 46 });
    // Handle rects sit on the unrotated box corners (10px @ s=1) …
    const handles = [...document.querySelectorAll('[data-testid="wb-resize-handle"]')];
    expect(handles).toHaveLength(4);
    const xs = handles.map((h) => Number(h.getAttribute('x'))).sort((a, b) => a - b);
    const ys = handles.map((h) => Number(h.getAttribute('y'))).sort((a, b) => a - b);
    expect(xs).toEqual([-5, -5, 95, 95]);
    expect(ys).toEqual([-5, -5, 55, 55]);
    // …inside exactly one rotate wrapper (no double rotation).
    expect(handles[0]!.parentElement?.getAttribute('transform')).toBe('rotate(90, 50, 30)');
    // Ports sit on the box sides in the same rotated frame.
    const ports = [...document.querySelectorAll('[data-testid="wb-port-handle"]')];
    expect(ports).toHaveLength(4);
    const cxs = ports.map((p) => Number(p.getAttribute('cx'))).sort((a, b) => a - b);
    const cys = ports.map((p) => Number(p.getAttribute('cy'))).sort((a, b) => a - b);
    expect(cxs).toEqual([0, 50, 50, 100]);
    expect(cys).toEqual([0, 30, 30, 60]);
    expect(ports[0]!.parentElement?.parentElement?.getAttribute('transform')).toBe('rotate(90, 50, 30)');
  });

  it('WB-5: no rotate gesture for sticky (FigJam forbids it) or locked kinds', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: null,
      role: 'owner',
      canEdit: true,
      dispatch,
    });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' }],
    };
    renderShell(board);
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    // Ring drag on a sticky starts nothing (falls through to element hit → drag).
    fireEvent.pointerDown(svg, { button: 0, clientX: 130, clientY: 90 });
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 40 });
    fireEvent.pointerUp(svg, { clientX: 150, clientY: 40 });
    expect(dispatch).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
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

  it('inserts a newline on Shift+Enter in inline editing and commits on plain Enter', () => {
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
    fireEvent.keyDown(window, { key: 't' });

    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });
    rerender();

    // Enter on the focused canvas opens inline editing for the placed text.
    const canvasDiv = document.querySelector('.wb-canvas') as HTMLElement;
    fireEvent.keyDown(canvasDiv, { key: 'Enter' });
    const textbox = screen.getByRole('textbox', { name: 'Text' });
    fireEvent.change(textbox, { target: { value: 'line one' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    rerender();
    expect(screen.getByRole('textbox', { name: 'Text' })).not.toBeNull();

    fireEvent.change(textbox, { target: { value: 'line one\nline two' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });
    rerender();
    // Plain Enter commits once and unmounts the editor.
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();

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

    it('WB-3: stays silent (no error toast) when the PDF popup is blocked', () => {
      const openSpy = vi.fn().mockReturnValue(null);
      Object.defineProperty(window, 'open', { value: openSpy, configurable: true });
      renderShell({ ...BOARD, elements: [STICKY] });
      fireEvent.click(screen.getByRole('button', { name: 'Export diagram' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'PDF document' }));
      expect(openSpy).toHaveBeenCalledTimes(1);
      // D8: error transient notices are gone — the restore slot is the only message.
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  describe('WB-6 edge UX', () => {
    const AB: WhiteboardElement[] = [
      { id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'A' },
      { id: 'b', kind: 'sticky', x: 300, y: 0, w: 200, h: 120, color: '#e8b955', text: 'B' },
    ];

    function renderEdgeBoard() {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({ ...BOARD, elements: AB });
      fireEvent.click(screen.getByRole('button', { name: 'Edge — L' }));
      return { dispatch, svg: document.querySelector('svg.wb-svg') as SVGSVGElement };
    }

    it('stays silent (no notice) when an edge is dropped on empty space', () => {
      const { dispatch, svg } = renderEdgeBoard();
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(svg, { clientX: 500, clientY: 400 });
      fireEvent.pointerUp(svg, { clientX: 500, clientY: 400 });
      expect(dispatch).not.toHaveBeenCalled();
      // D8: edge-drop hint notice removed.
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('selects a newly drawn edge so its label is one click away', () => {
      // live harness: dispatch applies the patch so selection resolves against fresh elements
      function LiveShell() {
        const [elements, setElements] = useState(AB);
        const dispatch = (action: { patch: { elements: WhiteboardElement[] } }) => {
          setElements(action.patch.elements);
        };
        useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
        return (
          <MemoryRouter>
            <WhiteboardEditorShell board={{ ...BOARD, elements }} state={makeState()} onBack={() => {}} />
          </MemoryRouter>
        );
      }
      render(<LiveShell />);
      fireEvent.click(screen.getByRole('button', { name: 'Edge — L' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(svg, { clientX: 320, clientY: 80 });
      fireEvent.pointerUp(svg, { clientX: 320, clientY: 80 });
      expect(screen.getByRole('group', { name: 'Selection actions' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Line style' })).not.toBeNull();
    });
  });

  describe('WB-6 snap on place', () => {
    it('snaps a newborn sticky to the grid', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({ ...BOARD, elements: [] });
      fireEvent.click(screen.getByRole('button', { name: 'Sticky note — N' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      // client (40,40) → world (24,24) → within snap radius of grid 32
      fireEvent.pointerDown(svg, { button: 0, clientX: 40, clientY: 40 });
      fireEvent.pointerUp(svg, { clientX: 40, clientY: 40 });
      expect(dispatch).toHaveBeenCalledTimes(1);
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements[0]).toMatchObject({ x: 32, y: 32 });
    });
  });

  describe('WB-8 ref discoverability', () => {
    function renderRefBoard() {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({
        state: {
          tasks: [{ id: 't1', title: 'Build login', status: 'todo', priority: 'medium' }],
          issues: [],
        },
        role: 'owner',
        canEdit: true,
        projectId: 'p1',
        dispatch,
      });
      renderShellWithProbe({
        ...BOARD,
        elements: [{ id: 'r1', kind: 'ref', entity: 'tasks', entityId: 't1', x: 0, y: 0 }],
      });
      return dispatch;
    }

    it('opens the source entity via double-click (no link icon in the ref bar)', () => {
      renderRefBoard();
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
      // D14: the external-link icon is gone from the floating bar.
      expect(screen.queryByRole('button', { name: 'Open source' })).toBeNull();
      fireEvent.doubleClick(svg, { button: 0, clientX: 20, clientY: 20 });
      expect(screen.getByTestId('loc').textContent).toBe('/project/p1?tab=board&entity=tasks&id=t1');
    });

    it('matches picker search against status and id, not just title', () => {
      useProjectMock.mockReturnValue({
        state: {
          tasks: [
            { id: 't1', title: 'Build login', status: 'todo' },
            { id: 't2', title: 'Unrelated chore', status: 'done' },
          ],
          issues: [],
        },
        role: 'owner',
        canEdit: true,
        dispatch: vi.fn(),
      });
      renderShell(BOARD);
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      fireEvent.click(screen.getByRole('button', { name: 'Entity ref card — D' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
      fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });
      const dialog = screen.getByRole('dialog', { name: 'Link an entity' });
      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'done' } });
      expect(within(dialog).getByRole('option', { name: /Unrelated chore/ })).not.toBeNull();
      expect(within(dialog).queryByRole('option', { name: /Build login/ })).toBeNull();
    });

    it('shows a truncated hint when more than 50 entities match', () => {
      const tasks = Array.from({ length: 55 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, status: 'todo' }));
      useProjectMock.mockReturnValue({
        state: { tasks, issues: [] },
        role: 'owner',
        canEdit: true,
        dispatch: vi.fn(),
      });
      renderShell(BOARD);
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      fireEvent.click(screen.getByRole('button', { name: 'Entity ref card — D' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
      fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });
      const dialog = screen.getByRole('dialog', { name: 'Link an entity' });
      expect(dialog.textContent).toContain('+5 more');
    });
  });

  describe('WB-15 shape dropdown', () => {
    it('WB-23: opens the image popup from the shape button and places the picked type', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell(BOARD);
      expect(screen.queryByRole('button', { name: 'Shape type' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Shape — S' }));
      const menu = screen.getByRole('menu', { name: 'Shape type' });
      const items = within(menu).getAllByRole('menuitemradio');
      expect(items).toHaveLength(7);
      // options are vector previews, not text
      expect(menu.querySelectorAll('svg').length).toBe(7);
      fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'diamond' }));
      expect(screen.queryByRole('menu', { name: 'Shape type' })).toBeNull();
      // shape tool active with diamond default; place it
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.pointerUp(svg, { clientX: 100, clientY: 100 });
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements[0]).toMatchObject({ kind: 'shape', shapeType: 'diamond' });
    });

    it('drags with the shape tool to preview and commit a drag-sized shape', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell(BOARD);
      fireEvent.click(screen.getByRole('button', { name: 'Shape — S' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'diamond' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      // press: world (84,84) at the default (16,16) pan — no ghost yet
      fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
      // drag: world (284,204) snaps to (288,204) — ghost scales along
      fireEvent.pointerMove(svg, { clientX: 300, clientY: 220 });
      expect(document.querySelector('[data-testid="wb-shape-draft"]')).not.toBeNull();
      fireEvent.pointerUp(svg, { clientX: 300, clientY: 220 });
      expect(document.querySelector('[data-testid="wb-shape-draft"]')).toBeNull();
      expect(dispatch).toHaveBeenCalledTimes(1);
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements[0]).toMatchObject({ kind: 'shape', shapeType: 'diamond', x: 84, y: 84, w: 204, h: 120 });
    });

    it('clicks without dragging to place the default-size shape', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell(BOARD);
      fireEvent.click(screen.getByRole('button', { name: 'Shape — S' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'diamond' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.pointerUp(svg, { clientX: 100, clientY: 100 });
      expect(document.querySelector('[data-testid="wb-shape-draft"]')).toBeNull();
      expect(dispatch).toHaveBeenCalledTimes(1);
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements[0]).toMatchObject({ kind: 'shape', shapeType: 'diamond', x: 84, y: 84, w: 120, h: 80 });
    });

    it('patches a selected shape without leaving the inspector', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [{ id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
      fireEvent.click(screen.getByRole('button', { name: 'Shape — S' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'ellipse' }));
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements[0]).toMatchObject({ id: 's1', shapeType: 'ellipse' });
    });

    it('WB-21: opens the shape menu on click (no hover intent)', () => {
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
      renderShell(BOARD);
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const shapeBtn = screen.getByRole('button', { name: 'Shape — S' });
      fireEvent.mouseEnter(shapeBtn);
      expect(screen.queryByRole('menu', { name: 'Shape type' })).toBeNull();
      fireEvent.click(shapeBtn);
      expect(screen.getByRole('menu', { name: 'Shape type' })).not.toBeNull();
      fireEvent.click(shapeBtn);
      expect(screen.queryByRole('menu', { name: 'Shape type' })).toBeNull();
    });

    it('WB-25: shape options show tooltips and the popup fits content', () => {
      vi.useFakeTimers();
      try {
        useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
        renderShell(BOARD);
        fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
        fireEvent.click(screen.getByRole('button', { name: 'Shape — S' }));
        const menu = screen.getByRole('menu', { name: 'Shape type' });
        const diamond = within(menu).getByRole('menuitemradio', { name: 'diamond' });
        fireEvent.mouseEnter(diamond);
        act(() => {
          vi.advanceTimersByTime(200);
        });
        const tip = screen.getByRole('tooltip');
        expect(tip.textContent).toBe('diamond');
      } finally {
        vi.useRealTimers();
      }
    });

    it('WB-24: shows a pill tooltip on hover and hides on leave', () => {
      vi.useFakeTimers();
      try {
        useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
        renderShell(BOARD);
        fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
        const pen = screen.getByRole('button', { name: 'Pen — P' });
        fireEvent.mouseEnter(pen);
        expect(screen.queryByRole('tooltip')).toBeNull();
        act(() => {
          vi.advanceTimersByTime(200);
        });
        const tip = screen.getByRole('tooltip');
        expect(tip.textContent).toBe('Pen — P');
        expect(tip.querySelector('.tooltip-card-dark')).not.toBeNull();
        fireEvent.mouseLeave(pen);
        expect(screen.queryByRole('tooltip')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('shows type+color+border dropdowns (no inspector) for a selected empty shape', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [{ id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
      // No inspector anywhere; the floating bar carries type + color + border.
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(screen.getByRole('button', { name: 'Shape type' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Fill color #6ea8fe' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Line style' })).not.toBeNull();
      // Type dropdown: all tabs + fill switch.
      fireEvent.click(screen.getByRole('button', { name: 'Shape type' }));
      const typeDialog = screen.getByRole('dialog', { name: 'Shape type' });
      expect(within(typeDialog).getByRole('radiogroup', { name: 'Basic' })).not.toBeNull();
      expect(within(typeDialog).getByRole('checkbox', { name: 'Filled' })).not.toBeNull();
      // Non-basic tab content is present too.
      expect(within(typeDialog).getByRole('radio', { name: 'Predefined process' })).not.toBeNull();
      fireEvent.click(within(typeDialog).getByRole('radio', { name: 'Predefined process' }));
      expect(dispatch).toHaveBeenCalledTimes(1);
      let action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements[0]).toMatchObject({ id: 's1', shapeType: 'predefinedProcess' });
      // Border dropdown: solid / dashed / none.
      fireEvent.click(screen.getByRole('button', { name: 'Line style' }));
      const borderDialog = screen.getByRole('dialog', { name: 'Line style' });
      fireEvent.click(within(borderDialog).getByRole('radio', { name: 'dashed' }));
      action = dispatch.mock.calls[1]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements[0]).toMatchObject({ id: 's1', dash: 'dashed' });
    });

    it('V2: clicking Add text on an empty shape opens the editor and the merged text bar', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [{ id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 66, clientY: 46 });
      fireEvent.pointerUp(svg, { clientX: 66, clientY: 46 });
      // Element-only bar while empty and idle.
      expect(screen.getByRole('button', { name: 'Shape type' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Font' })).toBeNull();
      // Click the ghost → inline editor + merged text props (incl. shape type).
      fireEvent.pointerDown(screen.getByText('Add text'));
      expect(screen.getByRole('textbox', { name: 'Label' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Font' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Duplicate' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Shape type' })).not.toBeNull();
    });

    it('V2: empty sticky shows fill only; editor is borderless', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [{ id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: '' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
      expect(screen.getByRole('button', { name: 'Fill color #e8b955' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Font' })).toBeNull();
      fireEvent.pointerDown(screen.getByText('Add text'));
      const editor = screen.getByRole('textbox', { name: 'Sticky text' }) as HTMLTextAreaElement;
      expect(editor.style.background).toBe('transparent');
      expect(editor.style.borderStyle).toBe('none');
      expect(screen.getByRole('button', { name: 'Font' })).not.toBeNull();
    });

    it('V1: vertical align segmented applies to sticky and shape', () => {      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [{ id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: 'Hi' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 66, clientY: 46 });
      fireEvent.pointerUp(svg, { clientX: 66, clientY: 46 });
      fireEvent.click(screen.getByRole('button', { name: 'Vertical alignment' }));
      const group = screen.getByRole('radiogroup', { name: 'Vertical alignment' });
      fireEvent.click(within(group).getByRole('radio', { name: 'Bottom' }));
      expect(dispatch).toHaveBeenCalledTimes(1);
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements.find((e) => e.id === 's1')).toMatchObject({ valign: 'bottom' });
    });

    it('more button opens the object menu with the right-click actions', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [{ id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: 'Hi' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 66, clientY: 46 });
      fireEvent.pointerUp(svg, { clientX: 66, clientY: 46 });
      const more = screen.getByRole('button', { name: 'Object actions' });
      fireEvent.click(more);
      const menu = screen.getByRole('menu', { name: 'Object actions' });
      expect(within(menu).getByRole('menuitem', { name: /Duplicate/ })).not.toBeNull();
      fireEvent.click(within(menu).getByRole('menuitem', { name: /Duplicate/ }));
      expect(dispatch).toHaveBeenCalledTimes(1);
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements).toHaveLength(2);
    });

    it('shows the Image7 text bar (duplicate + font + size + toggles + align) for a shape with text', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [{ id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: 'Hi' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 66, clientY: 46 });
      fireEvent.pointerUp(svg, { clientX: 66, clientY: 46 });
      expect(screen.getByRole('button', { name: 'Duplicate' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Shape type' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Fill color #6ea8fe' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Font' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Text size' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Bold' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Strikethrough' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Bulleted list' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Text alignment' })).not.toBeNull();
      // Duplicate pastes a copy with an offset.
      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
      expect(dispatch).toHaveBeenCalledTimes(1);
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements).toHaveLength(2);
    });
  });

  describe('WB-18 floating selection bar', () => {
    it('positions the bar above the selected element', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [{ id: 's1', kind: 'sticky', x: 0, y: 200, w: 100, h: 60, color: '#e8b955', text: 'A' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      // world (84,230) → client (100,246)
      fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 246 });
      fireEvent.pointerUp(svg, { clientX: 100, clientY: 246 });
      const wrap = document.querySelector('.wb-floatwrap') as HTMLElement;
      expect(wrap).not.toBeNull();
      // bbox center x=50 → screen 66; top y=200 → screen 216; above → top 216-12=204
      expect(wrap.style.left).toBe('120px');
      expect(wrap.style.top).toBe('204px');
    });
  });

  it('duplicates a marquee selection via Ctrl+C / Ctrl+V', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({
      ...BOARD,
      elements: [
        { id: 'a', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
        { id: 'b', kind: 'sticky', x: 200, y: 0, w: 100, h: 60, color: '#e8b955', text: 'B' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    // Marquee world (20,10) → (290,60): client +16.
    fireEvent.pointerDown(svg, { button: 0, clientX: 36, clientY: 26 });
    fireEvent.pointerMove(svg, { clientX: 306, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 306, clientY: 76 });
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements).toHaveLength(4);
  });

    const STICKY_L: WhiteboardElement = { id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' };

    it('renders the bottom pill toolbar with no permanent panels', () => {
      renderShell({ ...BOARD, elements: [STICKY_L] });
      const wrap = document.querySelector('.wb-main-canvas');
      expect(wrap).not.toBeNull();
      expect(wrap?.querySelector('.board-toolbar')).not.toBeNull();
      // FigJam chrome: no permanent right dock, no inspector, no layers aside.
      expect(wrap?.querySelector('.wb-dock-right')).toBeNull();
      expect(wrap?.querySelector('.wb-layers-wrap')).toBeNull();
      expect(screen.queryByRole('complementary')).toBeNull();
    });

    it('shows the floating bar only while something is selected', () => {
      renderShell({ ...BOARD, elements: [STICKY_L] });
      expect(document.querySelector('.wb-floatwrap')).toBeNull();
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
      expect(document.querySelector('.wb-floatwrap')).not.toBeNull();
      expect(screen.getByRole('group', { name: 'Selection actions' })).not.toBeNull();
    });

    it('toggles the Layers popover from the toolbar button', () => {
      renderShell({ ...BOARD, elements: [STICKY_L] });
      const toggle = screen.getByRole('button', { name: 'Layers' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByRole('listbox', { name: 'Element layers' })).toBeNull();
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('listbox', { name: 'Element layers' })).not.toBeNull();
      fireEvent.click(toggle);
      expect(screen.queryByRole('listbox', { name: 'Element layers' })).toBeNull();
    });

    it('WB-4: shows selection export items only when something is selected', () => {
      renderShell({ ...BOARD, elements: [STICKY_L] });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      fireEvent.click(screen.getByRole('button', { name: 'Export diagram' }));
      expect(screen.queryByRole('menuitem', { name: 'PNG selection' })).toBeNull();
      fireEvent.keyDown(window, { key: 'Escape' });
      // select the sticky, then reopen the menu
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
      fireEvent.click(screen.getByRole('button', { name: 'Export diagram' }));
      expect(screen.getByRole('menuitem', { name: 'PNG selection' })).not.toBeNull();
      expect(screen.getByRole('menuitem', { name: 'SVG selection' })).not.toBeNull();
    });

    it('WB-4: toggles the transparent-background checkbox', () => {
      renderShell({ ...BOARD, elements: [STICKY_L] });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      fireEvent.click(screen.getByRole('button', { name: 'Export diagram' }));
      const box = screen.getByRole('menuitemcheckbox', { name: 'Transparent background' });
      expect(box.getAttribute('aria-checked')).toBe('false');
      fireEvent.click(box);
      expect(box.getAttribute('aria-checked')).toBe('true');
    });

    it('deleting is silent (no toast, no restore button)', () => {
      function LiveShell() {
        const [elements, setElements] = useState([STICKY_L]);
        const dispatch = (action: { patch: { elements: WhiteboardElement[] } }) => {
          setElements(action.patch.elements);
        };
        useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
        return (
          <MemoryRouter>
            <WhiteboardEditorShell board={{ ...BOARD, elements }} state={makeState()} onBack={() => {}} />
          </MemoryRouter>
        );
      }
      render(<LiveShell />);
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
      fireEvent.keyDown(window, { key: 'Delete' });
      // element is gone and no toast appears (undo via Ctrl+Z still works through history).
      expect((document.querySelector('svg.wb-svg') as SVGSVGElement).textContent).toBe('');
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
      expect(screen.queryByTestId('wb-cap-toast')).toBeNull();
    });

    it('board-full feedback appears in the global toast (top-right) when paste is blocked at cap', { timeout: 60000 }, () => {
      const full = Array.from({ length: 1000 }, (_, i) => ({
        id: `e${i}`,
        kind: 'shape',
        shapeType: 'rect',
        x: (i % 40) * 120,
        y: Math.floor(i / 40) * 100,
        w: 100,
        h: 60,
        color: '#6ea8fe',
        fill: false,
        strokeWidth: 2,
        label: '',
      })) as WhiteboardElement[];
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({ ...BOARD, elements: full });
      // permanent cap banner is still there
      expect(screen.getByRole('alert').textContent).toContain('Element limit reached');
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
      fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
      fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
      // paste blocked -> transient global toast, nothing dispatched
      expect(dispatch).not.toHaveBeenCalled();
      const toast = screen.getByTestId('wb-cap-toast');
      expect(toast.textContent).toContain('Element limit reached');
    });

    it('WB-9: match width resizes the selection to the last selected element', () => {
      const dispatch = vi.fn();
      useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
      renderShell({
        ...BOARD,
        elements: [
          { id: 'a', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' },
          { id: 'b', kind: 'shape', shapeType: 'rect', x: 200, y: 0, w: 150, h: 80, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '' },
        ],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      // marquee over both shapes (world -20..390 x, -20..100 y)
      fireEvent.pointerDown(svg, { button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(svg, { clientX: 406, clientY: 116 });
      fireEvent.pointerUp(svg, { clientX: 406, clientY: 116 });
      fireEvent.click(screen.getByRole('button', { name: 'Match width to last selected' }));
      expect(dispatch).toHaveBeenCalledTimes(1);
      const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
      expect(action.patch.elements.find((e) => e.id === 'a')).toMatchObject({ w: 150, h: 60 });
      expect(action.patch.elements.find((e) => e.id === 'b')).toMatchObject({ w: 150, h: 80 });
    });
});

describe('whiteboard editor shell mobile', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('640px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('renders the sketch chrome: slim topbar, TL undo/redo, TR more, bottom pill with hand', () => {
    renderShell(BOARD);
    // Slim topbar stays on mobile: back + name + icon-only Canvas, no desktop corners.
    const topbar = document.querySelector('.wb-topbar')!;
    expect(topbar).not.toBeNull();
    expect(topbar.querySelector('.back-btn')).not.toBeNull();
    expect(topbar.textContent).toContain('Plan');
    expect(document.querySelector('.wb-corner-tl')).toBeNull();
    expect(document.querySelector('.wb-corner-tr')).toBeNull();
    // TL pill: undo + redo only (no back).
    const tl = document.querySelector('.wb-mobile-tl')!;
    expect(tl).not.toBeNull();
    expect(tl.querySelectorAll('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Undo/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Redo/ })).toBeTruthy();
    // TR pill: more only (no initials, no X in normal mode).
    const tr = document.querySelector('.wb-mobile-tr')!;
    expect(tr).not.toBeNull();
    expect(tr.querySelectorAll('button')).toHaveLength(1);
    expect(within(tr as HTMLElement).getByRole('button', { name: 'More tools' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to boards' })).not.toBeNull();
    // Bottom pill: select/pen/shape/view + more, text lives in ⋯.
    const pill = document.querySelector('.board-toolbar .wb-mobile-pill')!;
    const labels = [...pill.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(labels.some((l) => l && /Select —/.test(l))).toBe(true);
    expect(labels.some((l) => l && /Pen —/.test(l))).toBe(true);
    expect(labels.some((l) => l && /Shape —/.test(l))).toBe(true);
    expect(labels.some((l) => l && /View/.test(l))).toBe(true);
    expect(labels.some((l) => l && /Text —/.test(l))).toBe(false);
    expect(document.querySelector('.wb-tool-actions')).toBeNull();
    expect(document.querySelector('.wb-dock-right')).toBeNull();
  });

  it('defaults to the select tool in all modes', () => {
    renderShell(BOARD);
    expect(screen.getByRole('button', { name: /Select —/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Pen —/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('reveals secondary tools (incl. text and snap) in the more menu and picks on tap', () => {
    renderShell(BOARD);
    const pill = document.querySelector('.board-toolbar .wb-mobile-pill')!;
    fireEvent.click(within(pill as HTMLElement).getByRole('button', { name: 'More tools' }));
    const sticky = screen.getByRole('button', { name: /Sticky note —/ });
    expect(sticky.closest('.wb-more-menu')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Text —/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Snap/ })).toBeTruthy();
    fireEvent.click(sticky);
    expect(document.querySelector('.wb-more-menu')).toBeNull();
  });

  it('swaps to delete+X and hides the main pill when something is selected', () => {
    renderShell({
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' }],
    });
    expect(document.querySelector('.wb-mobile-pill')).not.toBeNull();
    expect(document.querySelector('.wb-mobile-tl')).not.toBeNull();
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 60 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 60 });
    // Main pill + TL pill gone; TR shows trash only (no back in normal mode).
    expect(document.querySelector('.wb-mobile-pill')).toBeNull();
    expect(document.querySelector('.wb-mobile-tl')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete selected' })).not.toBeNull();
    // Floating bar is rendered for the selection (bottom-anchored via CSS).
    expect(document.querySelector('.wb-floatwrap')).not.toBeNull();
  });

  it('deletes via the TR trash button', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' }],
    });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 60 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 60 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: 'whiteboard/update',
      patch: { elements: [] },
    });
  });

  it('shows all props inline with a more button opening the actions sheet', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({
      ...BOARD,
      elements: [{ id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: 'Hi' }],
    });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 66, clientY: 46 });
    fireEvent.pointerUp(svg, { clientX: 66, clientY: 46 });
    const bar = document.querySelector('.wb-selection-bar[aria-label="Selection actions"]')!;
    // All property controls inline (no 4-item cap) + ⋮ (object-actions ⋮ hidden on mobile).
    expect(bar.querySelectorAll('button').length).toBeGreaterThan(5);
    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Object actions' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
    // Sheet holds actions, not leftover property controls.
    const sheet = screen.getByRole('dialog', { name: 'More tools' });
    expect(within(sheet).getByRole('button', { name: 'Bring to front' })).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Bold' })).toBeNull();
  });

  it('opens present/export from the TR more menu (no layers on mobile)', () => {
    renderShell(BOARD);
    const tr = document.querySelector('.wb-mobile-tr')!;
    fireEvent.click(within(tr as HTMLElement).getByRole('button', { name: 'More tools' }));
    const menu = document.querySelector('.wb-mobile-trmenu')!;
    expect(menu).not.toBeNull();
    expect(menu.querySelector('[aria-label="Present board"]')).not.toBeNull();
    expect(menu.querySelector('[aria-label="Export diagram"]')).not.toBeNull();
    expect(menu.querySelector('[aria-label="Layers"]')).toBeNull();
  });

  it('shows TL undo/redo and TR menu, no props panel with no selection', () => {
    renderShell(BOARD);
    const tl = document.querySelector('.wb-mobile-tl')!;
    expect(tl.querySelectorAll('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Undo/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Redo/ })).toBeTruthy();
    expect(document.querySelector('.wb-mobile-tr')).not.toBeNull();
    expect(document.querySelector('.wb-mobile-props')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('has no layers entry in the mobile TR menu (layers popover is desktop-only)', () => {
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' }],
    };
    renderShell(board);
    const tr = document.querySelector('.wb-mobile-tr')!;
    fireEvent.click(within(tr as HTMLElement).getByRole('button', { name: 'More tools' }));
    expect(document.querySelector('.wb-mobile-trmenu [aria-label="Layers"]')).toBeNull();
    expect(document.querySelector('.wb-layers-pop')).toBeNull();
  });

  it('deletes the selection from the long-press object menu on mobile', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    const board: Whiteboard = {
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' }],
    };
    try {
      vi.useFakeTimers();
      renderShell(board);
      const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
      fireEvent.pointerDown(svg, { button: 0, pointerType: 'touch', clientX: 100, clientY: 60 });
      fireEvent.pointerUp(svg, { clientX: 100, clientY: 60 });
      fireEvent.pointerDown(svg, { button: 0, pointerType: 'touch', clientX: 100, clientY: 60 });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByRole('menu', { name: 'Object actions' })).toBeTruthy();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete selected Del' }));
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0]![0]).toMatchObject({
        type: 'whiteboard/update',
        patch: { elements: [] },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('whiteboard figjam interactions', () => {
  const STICKY_A: WhiteboardElement = { id: 'a', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' };

  function selectFirst(svg: SVGSVGElement) {
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
  }

  it('shows four corner handles and four port dots for a selected shape', () => {
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
    renderShell({ ...BOARD, elements: [STICKY_A] });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    expect(document.querySelectorAll('[data-testid="wb-resize-handle"]')).toHaveLength(0);
    selectFirst(svg);
    expect(document.querySelectorAll('[data-testid="wb-resize-handle"]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-testid="wb-port-handle"]')).toHaveLength(4);
  });

  it('resizes from the north-west corner, moving x/y', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({ ...BOARD, elements: [STICKY_A] });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    selectFirst(svg);
    // NW corner world (0,0) → client (16,16); drag to (56,46): world (40,30).
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 56, clientY: 46 });
    expect(document.querySelector('[data-testid="wb-resize-preview"]')).not.toBeNull();
    fireEvent.pointerUp(svg, { clientX: 56, clientY: 46 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    // snap(100-40)=snap(60)=64? radius 8: |60-64|=4 → 64; x=100-64=36. snap(60-30)=snap(30)=32? |30-32|=2 → 32; y=60-32=28.
    expect(action.patch.elements.find((e) => e.id === 'a')).toMatchObject({ x: 36, y: 28, w: 64, h: 32 });
  });

  it('opens the object menu on right-click and deletes via the menu', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({ ...BOARD, elements: [STICKY_A] });
    const canvas = document.querySelector('.wb-canvas') as HTMLElement;
    fireEvent.contextMenu(canvas, { clientX: 20, clientY: 20 });
    const menu = screen.getByRole('menu', { name: 'Object actions' });
    expect(within(menu).getByRole('menuitem', { name: 'Copy Ctrl+C' })).not.toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Paste to replace Ctrl+Shift+V' })).not.toBeNull();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete selected Del' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: 'whiteboard/update', patch: { elements: [] } });
  });

  it('replaces the selection with the clipboard via Ctrl+Shift+V (Ctrl+Shift+R alias)', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({ ...BOARD, elements: [STICKY_A] });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    selectFirst(svg);
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'V', ctrlKey: true, shiftKey: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements).toHaveLength(1);
    expect(action.patch.elements[0]).toMatchObject({ kind: 'sticky', x: 0, y: 0 });
    expect((action.patch.elements[0] as { id: string }).id).not.toBe('a');
  });

  it('cuts the selection via Ctrl+X (copy + delete)', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({ ...BOARD, elements: [STICKY_A] });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    selectFirst(svg);
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements).toHaveLength(0);
  });

  it('groups and ungroups via Ctrl+G / Ctrl+Shift+G', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({
      ...BOARD,
      elements: [
        STICKY_A,
        { id: 'b', kind: 'sticky', x: 200, y: 0, w: 100, h: 60, color: '#e8b955', text: 'B' },
      ],
    });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement | null;
    expect(svg).not.toBeNull();
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const grouped = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    const gid = (grouped.patch.elements[0] as { groupId: string }).groupId;
    expect(gid).toBeTruthy();
    expect((grouped.patch.elements[1] as { groupId: string }).groupId).toBe(gid);
  });

  it('nudges 1px with arrows and 10px with Shift+arrows', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({ ...BOARD, elements: [STICKY_A] });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    selectFirst(svg);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    expect(dispatch).toHaveBeenCalledTimes(2);
    const first = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(first.patch.elements.find((e) => e.id === 'a')).toMatchObject({ x: 1 });
    const second = dispatch.mock.calls[1]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(second.patch.elements.find((e) => e.id === 'a')).toMatchObject({ x: 10 });
  });

  it('opens the shortcuts dialog with ? and closes it', () => {
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
    renderShell(BOARD);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeNull();
    expect(screen.getByText('Tools')).not.toBeNull();
    expect(screen.getByText('Undo (Ctrl+Z)')).not.toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
  });

  it('opens the shortcuts dialog in canvas fullscreen and Esc closes the dialog first', () => {
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen — F' }));
    const shell = document.querySelector('.wb-shell') as HTMLElement;
    expect(shell.classList.contains('wb-fullscreen')).toBe(true);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeNull();
    // Esc closes the dialog but stays in fullscreen
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    expect(shell.classList.contains('wb-fullscreen')).toBe(true);
  });

  it('opens the shortcuts dialog in present mode via ?', () => {
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Present board' }));
    const shell = document.querySelector('.wb-shell') as HTMLElement;
    expect(shell.classList.contains('wb-presenting')).toBe(true);
    // zoom chrome (incl. the help button) is hidden in presentation
    expect(document.querySelector('.erd-zoom')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keyboard shortcuts' })).toBeNull();
    // ? opens it while presenting
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeNull();
    // Esc closes the dialog but stays in presentation
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    expect(shell.classList.contains('wb-presenting')).toBe(true);
  });

  it('inline shape editor stays vertically centered and grows with wrapped text', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    const diamond = {
      id: 'd1',
      kind: 'shape',
      shapeType: 'diamond',
      x: 0,
      y: 0,
      w: 200,
      h: 160,
      color: '#6ea8fe',
      fill: false,
      strokeWidth: 2,
      label: 'Hi',
    } as WhiteboardElement;
    renderShell({ ...BOARD, elements: [diamond] });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    // select the diamond via its center: world (100,80) -> client (116,96)
    fireEvent.pointerDown(svg, { button: 0, clientX: 116, clientY: 96 });
    fireEvent.pointerUp(svg, { clientX: 116, clientY: 96 });
    // Enter starts inline editing
    fireEvent.keyDown(document.querySelector('.wb-canvas') as HTMLElement, { key: 'Enter' });
    const box = document.querySelector('textarea.wb-textedit') as HTMLTextAreaElement;
    expect(box).not.toBeNull();
    expect(box.value).toBe('Hi');
    // shape center in screen px: world y 80 at scale 1 with the default (16,16) pan
    const centerY = 80 + 16;
    const top = parseFloat(box.style.top);
    const height = parseFloat(box.style.height);
    // overlay is centered on the shape — not pinned to its top edge (old: 16px)
    expect(Math.abs(top + height / 2 - centerY)).toBeLessThanOrEqual(2);
    // typing a long label wraps and grows the box instead of clipping
    fireEvent.change(box, { target: { value: `a${'a'.repeat(119)}` } });
    const grown = document.querySelector('textarea.wb-textedit') as HTMLTextAreaElement;
    const grownHeight = parseFloat(grown.style.height);
    expect(grownHeight).toBeGreaterThan(height);
    expect(Number(grown.getAttribute('rows'))).toBeGreaterThan(1);
    // legacy (valign null) pins the first line at the vertical center like the
    // committed render does — typing more lines extends downward, first line unmoved
    expect(grown.style.top).toBe(box.style.top);
    // nothing committed while typing
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('inline editor keeps the true font size instead of flooring to 8px', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    const tiny: WhiteboardElement = { id: 't1', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'Hi', fontSize: 4 };
    renderShell({ ...BOARD, elements: [tiny] });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    fireEvent.keyDown(document.querySelector('.wb-canvas') as HTMLElement, { key: 'Enter' });
    const box = document.querySelector('textarea.wb-textedit') as HTMLTextAreaElement;
    expect(box).not.toBeNull();
    // committed render shows 4px — the editor must match, not jump to 8px
    expect(box.style.fontSize).toBe('4px');
  });

  it('paints ref cards with per-entity accents instead of all blue', () => {
    const state: State = {
      ...makeState(),
      tasks: [
        { id: 't1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', title: 'Ship it', status: 'todo', priority: 'medium', labels: [], blockedBy: [], description: '' },
      ],
      issues: [
        { id: 'i1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', title: 'Flaky test', severity: 'high', status: 'open', description: '', reproduction: '' },
      ],
    };
    useProjectMock.mockReturnValue({ state, role: 'owner', canEdit: true, dispatch: vi.fn() });
    render(
      <MemoryRouter>
        <WhiteboardEditorShell
          board={{
            ...BOARD,
            elements: [
              { id: 'r1', kind: 'ref', entity: 'tasks', entityId: 't1', x: 0, y: 0 },
              { id: 'r2', kind: 'ref', entity: 'issues', entityId: 'i1', x: 300, y: 0 },
            ],
          }}
          state={state}
          onBack={() => {}}
        />
      </MemoryRouter>,
    );
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    // both cards resolved live (titles rendered, not the missing placeholder)
    expect(svg.textContent).toContain('Ship it');
    expect(svg.textContent).toContain('Flaky test');
    const strokes = Array.from(svg.querySelectorAll('rect')).map((r) => r.getAttribute('stroke'));
    expect(strokes).toContain('#6ea8fe');
    expect(strokes).toContain('#f2555a');
    // card content is clipped to the card bounds so long text can't spill out
    const clips = Array.from(svg.querySelectorAll('clipPath')).map((c) => c.getAttribute('id'));
    expect(clips).toEqual(expect.arrayContaining(['wb-refclip-r1', 'wb-refclip-r2']));
    expect(svg.querySelector('g[clip-path]')).not.toBeNull();
  });

  it('bulk-recolors a multi-selection via the fill dot and color panel', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({
      ...BOARD,
      elements: [
        STICKY_A,
        { id: 'b', kind: 'sticky', x: 200, y: 0, w: 100, h: 60, color: '#e8b955', text: 'B' },
      ],
    });
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Fill color #e8b955' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill color #6ea8fe' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements.filter((e) => e.color === '#6ea8fe')).toHaveLength(2);
  });

  it('opens More shapes with 8 tabs and places a library triangle', () => {
    localStorage.clear();
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Shape — S' }));
    fireEvent.click(screen.getByRole('button', { name: 'More shapes' }));
    const dialog = screen.getByRole('dialog', { name: 'More shapes' });
    expect(within(dialog).getAllByRole('button', { name: /Basic|Flowchart|BPMN|UML|ERD|Data flow|Network|K8s/ })).toHaveLength(8);
    fireEvent.click(within(dialog).getByRole('option', { name: 'Triangle' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100 });
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements[0]).toMatchObject({ kind: 'shape', shapeType: 'triangleUp' });
  });

  it('shows ref picker tabs with All active and a Create-new action', () => {    localStorage.clear();
    useProjectMock.mockReturnValue({
      state: {
        tasks: [{ id: 't1', title: 'Build login', status: 'todo' }],
        issues: [],
      },
      role: 'owner',
      canEdit: true,
      dispatch: vi.fn(),
    });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Entity ref card — D' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 120 });
    const dialog = screen.getByRole('dialog', { name: 'Link an entity' });
    expect(within(dialog).getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByRole('button', { name: /Create new/ })).not.toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Task' }));
    expect(within(dialog).getByRole('option', { name: /Build login/ })).not.toBeNull();
  });

  it('shows the text bar (font + size + toggles + align) when clicking a sticky text area', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({
      ...BOARD,
      elements: [{ id: 'a', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'Hi' }],
    });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    // World (100,60) → client (116,76): inside the text block.
    fireEvent.pointerDown(svg, { button: 0, clientX: 116, clientY: 76 });
    fireEvent.pointerUp(svg, { clientX: 116, clientY: 76 });
    expect(screen.getByRole('button', { name: 'Font' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Text size' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Bold' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Strikethrough' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Bulleted list' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Text alignment' })).not.toBeNull();
    // Alignment lives in a popup now (P4).
    fireEvent.click(screen.getByRole('button', { name: 'Text alignment' }));
    expect(screen.getByRole('radiogroup', { name: 'Text alignment' })).not.toBeNull();
    // Sticky keeps its fill dot next to the text controls.
    expect(screen.getByRole('button', { name: 'Fill color #e8b955' })).not.toBeNull();
    // Size dropdown offers presets; Medium sets 24.
    fireEvent.click(screen.getByRole('button', { name: 'Text size' }));
    const sizeDialog = screen.getByRole('dialog', { name: 'Text size' });
    fireEvent.click(within(sizeDialog).getByRole('radio', { name: /Medium/ }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements.find((e) => e.id === 'a')).toMatchObject({ fontSize: 24 });
  });

  it('P7: pointerdown on a color swatch does not close the panel before click commits', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell({
      ...BOARD,
      elements: [{ id: 's1', kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'Hi' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select — V' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    // Border click → element bar with the fill dot.
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Fill color #e8b955' }));
    const panel = screen.getByRole('dialog', { name: 'Fill color' });
    const swatch = within(panel).getByRole('button', { name: 'Fill color #f4706d' });
    // Real browsers fire pointerdown before click; closed sibling dropdowns
    // must not steal it and unmount the panel.
    fireEvent.pointerDown(swatch);
    expect(screen.getByRole('dialog', { name: 'Fill color' })).not.toBeNull();
    fireEvent.click(swatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const pick = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(pick.patch.elements.find((e) => e.id === 's1')).toMatchObject({ color: '#f4706d' });
  });

  it('changes the pen default from the toolbar strip and places with it', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Pen — P' }));
    const strip = document.querySelector('.board-toolbar .wb-shape-strip') as HTMLElement;
    expect(strip).not.toBeNull();
    fireEvent.click(within(strip).getByRole('button', { name: 'Fill color #f4706d' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(svg, { clientX: 40, clientY: 50 });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(svg, { clientX: 60, clientY: 70 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements[0]).toMatchObject({ kind: 'stroke', color: '#f4706d' });
  });

  it('Q4: sets pen width from the strip slider popup', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Pen — P' }));
    const strip = document.querySelector('.board-toolbar .wb-shape-strip') as HTMLElement;
    fireEvent.click(within(strip).getByRole('button', { name: 'Width' }));
    // Portal popup lives on document.body, outside the strip.
    const dialog = screen.getByRole('dialog', { name: 'Width' });
    fireEvent.change(within(dialog).getByRole('slider', { name: 'Width' }), { target: { value: '6' } });
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(svg, { clientX: 40, clientY: 50 });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(svg, { clientX: 60, clientY: 70 });
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements[0]).toMatchObject({ kind: 'stroke', width: 6 });
  });

  it('Q5: text strip mirrors the bar controls and applies to placement', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Text — T' }));
    const strip = document.querySelector('.board-toolbar .wb-shape-strip') as HTMLElement;
    expect(within(strip).getByRole('button', { name: 'Font' })).not.toBeNull();
    expect(within(strip).getByRole('button', { name: 'Text size' })).not.toBeNull();
    expect(within(strip).getByRole('button', { name: 'Bold' })).not.toBeNull();
    expect(within(strip).getByRole('button', { name: 'Text alignment' })).not.toBeNull();
    // no stepper / inline align in the text strip anymore
    expect(within(strip).queryByRole('button', { name: 'Decrease font size' })).toBeNull();
    fireEvent.click(within(strip).getByRole('button', { name: 'Bold' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100 });
    const action = dispatch.mock.calls[0]![0] as { patch: { elements: Array<Record<string, unknown>> } };
    expect(action.patch.elements[0]).toMatchObject({ kind: 'text', bold: true, fontFamily: 'simple' });
  });

  it('Q6/Q7: boundary strip is dots-only, edge strip has no arrow button', () => {
    useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
    renderShell(BOARD);
    fireEvent.click(screen.getByRole('button', { name: 'Boundary — B' }));
    let strip = document.querySelector('.board-toolbar .wb-shape-strip') as HTMLElement;
    expect(within(strip).getAllByRole('button').length).toBeGreaterThan(0);
    expect(within(strip).queryByRole('button', { name: 'Text size' })).toBeNull();
    expect(within(strip).queryByRole('radiogroup', { name: 'Text alignment' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edge — L' }));
    strip = document.querySelector('.board-toolbar .wb-shape-strip') as HTMLElement;
    expect(within(strip).queryByRole('button', { name: 'Arrow style' })).toBeNull();
    expect(within(strip).getByRole('button', { name: 'Text size' })).not.toBeNull();
  });
});