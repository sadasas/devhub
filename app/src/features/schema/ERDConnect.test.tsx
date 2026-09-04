import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERD } from './ERD';
import { NewRelationModal } from './NewRelationModal';
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

// Layout math (view 16,16 s=1, jsdom rect 0,0 → client = world + 16):
// tb1 @ (16,16): c1 rowCenter y=56, c3 rowCenter y=76; right edge x=224.
// tb2 @ (272,16): c2 rowCenter y=56; rows span x 272..480.
const TB1_C3_RIGHT = { x: 240, y: 92 }; // world (224,76) — users.role_id right handle
const TB1_C1_RIGHT = { x: 240, y: 72 }; // world (224,56) — users.id right handle
const TB2_ROW = { x: 300, y: 72 }; // world (284,56) — inside projects.user_id row
const EMPTY_PT = { x: 700, y: 500 }; // world (684,484) — empty canvas

function makeState(): State {
  const tb1 = makeTable({
    id: 'tb1',
    name: 'users',
    columns: [
      { id: 'c1', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' },
      { id: 'c3', name: 'role_id', type: 'uuid', nullable: true, primaryKey: false, default: null, comment: '' },
    ],
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

function modalState() {
  return {
    ...makeState(),
    tables: [
      makeTable({
        id: 'tb1',
        name: 'users',
        columns: [
          { id: 'c1', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' },
          { id: 'c3', name: 'role_id', type: 'uuid', nullable: true, primaryKey: false, default: null, comment: '' },
        ],
      }),
      makeTable({
        id: 'tb2',
        name: 'projects',
        columns: [{ id: 'c2', name: 'user_id', type: 'uuid', nullable: true, primaryKey: false, default: null, comment: '' }],
      }),
    ],
  };
}

describe('U3 ERD connect-drag (handle → column row)', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
  });

  it('handles render per row edge with role=button labels, hidden in readOnly', () => {
    const onConnect = vi.fn();
    const { unmount } = render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onConnectColumns={onConnect} />,
    );
    // 3 column rows × left/right = 6 handles.
    expect(screen.getAllByRole('button', { name: /Connect from /i })).toHaveLength(6);
    expect(
      screen.getAllByRole('button', { name: 'Connect from users.role_id' }),
    ).toHaveLength(2);
    unmount();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        readOnly
        onConnectColumns={onConnect}
      />,
    );
    expect(screen.queryAllByRole('button', { name: /Connect from /i })).toHaveLength(0);
  });

  it('drag from handle to another row commits onConnectColumns + shows a live temp line', () => {
    const onConnect = vi.fn();
    const { container } = render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onConnectColumns={onConnect} />,
    );
    const svg = svgEl();
    fireEvent.pointerDown(svg, { button: 0, clientX: TB1_C3_RIGHT.x, clientY: TB1_C3_RIGHT.y, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 320, clientY: 90, pointerId: 1 });
    expect(container.querySelector('.erd-connect-temp line.erd-rel-line')).toBeTruthy();
    fireEvent.pointerUp(svg, { clientX: TB2_ROW.x, clientY: TB2_ROW.y, pointerId: 1 });
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith({
      fromTableId: 'tb1',
      fromColumnId: 'c3',
      toTableId: 'tb2',
      toColumnId: 'c2',
    });
    expect(container.querySelector('.erd-connect-temp')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pointerdown directly on the handle element starts connect mode (node locked)', () => {
    const onConnect = vi.fn();
    const onMove = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onConnectColumns={onConnect}
      />,
    );
    const handle = document.querySelector('[data-handle="tb1:c3:right"]');
    if (!handle) throw new Error('right handle for tb1.c3 not found');
    fireEvent.pointerDown(handle, { button: 0, clientX: TB1_C3_RIGHT.x, clientY: TB1_C3_RIGHT.y, pointerId: 7 });
    const svg = svgEl();
    fireEvent.pointerMove(svg, { clientX: TB2_ROW.x, clientY: TB2_ROW.y, pointerId: 7 });
    fireEvent.pointerUp(svg, { clientX: TB2_ROW.x, clientY: TB2_ROW.y, pointerId: 7 });
    expect(onConnect).toHaveBeenCalledWith({
      fromTableId: 'tb1',
      fromColumnId: 'c3',
      toTableId: 'tb2',
      toColumnId: 'c2',
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('invalid drop (empty space / self column) cancels silently with an announcement', () => {
    const onConnect = vi.fn();
    render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onConnectColumns={onConnect} />,
    );
    const svg = svgEl();
    // Empty-space drop.
    fireEvent.pointerDown(svg, { button: 0, clientX: TB1_C1_RIGHT.x, clientY: TB1_C1_RIGHT.y, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: EMPTY_PT.x, clientY: EMPTY_PT.y, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: EMPTY_PT.x, clientY: EMPTY_PT.y, pointerId: 1 });
    expect(onConnect).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/Connection cancelled/i);

    // Self-drop on the exact same column.
    fireEvent.pointerDown(svg, { button: 0, clientX: TB1_C1_RIGHT.x, clientY: TB1_C1_RIGHT.y, pointerId: 2 });
    fireEvent.pointerMove(svg, { clientX: 260, clientY: 90, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: TB1_C1_RIGHT.x, clientY: TB1_C1_RIGHT.y, pointerId: 2 });
    expect(onConnect).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/Connection cancelled/i);
  });

  it('lines passed during connect do not select relation (suppress + recovery, ronde 4 tanpa popover)', async () => {
    const onConnect = vi.fn();
    const onSelectRelation = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onConnectColumns={onConnect}
        onSelectRelation={onSelectRelation}
        onSelectTable={() => {}}
      />,
    );
    const svg = svgEl();
    fireEvent.pointerDown(svg, { button: 0, clientX: TB1_C3_RIGHT.x, clientY: TB1_C3_RIGHT.y, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: TB2_ROW.x, clientY: TB2_ROW.y, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: TB2_ROW.x, clientY: TB2_ROW.y, pointerId: 1 });
    expect(onConnect).toHaveBeenCalledTimes(1);
    const line = screen.getByRole('button', { name: /users\.id to projects\.user_id/i });
    fireEvent.click(line);
    // Ronde 4: connect-drag suppress mengkonsumsi klik pertama, tanpa popover.
    expect(screen.queryByRole('dialog')).toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    fireEvent.click(line);
    // Klik kedua setelah recovery melift seleksi (tanpa popover).
    expect(onSelectRelation).toHaveBeenCalledWith('r1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tap-tap fallback: handle tap arms a pending source, next row tap commits', () => {
    const onConnect = vi.fn();
    render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onConnectColumns={onConnect} />,
    );
    const svg = svgEl();
    fireEvent.pointerDown(svg, { button: 0, clientX: TB1_C3_RIGHT.x, clientY: TB1_C3_RIGHT.y, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: TB1_C3_RIGHT.x, clientY: TB1_C3_RIGHT.y, pointerId: 1 });
    expect(onConnect).not.toHaveBeenCalled();
    expect(document.querySelector('[data-handle="tb1:c3:right"]')?.getAttribute('data-armed')).toBe('true');
    expect(screen.getByRole('status').textContent).toMatch(/role_id/i);
    // Second tap on another row body (node hit path) commits pending → target.
    fireEvent.pointerDown(svg, { button: 0, clientX: TB2_ROW.x, clientY: TB2_ROW.y, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: TB2_ROW.x, clientY: TB2_ROW.y, pointerId: 2 });
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith({
      fromTableId: 'tb1',
      fromColumnId: 'c3',
      toTableId: 'tb2',
      toColumnId: 'c2',
    });
  });

  it('tap-tap cancel: empty tap and Escape abort the armed source with an announcement', () => {
    const onConnect = vi.fn();
    render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onConnectColumns={onConnect} />,
    );
    const svg = svgEl();
    // Arm, then tap empty canvas.
    fireEvent.pointerDown(svg, { button: 0, clientX: TB1_C1_RIGHT.x, clientY: TB1_C1_RIGHT.y, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: TB1_C1_RIGHT.x, clientY: TB1_C1_RIGHT.y, pointerId: 1 });
    expect(document.querySelector('[data-armed="true"]')).toBeTruthy();
    fireEvent.pointerDown(svg, { button: 0, clientX: EMPTY_PT.x, clientY: EMPTY_PT.y, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: EMPTY_PT.x, clientY: EMPTY_PT.y, pointerId: 2 });
    expect(onConnect).not.toHaveBeenCalled();
    expect(document.querySelector('[data-armed="true"]')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/Connection cancelled/i);
    // Arm again, then Escape.
    fireEvent.pointerDown(svg, { button: 0, clientX: TB1_C1_RIGHT.x, clientY: TB1_C1_RIGHT.y, pointerId: 3 });
    fireEvent.pointerUp(svg, { clientX: TB1_C1_RIGHT.x, clientY: TB1_C1_RIGHT.y, pointerId: 3 });
    expect(document.querySelector('[data-armed="true"]')).toBeTruthy();
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(onConnect).not.toHaveBeenCalled();
    expect(document.querySelector('[data-armed="true"]')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/Connection cancelled/i);
  });

  it('keyboard: Enter arms on one handle and commits on another; node keys still work', () => {
    const onConnect = vi.fn();
    const onMove = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onConnectColumns={onConnect}
      />,
    );
    const handles = screen.getAllByRole('button', { name: 'Connect from users.role_id' });
    const first = handles[0];
    if (!first) throw new Error('source handle not found');
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(document.querySelector('[data-armed="true"]')).toBeTruthy();
    const target = screen.getAllByRole('button', { name: 'Connect from projects.user_id' })[0];
    if (!target) throw new Error('target handle not found');
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(onConnect).toHaveBeenCalledWith({
      fromTableId: 'tb1',
      fromColumnId: 'c3',
      toTableId: 'tb2',
      toColumnId: 'c2',
    });
    // Existing node keyboard intact: arrows nudge, Enter opens.
    const onOpen = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onOpenTable={onOpen}
        onConnectColumns={onConnect}
      />,
    );
    const nodes = screen.getAllByRole('button', { name: /Table users/i });
    const node = nodes[nodes.length - 1];
    if (!node) throw new Error('users node not found');
    fireEvent.keyDown(node, { key: 'ArrowRight' });
    expect(onMove).toHaveBeenCalled();
    fireEvent.keyDown(node, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('tb1');
  });
});

