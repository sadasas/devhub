import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefObject } from 'react';
import { ERD, viewportCenterWorld, type ERDViewportHandle } from './ERD';
import { NewTableModal } from './NewTableModal';
import { api } from '../../lib/api';
import type { Relation, State, Table } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function makeTable(over: Partial<Table> = {}): Table {
  return {
    id: 'tb1',
    name: 'users',
    comment: '',
    columns: [],
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function makeRelation(over: Partial<Relation> = {}): Relation {
  return {
    id: 'r1',
    fromTableId: 'tb1',
    fromColumnId: 'c1',
    toTableId: 'tb2',
    toColumnId: 'c2',
    cardinality: '1:N',
    onDelete: 'cascade',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function makeState(): State {
  const tb1 = makeTable({
    id: 'tb1',
    name: 'users',
    columns: [{ id: 'c1', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' }],
  });
  const tb2 = makeTable({
    id: 'tb2',
    name: 'projects',
    columns: [{ id: 'c2', name: 'user_id', type: 'uuid', nullable: true, primaryKey: false, default: null, comment: '' }],
  });
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [tb1, tb2],
    relations: [makeRelation()],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

function svgEl(): SVGSVGElement {
  const svg = document.querySelector('.erd-canvas svg');
  if (!svg) throw new Error('ERD svg not found');
  return svg as SVGSVGElement;
}

function renderModal(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('U2 ERD canvas create placement', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    vi.restoreAllMocks();
  });

  it('viewportCenterWorld: ((w/2−x)/s, (h/2−y)/s) with 1-decimal rounding', () => {
    expect(viewportCenterWorld({ x: 16, y: 16, s: 1 }, 800, 600)).toEqual({ x: 384, y: 284 });
    expect(viewportCenterWorld({ x: 100, y: 50, s: 2 }, 800, 600)).toEqual({ x: 150, y: 125 });
    // 50/3 = 16.666… → 16.7
    expect(viewportCenterWorld({ x: 0, y: 0, s: 3 }, 100, 100)).toEqual({ x: 16.7, y: 16.7 });
  });

  it('viewportRef: [+ Table] can read the live center on demand (view stays uncontrolled)', () => {
    render(<ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} />);
    const ref = { current: null } as RefObject<ERDViewportHandle | null>;
    render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} viewportRef={ref} />,
    );
    // jsdom has no layout → 800×480 fallback, view (16,16,s=1).
    expect(ref.current?.getViewportCenterWorld()).toEqual({ x: 384, y: 224 });
  });

  it('NewTableModal with initialPosition: table/add + erdLayout/set, persist via queue (no direct PATCH)', () => {
    const mockDispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: { ...makeState(), erdLayout: { tb1: { x: 10, y: 10 } } },
      projectId: 'p1',
      dispatch: mockDispatch,
      setStatus: vi.fn(),
    });
    const patchSpy = vi.spyOn(api, 'patchErdLayout').mockResolvedValue({ ok: true, version: 2 });
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderModal(
      <NewTableModal open initialPosition={{ x: 384.44, y: 284.44 }} onCreated={onCreated} onClose={onClose} />,
    );
    fireEvent.change(screen.getByPlaceholderText('users'), { target: { value: 'orders' } });
    fireEvent.click(screen.getByRole('button', { name: /Create table|Buat tabel/i }));

    const addCall = mockDispatch.mock.calls.find((c) => c[0]?.type === 'table/add');
    expect(addCall?.[0]?.table).toMatchObject({ name: 'orders' });
    const newId = addCall?.[0]?.table?.id as string;
    expect(typeof newId).toBe('string');

    // Rounded to 1 decimal, keyed by the NEW id. Persist goes through the
    // queued mutation pipeline (whiteboard-style) — no side-channel PATCH.
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'erdLayout/set',
      tableId: newId,
      pos: { x: 384.4, y: 284.4 },
    });
    expect(patchSpy).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(newId, 'orders');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('NewTableModal without initialPosition: grid fallback — no layout write, no persist', () => {
    const mockDispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: makeState(),
      projectId: 'p1',
      dispatch: mockDispatch,
      setStatus: vi.fn(),
    });
    const patchSpy = vi.spyOn(api, 'patchErdLayout').mockResolvedValue({ ok: true, version: 2 });
    const onCreated = vi.fn();
    renderModal(<NewTableModal open onCreated={onCreated} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('users'), { target: { value: 'plain' } });
    fireEvent.click(screen.getByRole('button', { name: /Create table|Buat tabel/i }));

    expect(mockDispatch.mock.calls.filter((c) => c[0]?.type === 'table/add')).toHaveLength(1);
    expect(mockDispatch.mock.calls.some((c) => c[0]?.type === 'erdLayout/set')).toBe(false);
    expect(patchSpy).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('canvas dblclick empty opens at click world point; dblclick node/line does not', () => {
    const onEmpty = vi.fn();
    const onOpen = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={() => {}}
        onOpenTable={onOpen}
        onDoubleClickEmpty={onEmpty}
      />,
    );
    const svg = svgEl();
    // jsdom rect is 0,0 — client (700,500) with view (16,16,s=1) → world (684,484), empty.
    fireEvent.doubleClick(svg, { clientX: 700, clientY: 500 });
    expect(onEmpty).toHaveBeenCalledTimes(1);
    expect(onEmpty.mock.calls[0]?.[0]).toEqual({ x: 684, y: 484 });
    expect(onOpen).not.toHaveBeenCalled();

    // Node dblclick opens the table instead (existing behaviour, no empty placement).
    fireEvent.doubleClick(screen.getByRole('button', { name: /Table users/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]).toBe('tb1');
    expect(onEmpty).toHaveBeenCalledTimes(1);

    // Relation line dblclick is not empty background either.
    fireEvent.doubleClick(screen.getByRole('button', { name: /users\.id to projects\.user_id/i }));
    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  it('plain ERD tab (no onDoubleClickEmpty): dblclick empty is a no-op', () => {
    const onOpen = vi.fn();
    render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onOpenTable={onOpen} />,
    );
    fireEvent.doubleClick(svgEl(), { clientX: 700, clientY: 500 });
    // No handler wired → nothing fires, and node dblclick still opens.
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByRole('button', { name: /Table users/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('readOnly: dblclick empty and dblclick node are both no-ops', () => {
    const onEmpty = vi.fn();
    const onOpen = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        readOnly
        onMoveTable={() => {}}
        onOpenTable={onOpen}
        onDoubleClickEmpty={onEmpty}
      />,
    );
    fireEvent.doubleClick(svgEl(), { clientX: 700, clientY: 500 });
    expect(onEmpty).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByRole('button', { name: /Table users/i }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(onEmpty).not.toHaveBeenCalled();
  });
});
