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
    comment: '',
    columns: [],
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

/** Two tables with 2 lint issues (pk-null on users.id + index typo). */
function buggyTables(): Table[] {
  return [
    table({
      id: 'tb1',
      name: 'users',
      columns: [
        { id: 'c1', name: 'id', type: 'uuid', nullable: true, primaryKey: true, default: null, comment: '' },
      ],
      indexes: ['typo_idx'],
    }),
    table({
      id: 'tb2',
      name: 'projects',
      columns: [
        { id: 'c2', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' },
      ],
      indexes: [],
    }),
  ];
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

function mockLive(opts: { canEdit?: boolean; tables?: Table[]; relations?: Relation[]; versions?: SchemaVersion[] } = {}) {
  useProjectMock.mockReturnValue({
    state: {
      tables: opts.tables ?? buggyTables(),
      relations: opts.relations ?? [relation()],
      schemaVersions: opts.versions ?? [version()],
    },
    loading: false,
    error: null,
    canEdit: opts.canEdit ?? true,
    projectId: 'p1',
    dispatch: vi.fn(),
    setStatus: vi.fn(),
  });
}

function renderSchema(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SchemaPage projectName="Demo Project" />
    </MemoryRouter>,
  );
}

/** The canvas overlay dialog (aria-modal), distinct from the inline ERD behind it. */
function canvasDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: /ERD canvas/i });
}

