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
    expect(within(panel).getByRole('tab', { name: /^Tables$|^Tabel$/i }).getAttribute('aria-selected')).toBe('true');
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
});
