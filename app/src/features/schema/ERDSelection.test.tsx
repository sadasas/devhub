import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ERD } from './ERD';
import { SchemaPage } from './SchemaPage';
import type { State, Table } from '../../lib/types';

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
    relations: [],
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

describe('Ronde 3 ITEM 5: klik seleksi tanpa eager capture', () => {
  it('tap node (pointerdown+up+click) menyeleksi tabel via onSelectTable', () => {
    const onSelect = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={() => {}}
        onSelectTable={onSelect}
        onSelectRelation={() => {}}
      />,
    );
    const svg = svgEl();
    // Tanpa capture eager, click harus sampai ke node (bukan svg).
    fireEvent.pointerDown(svg, { button: 0, clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Table users/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('tb1');
  });

  it('drag melewati ambang TIDAK menyeleksi (commit move, click ter-suppress)', () => {
    const onSelect = vi.fn();
    const onMove = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onSelectTable={onSelect}
        onSelectRelation={() => {}}
      />,
    );
    const svg = svgEl();
    fireEvent.pointerDown(svg, { button: 0, clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 80, pointerId: 1 });
    expect(onMove).toHaveBeenCalledTimes(1);
    // Click yang menyusul drag harus di-suppress → tidak seleksi.
    fireEvent.click(screen.getByRole('button', { name: /Table users/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('klik background tetap clear seleksi via svg onClick', () => {
    const onSelect = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={() => {}}
        onSelectTable={onSelect}
        onSelectRelation={() => {}}
      />,
    );
    const svg = svgEl();
    fireEvent.pointerDown(svg, { button: 0, clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Table users/i }));
    expect(onSelect).toHaveBeenCalledWith('tb1');
    onSelect.mockClear();
    fireEvent.click(svg);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe('Ronde 3 ITEM 1b: follow-connect tap-tap', () => {
  it('armed source + pointermove menampilkan garis temp dengan marker', () => {
    const onConnect = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onConnectColumns={onConnect}
      />,
    );
    const svg = svgEl();
    // Arm via keyboard di handle pertama.
    const handle = screen.getAllByRole('button', { name: /Connect from users\.id/i })[0]!;
    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toMatch(/users\.id/i);
    // Gerak kursor bebas (tanpa drag) harus memunculkan garis temp.
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 200, pointerId: 99 });
    const temp = document.querySelector('.erd-connect-temp line');
    expect(temp).not.toBeNull();
    expect(temp?.getAttribute('marker-end')).toBe('url(#erd-arrow)');
    // Gerak kecil <=2px tidak update ulang (throttle) — tetap satu garis.
    expect(document.querySelectorAll('.erd-connect-temp line').length).toBe(1);
    // Esc membatalkan garis.
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(document.querySelector('.erd-connect-temp')).toBeNull();
  });
});

describe('Ronde 3 ITEM 2: tooltip kanan + tanpa <title> native', () => {
  it('hover kolom menampilkan kartu kanan, hover relasi menampilkan label+cardinality', () => {
    const st: State = {
      ...makeState(),
      relations: [
        {
          id: 'r1',
          fromTableId: 'tb1',
          fromColumnId: 'c1',
          toTableId: 'tb2',
          toColumnId: 'c2',
          cardinality: '1:N',
          onDelete: 'cascade',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    render(<ERD state={st} onDeleteRelation={() => {}} onNewTable={() => {}} />);
    // Kolom: hover row memunculkan kartu putih.
    const colRow = document.querySelector('[data-connect-col="tb1:c1"]');
    if (!colRow) throw new Error('col row not found');
    fireEvent.mouseEnter(colRow);
    expect(document.getElementById('erd-col-tip')).not.toBeNull();
    fireEvent.mouseLeave(colRow);
    expect(document.getElementById('erd-col-tip')).toBeNull();
    // Relasi: hover garis memunculkan label + cardinality + onDelete.
    const rel = screen.getByRole('button', { name: /users\.id to projects\.user_id/i });
    fireEvent.mouseEnter(rel);
    const tip = document.getElementById('erd-col-tip');
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toMatch(/users\.id.*projects\.user_id/i);
    expect(tip?.textContent).toMatch(/1:N/);
    expect(tip?.textContent).toMatch(/cascade/);
    fireEvent.mouseLeave(rel);
  });

  it('tanpa <title> native di semua mode tapi aria-label tetap', () => {
    const st: State = {
      ...makeState(),
      relations: [
        {
          id: 'r1',
          fromTableId: 'tb1',
          fromColumnId: 'c1',
          toTableId: 'tb2',
          toColumnId: 'c2',
          cardinality: '1:N',
          onDelete: 'cascade',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    render(<ERD state={st} onDeleteRelation={() => {}} onNewTable={() => {}} />);
    // Ronde 6: <title> native selalu disembunyikan (custom tooltip pengganti).
    expect(document.querySelector('.erd-node title')).toBeNull();
    expect(document.querySelector('.erd-rel title')).toBeNull();
    expect(screen.getByRole('button', { name: /Table users/i }).getAttribute('aria-label')).toMatch(/users/);
    expect(screen.getByRole('button', { name: /users\.id to projects/i }).getAttribute('aria-label')).toMatch(/users/);
  });

  it('ronde 5: panel Tables default full-height, tanpa empty variant', () => {
    useProjectMock.mockReturnValue({
      state: {
        tables: [
          makeTable({
            id: 'tb1',
            name: 'users',
            columns: [{ id: 'c1', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' }],
          }),
        ],
        relations: [],
        schemaVersions: [{ id: 'sv1', version: 'v0.1.0', notes: '', appliedAt: '2026-01-01T00:00:00.000Z', snapshot: { tables: [], relations: [] }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
        tasks: [],
        issues: [],
        testCases: [],
        techEntries: [],
        decisions: [],
        milestones: [],
        apiCollections: [],
        apiEndpoints: [],
        whiteboards: [],
      },
      loading: false,
      error: null,
      canEdit: true,
      projectId: 'p1',
      dispatch: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/p/p1?tab=schema&schemaView=erd&canvas=1']}>
        <SchemaPage projectName="Demo" />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog', { name: /ERD canvas|Kanvas ERD/i });
    const panel = within(dialog).getByRole('complementary', { name: /properties|properti/i });
    expect(panel.getAttribute('data-panel')).toBe('tables');
    expect(panel.querySelector('.erd-panel-empty-body')).toBeNull();
    expect(within(dialog).getByRole('tab', { name: /^Tables$|^Tabel$/i }).getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('erd-panel-tabpanel-tables')?.hasAttribute('hidden')).toBe(false);
    expect(within(panel).getByRole('button', { name: /users.*1 columns|users.*1 kolom/i })).toBeTruthy();
    // Pill toolbar tanpa badge issue.
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).queryByRole('button', { name: /schema issues|masalah schema/i })).toBeNull();
  });
});

describe('Ronde 5 ITEM 4: highlight seleksi kanvas', () => {
  it('node terpilih: class erd-node-selected + aria-current, dibedakan dari highlight locate', () => {
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={() => {}}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
        selectedTableId="tb1"
      />,
    );
    const node = screen.getByRole('button', { name: /Table users/i });
    expect(node.classList.contains('erd-node-selected')).toBe(true);
    expect(node.getAttribute('aria-current')).toBe('true');
    expect(node.classList.contains('erd-table-highlight')).toBe(false);
    const other = screen.getByRole('button', { name: /Table projects/i });
    expect(other.classList.contains('erd-node-selected')).toBe(false);
    expect(other.getAttribute('aria-current')).toBeNull();
  });

  it('relasi terseleksi: class erd-rel-selected (sama gaya hover) + aria-current', () => {
    const st: State = {
      ...makeState(),
      relations: [
        {
          id: 'r1',
          fromTableId: 'tb1',
          fromColumnId: 'c1',
          toTableId: 'tb2',
          toColumnId: 'c2',
          cardinality: '1:N',
          onDelete: 'cascade',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const { rerender } = render(
      <ERD state={st} onDeleteRelation={() => {}} onNewTable={() => {}} selectedRelationId="r1" />,
    );
    const rel = screen.getByRole('button', { name: /users\.id to projects\.user_id/i });
    expect(rel.classList.contains('erd-rel-selected')).toBe(true);
    expect(rel.getAttribute('aria-current')).toBe('true');
    const line = rel.querySelector('.erd-rel-line');
    expect(line).not.toBeNull();
    // Tanpa seleksi: class hilang.
    rerender(<ERD state={st} onDeleteRelation={() => {}} onNewTable={() => {}} selectedRelationId={null} />);
    expect(screen.getByRole('button', { name: /users\.id to projects\.user_id/i }).classList.contains('erd-rel-selected')).toBe(false);
  });

  it('header custom: inline style fill (regresi cascade — attr fill kalah oleh CSS)', () => {
    const base = makeState();
    const st: State = {
      ...base,
      tables: base.tables.map((t) => (t.id === 'tb1' ? { ...t, color: '#A78BFA' } : t)),
    };
    render(
      <ERD
        state={st}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={() => {}}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    const node = screen.getByRole('button', { name: /Table users/i });
    const header = node.querySelector('.erd-table-header') as SVGRectElement | null;
    // jsdom menormalkan hex -> rgb; yang penting inline style menang atas CSS class.
    expect(header?.style.fill).toBe('rgb(167, 139, 250)');
    const title = node.querySelector('.erd-table-title') as SVGTextElement | null;
    expect(title?.style.fill).toBe('rgb(255, 255, 255)');
    // Default: tanpa inline style (fallback ke CSS class).
    const other = screen.getByRole('button', { name: /Table projects/i });
    expect((other.querySelector('.erd-table-header') as SVGRectElement | null)?.getAttribute('style')).toBeNull();
  });

  it('tabel terseleksi + relasi insiden: overlay flow + connected + tetangga', () => {    const st: State = {
      ...makeState(),
      relations: [
        {
          id: 'r1',
          fromTableId: 'tb1',
          fromColumnId: 'c1',
          toTableId: 'tb2',
          toColumnId: 'c2',
          cardinality: '1:N',
          onDelete: 'cascade',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    render(
      <ERD
        state={st}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={() => {}}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
        selectedTableId="tb1"
      />,
    );
    const rel = screen.getByRole('button', { name: /users\.id to projects\.user_id/i });
    expect(rel.classList.contains('erd-rel-connected')).toBe(true);
    expect(rel.querySelector('.erd-rel-flow')).not.toBeNull();
    const neighbor = screen.getByRole('button', { name: /Table projects/i });
    expect(neighbor.classList.contains('erd-node-neighbor')).toBe(true);
  });

  it('drop node ke dalam bounds area → onAssignTableGroup(tableId, groupId)', () => {
    // Layout grid: tb1 @(16,16), tb2 @(272,16); g1=[tb2] -> bounds (256,0,240,96).
    // Client = world + 16 (view awal 16,16 s=1, rect jsdom 0,0).
    const base = makeState();
    const ts = '2026-01-01T00:00:00.000Z';
    const st: State = {
      ...base,
      erdGroups: [{ id: 'g1', name: 'Billing', color: null, tableIds: ['tb2'], createdAt: ts, updatedAt: ts }],
    };
    const onMove = vi.fn();
    const onAssign = vi.fn();
    render(
      <ERD
        state={st}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onAssignTableGroup={onAssign}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    // Drag tb1 dari header (world 100,30) ke dalam bounds g1 (world 300,40).
    fireEvent.pointerDown(screen.getByRole('button', { name: /Table users/i }), {
      button: 0,
      clientX: 116,
      clientY: 46,
      pointerId: 1,
    });
    fireEvent.pointerMove(svgEl(), { clientX: 316, clientY: 56, pointerId: 1 });
    fireEvent.pointerUp(svgEl(), { clientX: 316, clientY: 56, pointerId: 1 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onAssign).toHaveBeenCalledWith('tb1', 'g1');
  });

  it('drop node di luar semua bounds → onAssignTableGroup(tableId, null) bila anggota', () => {
    const base = makeState();
    const ts = '2026-01-01T00:00:00.000Z';
    const st: State = {
      ...base,
      erdGroups: [{ id: 'g1', name: 'Billing', color: null, tableIds: ['tb1', 'tb2'], createdAt: ts, updatedAt: ts }],
    };
    const onMove = vi.fn();
    const onAssign = vi.fn();
    render(
      <ERD
        state={st}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onAssignTableGroup={onAssign}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    // Drag tb1 jauh ke kanvas kosong (world 684,484).
    fireEvent.pointerDown(screen.getByRole('button', { name: /Table users/i }), {
      button: 0,
      clientX: 116,
      clientY: 46,
      pointerId: 1,
    });
    fireEvent.pointerMove(svgEl(), { clientX: 700, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(svgEl(), { clientX: 700, clientY: 500, pointerId: 1 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onAssign).toHaveBeenCalledWith('tb1', null);
  });
});

  it('area groups: boundary dashed + label; grup kosong di-skip', () => {    const base = makeState();
    const ts = '2026-01-01T00:00:00.000Z';
    const st: State = {
      ...base,
      erdGroups: [
        { id: 'g1', name: 'Billing', color: '#e8b955', tableIds: ['tb1', 'tb2'], createdAt: ts, updatedAt: ts },
        { id: 'g2', name: 'Empty', color: null, tableIds: [], createdAt: ts, updatedAt: ts },
      ],
    };
    render(
      <ERD
        state={st}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={() => {}}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    const groups = document.querySelectorAll('.erd-group');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.querySelector('.erd-group-label')?.textContent).toBe('Billing');
    expect(groups[0]?.querySelector('.erd-group-box')?.getAttribute('style')).toMatch(/stroke/i);
    // Label chip berwarna: halo paint-order + teks kontras.
    expect(groups[0]?.querySelector('.erd-group-label')?.getAttribute('style')).toMatch(/paint-order/i);
  });

describe('geser grup memindahkan anggota', () => {
  it('drag label area memindahkan semua anggota (tanpa ubah membership)', () => {
    // g1=[tb1,tb2] -> bounds (0,0,512,112); label di world (12,22) -> client (28,38).
    const base = makeState();
    const ts = '2026-01-01T00:00:00.000Z';
    const st: State = {
      ...base,
      erdGroups: [{ id: 'g1', name: 'Billing', color: null, tableIds: ['tb1', 'tb2'], createdAt: ts, updatedAt: ts }],
    };
    const onMove = vi.fn();
    const onAssign = vi.fn();
    render(
      <ERD
        state={st}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onAssignTableGroup={onAssign}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    const label = document.querySelector('.erd-group-label');
    expect(label).not.toBeNull();
    fireEvent.pointerDown(label!, { button: 0, clientX: 28, clientY: 38, pointerId: 1 });
    fireEvent.pointerMove(svgEl(), { clientX: 128, clientY: 88, pointerId: 1 });
    fireEvent.pointerUp(svgEl(), { clientX: 128, clientY: 88, pointerId: 1 });
    // Delta dunia (100,50): kedua anggota commit posisi baru.
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenCalledWith('tb1', { x: 116, y: 66 });
    expect(onMove).toHaveBeenCalledWith('tb2', { x: 372, y: 66 });
    expect(onAssign).not.toHaveBeenCalled();
  });
});

describe('area kanvas: seleksi + resize + geometri eksplisit', () => {
  const TS = '2026-01-01T00:00:00.000Z';
  function stateWithGroup() {
    const base = makeState();
    return {
      ...base,
      erdGroups: [
        { id: 'g1', name: 'Billing', color: null, tableIds: ['tb1', 'tb2'], x: 0, y: 0, w: 512, h: 112, createdAt: TS, updatedAt: TS },
      ],
    };
  }

  function renderCanvas() {
    return render(
      <ERD
        state={stateWithGroup()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={vi.fn()}
        onMoveGroup={vi.fn()}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
  }

  it('klik label menyeleksi grup (4 handle); Esc melepas', () => {
    renderCanvas();
    expect(document.querySelectorAll('.erd-group-handle')).toHaveLength(0);
    const label = document.querySelector('.erd-group-label');
    expect(label).not.toBeNull();
    fireEvent.click(label!);
    expect(document.querySelectorAll('.erd-group-handle')).toHaveLength(4);
    fireEvent.keyDown(document.querySelector('.erd-canvas')!, { key: 'Escape' });
    expect(document.querySelectorAll('.erd-group-handle')).toHaveLength(0);
  });

  it('drag handle SE me-resize rect (min clamp) -> onMoveGroup', () => {
    const onMoveGroup = vi.fn();
    const st = stateWithGroup();
    render(
      <ERD
        state={st}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={vi.fn()}
        onMoveGroup={onMoveGroup}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    fireEvent.click(document.querySelector('.erd-group-label')!);
    // SE di world (512,112) -> client (528,128); geser ke client (628,178) -> world (612,162).
    const handles = document.querySelectorAll('.erd-group-handle');
    fireEvent.pointerDown(handles[3]!, { button: 0, clientX: 528, clientY: 128, pointerId: 1 });
    fireEvent.pointerMove(svgEl(), { clientX: 628, clientY: 178, pointerId: 1 });
    fireEvent.pointerUp(svgEl(), { clientX: 628, clientY: 178, pointerId: 1 });
    expect(onMoveGroup).toHaveBeenCalledWith('g1', { x: 0, y: 0, w: 612, h: 162 });
  });

  it('geser label grup eksplisit: anggota + geometri ikut', () => {
    const onMove = vi.fn();
    const onMoveGroup = vi.fn();
    render(
      <ERD
        state={stateWithGroup()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onMoveGroup={onMoveGroup}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    // Label di world (12,22) -> client (28,38); geser +(100,50).
    fireEvent.pointerDown(document.querySelector('.erd-group-label')!, { button: 0, clientX: 28, clientY: 38, pointerId: 1 });
    fireEvent.pointerMove(svgEl(), { clientX: 128, clientY: 88, pointerId: 1 });
    fireEvent.pointerUp(svgEl(), { clientX: 128, clientY: 88, pointerId: 1 });
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMoveGroup).toHaveBeenCalledWith('g1', { x: 100, y: 50, w: 512, h: 112 });
  });

  it('drag dari border area menggeser anggota + geometri', () => {
    const onMove = vi.fn();
    const onMoveGroup = vi.fn();
    const onAssign = vi.fn();
    render(
      <ERD
        state={stateWithGroup()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onMoveGroup={onMoveGroup}
        onAssignTableGroup={onAssign}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    // Border atas g1 di world (256,0) -> client (272,16); geser +(100,50).
    const box = document.querySelector('.erd-group-box');
    expect(box).not.toBeNull();
    fireEvent.pointerDown(box!, { button: 0, clientX: 272, clientY: 16, pointerId: 1 });
    fireEvent.pointerMove(svgEl(), { clientX: 372, clientY: 66, pointerId: 1 });
    fireEvent.pointerUp(svgEl(), { clientX: 372, clientY: 66, pointerId: 1 });
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenCalledWith('tb1', { x: 116, y: 66 });
    expect(onMove).toHaveBeenCalledWith('tb2', { x: 372, y: 66 });
    expect(onMoveGroup).toHaveBeenCalledWith('g1', { x: 100, y: 50, w: 512, h: 112 });
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('drag dari interior area tetap pan (anggota diam)', () => {
    const onMove = vi.fn();
    const onMoveGroup = vi.fn();
    render(
      <ERD
        state={stateWithGroup()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={onMove}
        onMoveGroup={onMoveGroup}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    // Interior kosong g1 di world (256,56) -> client (272,72): bukan node, bukan border.
    fireEvent.pointerDown(svgEl(), { button: 0, clientX: 272, clientY: 72, pointerId: 1 });
    fireEvent.pointerMove(svgEl(), { clientX: 372, clientY: 122, pointerId: 1 });
    fireEvent.pointerUp(svgEl(), { clientX: 372, clientY: 122, pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();
    expect(onMoveGroup).not.toHaveBeenCalled();
  });

  it('klik interior kosong grup menyeleksi; klik luar membersihkan', () => {
    render(
      <ERD
        state={stateWithGroup()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={vi.fn()}
        onMoveGroup={vi.fn()}
        onSelectTable={() => {}}
        onSelectRelation={() => {}}
      />,
    );
    expect(document.querySelectorAll('.erd-group-handle')).toHaveLength(0);
    // Interior kosong g1 world (100,100) -> client (116,116): di bawah node, tanpa relasi.
    fireEvent.click(svgEl(), { clientX: 116, clientY: 116 });
    expect(document.querySelectorAll('.erd-group-handle')).toHaveLength(4);
    // Klik jauh di luar: bersih total.
    fireEvent.click(svgEl(), { clientX: 900, clientY: 700 });
    expect(document.querySelectorAll('.erd-group-handle')).toHaveLength(0);
  });
});