describe('SchemaPage U1 ERD canvas mode', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    document.body.style.overflow = '';
    delete document.body.dataset.erdCanvas;
  });

  it('opens via ?schemaView=erd&canvas=1 — dialog + pill, Close focused, body locked', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).getByRole('button', { name: /^New table|^Tabel baru/ })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /^New relation|^Relasi baru/ })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /^Tidy$|^Rapikan$/ })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /Export/i })).toBeTruthy();
    // Ronde 3 ITEM 3b: pill toolbar tanpa badge — count hanya di panel bawah.
    expect(within(pill).queryByRole('button', { name: /schema issues|masalah schema/i })).toBeNull();
    expect(document.querySelector('.erd-canvas-mode-pill .schema-issues-badge')).toBeNull();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: /^Close canvas|^Tutup kanvas/ }),
    );
    expect(document.body.style.overflow).toBe('hidden');
    // Ronde 5: issues selalu paling bawah di semua tab (sibling setelah tabpanel) — single mount.
    expect(document.querySelectorAll('#schema-issues-strip').length).toBe(0);
    expect(document.querySelectorAll('#erd-panel-issues-strip').length).toBe(1);
    expect(within(dialog).getByText(/Schema issues|Masalah schema/)).toBeTruthy();
    // Bottom-most inside the aside: last element child is issues.
    const panel = within(dialog).getByRole('complementary', { name: /properties|properti/i });
    expect(panel.lastElementChild?.getAttribute('id')).toBe('erd-panel-issues-strip');
    expect(document.querySelector('#erd-panel-tabpanel-tables')).not.toBeNull();
    expect(document.querySelector('#erd-panel-tabpanel-relations')).not.toBeNull();
  });

  it('Canvas button enters via param; Close exits via param + restores focus to the trigger', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd');
    expect(screen.queryByRole('dialog', { name: /ERD canvas/i })).toBeNull();
    const trigger = screen.getByRole('button', { name: /^Canvas$|^Kanvas$/ });
    // jsdom fireEvent.click does not focus like a real browser — focus first
    // to mirror the real "restore to caller" behaviour.
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = canvasDialog();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: /^Close canvas|^Tutup kanvas/ }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: /^Close canvas|^Tutup kanvas/ }));
    expect(screen.queryByRole('dialog', { name: /ERD canvas/i })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('Esc closes the canvas when no popover is open', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    expect(canvasDialog()).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /ERD canvas/i })).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('Esc tiered: panel selection consumes Esc first (ronde 5 inline), canvas stays open', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const line = within(dialog).getByRole('button', { name: /users\.id to projects\.id/i });
    fireEvent.click(line);
    // Klik garis auto-buka tab Relations + expand detail (Delete ada di panel).
    const panel = within(dialog).getByRole('complementary', { name: /properties|properti/i });
    expect(panel.getAttribute('data-panel')).toBe('relations');
    expect(within(panel).getByRole('button', { name: /Delete relation|Hapus relasi/i })).toBeTruthy();
    fireEvent.keyDown(line, { key: 'Escape' });
    // Detail collapse, tab tetap Relations, canvas overlay tetap terbuka.
    expect(panel.getAttribute('data-panel')).toBe('relations');
    expect(within(panel).queryByRole('button', { name: /Delete relation|Hapus relasi/i })).toBeNull();
    expect(screen.queryByRole('dialog', { name: /ERD canvas/i })).toBeTruthy();
  });

  it('readOnly (viewer): pill hides create/Tidy, keeps Export; nodes are inert', () => {
    mockLive({ canEdit: false });
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).queryByRole('button', { name: /^New table|^Tabel baru/ })).toBeNull();
    expect(within(pill).queryByRole('button', { name: /^New relation|^Relasi baru/ })).toBeNull();
    expect(within(pill).queryByRole('button', { name: /^Tidy$|^Rapikan$/ })).toBeNull();
    expect(within(pill).getByRole('button', { name: /Export/i })).toBeTruthy();
    const node = within(dialog).getByRole('button', { name: /^Table users with/ });
    expect(node.getAttribute('aria-disabled')).toBe('true');
  });

  it('snapshot ?v= + canvas: presentation — no create/Tidy in the pill', () => {
    const snap = buggyTables();
    useProjectMock.mockReturnValue({
      state: {
        tables: buggyTables(),
        relations: [relation()],
        schemaVersions: [version({ id: 'sv1', version: 'v0.1.0', snapshot: { tables: snap, relations: [relation()] } })],
      },
      loading: false,
      error: null,
      canEdit: true,
      projectId: 'p1',
      dispatch: vi.fn(),
    });
    renderSchema('/p/p1?tab=schema&schemaView=erd&v=sv1&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).queryByRole('button', { name: /^New table|^Tabel baru/ })).toBeNull();
    expect(within(pill).queryByRole('button', { name: /^New relation|^Relasi baru/ })).toBeNull();
    expect(within(pill).queryByRole('button', { name: /^Tidy$|^Rapikan$/ })).toBeNull();
    expect(within(pill).getByRole('button', { name: /Export/i })).toBeTruthy();
  });

  it('R1: sets body[data-erd-canvas=open] while open, clears on unmount (launcher hidden via CSS, stays in DOM)', () => {
    mockLive();
    const { unmount } = renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    expect(canvasDialog()).toBeTruthy();
    expect(document.body.dataset.erdCanvas).toBe('open');
    // Hiding is CSS-only (body[data-erd-canvas="open"] .chat-launcher
    // { display:none } in global.css) — launcher element stays mounted.
    expect(document.body.matches('[data-erd-canvas="open"]')).toBe(true);
    unmount();
    expect(document.body.dataset.erdCanvas).toBeUndefined();
    expect(document.body.style.overflow).toBe('');
  });

  it('pill memuat Present (semua peran) + Import (editor saja)', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).getByRole('button', { name: /^Presentasi$|^Present$/ })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /^Import$/i })).toBeTruthy();
  });

  it('viewer: pill tanpa Import tapi tetap ada Present', () => {
    mockLive({ canEdit: false });
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).queryByRole('button', { name: /^Import$/i })).toBeNull();
    expect(within(pill).getByRole('button', { name: /^Presentasi$|^Present$/ })).toBeTruthy();
  });

  it('Presentasi: chrome hilang (top/panel/zoom), X floating muncul + fokus; Esc kembali utuh', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const presentBtn = within(dialog).getByRole('button', { name: /^Presentasi$|^Present$/ });
    fireEvent.click(presentBtn);
    // Top bar (pill + close), panel, dan zoom controls di-unmount.
    expect(within(dialog).queryByRole('toolbar', { name: /canvas tools|peralatan kanvas/i })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Close canvas|^Tutup kanvas/ })).toBeNull();
    expect(within(dialog).queryByRole('complementary', { name: /properties|properti/i })).toBeNull();
    expect(dialog.querySelector('.erd-zoom')).toBeNull();
    // X floating muncul dan terfokus; dialog tetap terbuka.
    const exitBtn = within(dialog).getByRole('button', { name: /Keluar presentasi|Exit presentation/i });
    expect(document.activeElement).toBe(exitBtn);
    // Esc keluar presentasi, fokus kembali ke tombol Presentasi, seleksi utuh.
    fireEvent.keyDown(exitBtn, { key: 'Escape' });
    expect(within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /Keluar presentasi|Exit presentation/i })).toBeNull();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: /^Presentasi$|^Present$/ }),
    );
    expect(screen.queryByRole('dialog', { name: /ERD canvas/i })).toBeTruthy();
  });

  it('Presentasi mempertahankan seleksi panel (tanpa reset)', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const line = within(dialog).getByRole('button', { name: /users\.id to projects\.id/i });
    fireEvent.click(line);
    const panel = within(dialog).getByRole('complementary', { name: /properties|properti/i });
    expect(panel.getAttribute('data-panel')).toBe('relations');
    fireEvent.click(within(dialog).getByRole('button', { name: /^Presentasi$|^Present$/ }));
    expect(within(dialog).queryByRole('complementary', { name: /properties|properti/i })).toBeNull();
    const exitBtn = within(dialog).getByRole('button', { name: /Keluar presentasi|Exit presentation/i });
    fireEvent.click(exitBtn);
    // Seleksi + tab panel kembali seperti sebelum presentasi.
    const panelAfter = within(dialog).getByRole('complementary', { name: /properties|properti/i });
    expect(panelAfter.getAttribute('data-panel')).toBe('relations');
    expect(within(panelAfter).getByRole('button', { name: /Delete relation|Hapus relasi/i })).toBeTruthy();
  });

  it('Import di pill membuka ImportSchemaModal di atas overlay', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    fireEvent.click(within(pill).getByRole('button', { name: /^Import$/i }));
    expect(screen.getByRole('dialog', { name: /Import|Impor/i })).toBeTruthy();
  });
});
