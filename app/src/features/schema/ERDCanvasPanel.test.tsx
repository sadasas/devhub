import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SchemaPage } from './SchemaPage';
import type { Relation, SchemaVersion, Table } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function table(over: Partial<Table> = {}): Table {
  return {
    id: 'tb1',
    name: 'users',
    comment: 'app users',
    columns: [
      { id: 'c1', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' },
      { id: 'c2', name: 'email', type: 'text', nullable: true, primaryKey: false, default: null, comment: '' },
    ],
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function relation(over: Partial<Relation> = {}): Relation {
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

function version(over: Partial<SchemaVersion> = {}): SchemaVersion {
  return {
    id: 'sv1',
    version: 'v0.1.0',
    notes: '',
    appliedAt: '2026-01-01T00:00:00.000Z',
    snapshot: { tables: [], relations: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function liveTables(): Table[] {
  return [
    table(),
    table({
      id: 'tb2',
      name: 'projects',
      comment: '',
      columns: [
        { id: 'c2', name: 'user_id', type: 'uuid', nullable: true, primaryKey: false, default: null, comment: '' },
      ],
      indexes: [],
    }),
  ];
}

function mockLive(opts: { canEdit?: boolean; dispatch?: ReturnType<typeof vi.fn> } = {}) {
  const dispatch = opts.dispatch ?? vi.fn();
  useProjectMock.mockReturnValue({
    state: {
      tables: liveTables(),
      relations: [relation()],
      schemaVersions: [version()],
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
    canEdit: opts.canEdit ?? true,
    projectId: 'p1',
    dispatch,
  });
  return dispatch;
}

function renderCanvas() {
  return render(
    <MemoryRouter initialEntries={['/p/p1?tab=schema&schemaView=erd&canvas=1']}>
      <SchemaPage projectName="Demo Project" />
    </MemoryRouter>,
  );
}

function canvasDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: /ERD canvas/i });
}

function panel(): HTMLElement {
  return within(canvasDialog()).getByRole('complementary', { name: /properties|properti/i });
}

describe('U4 ERD canvas props panel', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    document.body.style.overflow = '';
  });

  it('ronde 5: default tab Tables, list expandable + tab Relations', () => {
    mockLive();
    renderCanvas();
    const p = panel();
    // PanelTab tables|relations, default tables — tanpa tab Properties.
    expect(within(p).queryByRole('tab', { name: /^Properties$|^Properti$/i })).toBeNull();
    expect(within(p).getByRole('tab', { name: /^Tables$|^Tabel$/i }).getAttribute('aria-selected')).toBe('true');
    expect(within(p).getByRole('tab', { name: /^Relations$|^Relasi$/i })).toBeTruthy();
    expect(p.getAttribute('data-panel')).toBe('tables');
    // Tiap item tabel = header button (nama + columnsCount + chevron, collapsed).
    const usersBtn = within(p).getByRole('button', { name: /users.*2 columns|users.*2 kolom/i });
    expect(usersBtn.getAttribute('aria-expanded')).toBe('false');
    expect(usersBtn.getAttribute('aria-controls')).toBe('erd-panel-table-detail-tb1');
    // Issues selalu paling bawah di semua tab (sibling setelah tabpanel).
    expect(p.lastElementChild?.getAttribute('id')).toBe('erd-panel-issues-strip');
  });

  it('table variant: clicking a node shows name/comment/columns/indexes/actions', () => {
    mockLive();
    renderCanvas();
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /Table users with/i }));
    const p = panel();
    // Title + inline name/comment (editable inputs).
    expect(within(p).getByText(/TABLE.*users/i)).toBeTruthy();
    expect((within(p).getByLabelText(/^Name$|^Nama$/i) as HTMLInputElement).value).toBe('users');
    expect((within(p).getByLabelText(/Comment|Komentar/i) as HTMLTextAreaElement).value).toBe('app users');
    // Columns list: mono name+type, PK/NULL badges, unique checkbox, delete.
    expect(within(p).getByText('uuid')).toBeTruthy();
    expect(within(p).getByText('PK')).toBeTruthy();
    expect(within(p).getByText('NULL')).toBeTruthy();
    expect(within(p).getByRole('checkbox', { name: /Unique.*\bid\b/i })).toBeTruthy();
    expect(within(p).getByRole('checkbox', { name: /Unique.*\bemail\b/i })).toBeTruthy();
    expect(within(p).getByRole('button', { name: /Delete column id/i })).toBeTruthy();
    expect(within(p).getByRole('button', { name: /^Add column|^Tambah kolom/i })).toBeTruthy();
    // Indexes read + Edit, full editor + delete table.
    expect(within(p).getByText(/No indexes|Belum ada indeks/i)).toBeTruthy();
    expect(within(p).getByRole('button', { name: /^Edit$/i })).toBeTruthy();
    expect(within(p).getByRole('button', { name: /Open full editor|Buka editor penuh/i })).toBeTruthy();
    expect(within(p).getByRole('button', { name: /^Delete table|^Hapus tabel/i })).toBeTruthy();
    // Focus stays on the canvas node — panel never steals it on mouse select.
    expect(document.activeElement?.textContent).not.toContain('Add column');
  });

  it('column variant: row click expands an inline editor, type is text-only (U6 later)', () => {
    mockLive();
    renderCanvas();
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /Table users with/i }));
    const p = panel();
    fireEvent.click(within(p).getByRole('button', { name: /Edit column email/i }));
    // Expanded editor: name input, type as text + U6 hint, nullable/PK/default/comment.
    expect(within(p).getByDisplayValue('email')).toBeTruthy();
    expect(within(p).getByText(/Type editing lands|Edit tipe menyusul/i)).toBeTruthy();
    expect(within(p).getByLabelText(/Nullable/i)).toBeTruthy();
    expect(within(p).getByLabelText(/Primary key|Kunci utama/i)).toBeTruthy();
    expect(within(p).getByLabelText(/Default/i)).toBeTruthy();
    // Collapse again via the same row.
    fireEvent.click(within(p).getByRole('button', { name: /Collapse column email|Ciutkan kolom email/i }));
    expect(within(p).queryByText(/Type editing lands|Edit tipe menyusul/i)).toBeNull();
  });

  it('relation variant: clicking a line shows label + cardinality/onDelete + delete', () => {
    mockLive();
    renderCanvas();
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /users\.id to projects\.user_id/i }));
    const p = panel();
    expect(within(p).getByText(/RELATION|RELASI/)).toBeTruthy();
    // U5: the issues section may repeat the same relation label in its rows —
    // assert the dedicated rel-label element, not any matching text.
    expect(p.querySelector('.erd-panel-rel-label')?.textContent).toMatch(/users\.id.*projects\.user_id/i);
    expect((within(p).getByLabelText(/Cardinality|Kardinalitas/i) as HTMLSelectElement).value).toBe('1:N');
    expect((within(p).getByLabelText(/On delete|Saat hapus/i) as HTMLSelectElement).value).toBe('cascade');
    expect(within(p).getByRole('button', { name: /Delete relation|Hapus relasi/i })).toBeTruthy();
  });

  it('edit persists: renaming the table dispatches table/update', () => {
    const dispatch = mockLive();
    renderCanvas();
    fireEvent.click(within(canvasDialog()).getByRole('button', { name: /Table users with/i }));
    fireEvent.change(panel().querySelector('#erd-panel-table-name') as HTMLInputElement, {
      target: { value: 'members' },
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'table/update', id: 'tb1', patch: { name: 'members' } });
  });

  it('unique toggle uses B2: dispatches table/update with unique:<col>', () => {
    const dispatch = mockLive();
    renderCanvas();
    fireEvent.click(within(canvasDialog()).getByRole('button', { name: /Table users with/i }));
    fireEvent.click(within(panel()).getByRole('checkbox', { name: /Unique.*\bid\b/i }));
    const call = dispatch.mock.calls.find((c) => c[0]?.type === 'table/update' && Array.isArray(c[0]?.patch?.indexes));
    expect(call?.[0]?.patch?.indexes).toContain('unique:id');
  });

  it('delete gate: Delete table needs confirm — cancel keeps, confirm removes + empties', () => {
    const dispatch = mockLive();
    renderCanvas();
    fireEvent.click(within(canvasDialog()).getByRole('button', { name: /Table users with/i }));
    fireEvent.click(within(panel()).getByRole('button', { name: /^Delete table|^Hapus tabel/i }));
    // ConfirmDeleteDialog gate appears; cancel does not dispatch.
    expect(screen.getByRole('dialog', { name: /Delete table|Hapus tabel/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Cancel|^Batal/i }));
    expect(dispatch.mock.calls.some((c) => c[0]?.type === 'table/remove')).toBe(false);
    expect(panel()).toBeTruthy();
    // Confirm removes + collapses the inline detail (ronde 5: tanpa varian empty).
    fireEvent.click(within(panel()).getByRole('button', { name: /^Delete table|^Hapus tabel/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Delete$|^Hapus$/i }).pop() as HTMLElement);
    expect(dispatch).toHaveBeenCalledWith({ type: 'table/remove', id: 'tb1' });
    expect(within(panel()).queryByText(/TABLE.*users/i)).toBeNull();
    expect(within(panel()).getByRole('button', { name: /projects.*1 columns|projects.*1 kolom/i })).toBeTruthy();
  });

  it('readOnly: display only — no add/delete/unique/selects', () => {
    mockLive({ canEdit: false });
    renderCanvas();
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /Table users with/i }));
    const p = panel();
    expect(within(p).getByText(/TABLE.*users/i)).toBeTruthy();
    expect(within(p).queryByRole('button', { name: /^Add column|^Tambah kolom/i })).toBeNull();
    expect(within(p).queryByRole('button', { name: /^Delete table|^Hapus tabel/i })).toBeNull();
    expect(within(p).queryByRole('checkbox', { name: /Unique/i })).toBeNull();
    expect(within(p).queryByRole('button', { name: /Delete column/i })).toBeNull();
    // Relation variant is display-only too.
    fireEvent.click(within(dialog).getByRole('button', { name: /users\.id to projects\.user_id/i }));
    const pr = panel();
    expect(within(pr).queryByRole('combobox')).toBeNull();
    expect(within(pr).queryByRole('button', { name: /Delete relation|Hapus relasi/i })).toBeNull();
  });

  it('Esc closes the panel only — canvas stays open', () => {
    mockLive();
    renderCanvas();
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /Table users with/i }));
    expect(within(panel()).getByText(/TABLE.*users/i)).toBeTruthy();
    // Esc inside the panel collapses the inline detail, not the overlay (ronde 5).
    fireEvent.keyDown(panel(), { key: 'Escape' });
    expect(within(panel()).queryByText(/TABLE.*users/i)).toBeNull();
    expect(within(panel()).getByRole('button', { name: /users.*2 columns|users.*2 kolom/i }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog', { name: /ERD canvas/i })).toBeTruthy();
    // Next Esc (no selection) closes the canvas itself.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /ERD canvas/i })).toBeNull();
  });
});