describe('U3 NewRelationModal prefill (initialFrom/initialTo)', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    mockDispatch.mockReset();
    useProjectMock.mockReturnValue({ state: modalState(), dispatch: mockDispatch, setStatus: vi.fn() });
  });

  function renderModal(ui: React.ReactElement) {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  }

  it('prefilled endpoints submit directly with 1:N/cascade defaults', () => {
    const onClose = vi.fn();
    renderModal(
      <NewRelationModal
        open
        initialFrom={{ tableId: 'tb1', columnId: 'c3' }}
        initialTo={{ tableId: 'tb2', columnId: 'c2' }}
        onClose={onClose}
      />,
    );
    const submit = screen.getByRole('button', { name: /Add relation|Tambah relasi/i });
    expect(submit.getAttribute('disabled')).toBeNull();
    fireEvent.submit(document.getElementById('new-relation-form')!);
    const added = mockDispatch.mock.calls.find((c) => c[0].type === 'relation/add');
    expect(added?.[0].relation).toMatchObject({
      fromTableId: 'tb1',
      fromColumnId: 'c3',
      toTableId: 'tb2',
      toColumnId: 'c2',
      cardinality: '1:N',
      onDelete: 'cascade',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('same-table prefill keeps the existing guard: error + disabled submit, user can still change', () => {
    renderModal(
      <NewRelationModal
        open
        initialFrom={{ tableId: 'tb1', columnId: 'c1' }}
        initialTo={{ tableId: 'tb1', columnId: 'c3' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/must be different|harus berbeda/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Add relation|Tambah relasi/i }).getAttribute('disabled'),
    ).not.toBeNull();
    // User edits the To table to projects → column resets, validation re-runs.
    fireEvent.click(screen.getByRole('button', { name: 'To table' }));
    fireEvent.click(screen.getByRole('option', { name: 'projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'To column' }));
    fireEvent.click(screen.getByRole('option', { name: 'user_id' }));
    fireEvent.submit(document.getElementById('new-relation-form')!);
    const added = mockDispatch.mock.calls.find((c) => c[0].type === 'relation/add');
    expect(added?.[0].relation).toMatchObject({ fromTableId: 'tb1', toTableId: 'tb2', toColumnId: 'c2' });
  });

  it('no prefill behaves exactly like before (empty + disabled submit)', () => {
    renderModal(<NewRelationModal open onClose={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /Add relation|Tambah relasi/i }).getAttribute('disabled'),
    ).not.toBeNull();
  });
});