describe('Ronde 5 ITEM 2+3: auto-buka + tab Relations', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    document.body.style.overflow = '';
  });

  it('klik canvas tabel → tab Tables + expand + aria-current, tanpa curi fokus', () => {
    mockLive();
    renderCanvas();
    const dialog = canvasDialog();
    const node = within(dialog).getByRole('button', { name: /Table users with/i });
    node.focus();
    fireEvent.click(node);
    const p = panel();
    expect(p.getAttribute('data-panel')).toBe('tables');
    const btn = within(p).getByRole('button', { name: /users.*2 columns|users.*2 kolom/i });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-current')).toBe('true');
    expect(btn.getAttribute('aria-controls')).toBe('erd-panel-table-detail-tb1');
    expect(document.getElementById('erd-panel-table-detail-tb1')).not.toBeNull();
    // Satu expanded dalam satu waktu — projects tetap collapsed.
    expect(within(p).getByRole('button', { name: /projects.*1 columns|projects.*1 kolom/i }).getAttribute('aria-expanded')).toBe('false');
    // Fokus tidak dicuri panel (tetap di node kanvas).
    expect(document.activeElement).toBe(node);
  });

  it('klik garis relasi → tab Relations + expand detail + issues tetap bawah', () => {
    mockLive();
    renderCanvas();
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /users\.id to projects\.user_id/i }));
    const p = panel();
    expect(p.getAttribute('data-panel')).toBe('relations');
    expect(within(p).getByRole('tab', { name: /^Relations$|^Relasi$/i }).getAttribute('aria-selected')).toBe('true');
    expect(p.querySelector('.erd-panel-rel-label')?.textContent).toMatch(/users\.id.*projects\.user_id/i);
    expect(within(p).getByRole('button', { name: /Delete relation|Hapus relasi/i })).toBeTruthy();
    expect(p.lastElementChild?.getAttribute('id')).toBe('erd-panel-issues-strip');
    // Arrow-key pindah tab.
    fireEvent.keyDown(within(p).getByRole('tab', { name: /^Relations$|^Relasi$/i }), { key: 'ArrowLeft' });
    expect(within(p).getByRole('tab', { name: /^Tables$|^Tabel$/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('placeholder hanya bila 0 tabel / 0 relasi', () => {
    useProjectMock.mockReturnValue({
      state: {
        tables: [],
        relations: [],
        schemaVersions: [version()],
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
    renderCanvas();
    const p = panel();
    expect(within(p).getByText(/No tables yet|Belum ada tabel/i)).toBeTruthy();
    fireEvent.click(within(p).getByRole('tab', { name: /^Relations$|^Relasi$/i }));
    expect(within(p).getByText(/No relations yet|Belum ada relasi/i)).toBeTruthy();
  });
});
