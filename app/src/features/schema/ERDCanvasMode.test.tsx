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

  it('top card memuat Present (semua peran); pill memuat Import (editor saja)', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).queryByRole('button', { name: /^Presentasi$|^Present$/ })).toBeNull();
    expect(within(dialog).getByRole('button', { name: /^Presentasi$|^Present$/ })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /^Import$/i })).toBeTruthy();
  });

  it('viewer: pill tanpa Import tapi top tetap ada Present', () => {
    mockLive({ canEdit: false });
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).queryByRole('button', { name: /^Import$/i })).toBeNull();
    expect(within(dialog).getByRole('button', { name: /^Presentasi$|^Present$/ })).toBeTruthy();
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

  it('Presentasi: klik tabel menyalakan highlight + animasi alur (panel tetap tutup)', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Presentasi$|^Present$/ }));
    // Chrome hilang tapi node bisa diklik untuk seleksi visual.
    const node = within(dialog).getByRole('button', { name: /^Table users with/ });
    expect(node.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(node);
    expect(node.getAttribute('class')).toContain('erd-node-selected');
    // Relasi insiden menganimasikan alur; panel properti tetap tidak muncul.
    expect(dialog.querySelectorAll('.erd-rel-flow').length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole('complementary', { name: /properties|properti/i })).toBeNull();
    // Highlight pindah saat tabel lain diklik.
    const other = within(dialog).getByRole('button', { name: /^Table projects with/ });
    fireEvent.click(other);
    expect(other.getAttribute('class')).toContain('erd-node-selected');
    expect(node.getAttribute('class')).not.toContain('erd-node-selected');
  });

  it('Presentasi: hover baris kolom memunculkan tooltip (hilang saat leave)', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Presentasi$|^Present$/ }));
    const colRow = dialog.querySelector('[data-connect-col="tb1:c1"]');
    expect(colRow).not.toBeNull();
    fireEvent.mouseEnter(colRow!);
    const tip = document.getElementById('erd-col-tip');
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toMatch(/id/);
    fireEvent.mouseLeave(colRow!);
    expect(document.getElementById('erd-col-tip')).toBeNull();
  });

  it('Import di pill membuka ImportSchemaModal di atas overlay', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    fireEvent.click(within(pill).getByRole('button', { name: /^Import$/i }));
    expect(screen.getByRole('dialog', { name: /Import|Impor/i })).toBeTruthy();
  });

  it('wide: pill penuh — New Area/Tidy/Export/Import langsung terlihat, tanpa …', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    expect(within(pill).getByRole('button', { name: /^New table|^Tabel baru/i })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /^New relation|^Relasi baru/i })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /^New area|^Area baru/i })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /^Tidy$|^Rapikan$/i })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /Export/i })).toBeTruthy();
    expect(within(pill).getByRole('button', { name: /^Import$/i })).toBeTruthy();
    expect(within(pill).queryByRole('button', { name: /More actions|Opsi lain/i })).toBeNull();
  });

  it('narrow: pill ringkas — Table + Relation + …; sheet berisi sisanya', () => {
    const realMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('640px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      mockLive();
      renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
      const dialog = canvasDialog();
      const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
      expect(within(pill).getByRole('button', { name: /^New table|^Tabel baru/i })).toBeTruthy();
      expect(within(pill).getByRole('button', { name: /^New relation|^Relasi baru/i })).toBeTruthy();
      expect(within(pill).queryByRole('button', { name: /^New area|^Area baru/i })).toBeNull();
      expect(within(pill).queryByRole('button', { name: /^Tidy$|^Rapikan$/i })).toBeNull();
      expect(within(pill).queryByRole('button', { name: /^Import$/i })).toBeNull();
      // Buka sheet … : New Area, Tidy, Export, Import.
      fireEvent.click(within(pill).getByRole('button', { name: /More actions|Opsi lain/i }));
      expect(screen.getByRole('button', { name: /^New area|^Area baru/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Tidy$|^Rapikan$/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Postgres DDL|DDL/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Import schema|^Impor skema/i })).toBeTruthy();
      // New Area dari sheet: dispatch + sheet tertutup.
      fireEvent.click(screen.getByRole('button', { name: /^New area|^Area baru/i }));
      const dispatch = useProjectMock.mock.results[0]?.value.dispatch as ReturnType<typeof vi.fn>;
      expect(dispatch).toHaveBeenCalledWith({
        type: 'area/add',
        area: expect.objectContaining({ name: 'Area 1', color: null, tableIds: [] }),
      });
      // Sheet tertutup (baris Export-nya hilang); tombol + panel Areas boleh ada.
      expect(screen.queryByRole('button', { name: /Postgres DDL/i })).toBeNull();
    } finally {
      window.matchMedia = realMatchMedia;
    }
  });

  it('mobile sheet: tap tab mengembang + ganti tab; tap tab aktif/handle menciut; Esc menciutkan', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    const sidebar = dialog.querySelector('.erd-sidebar') as HTMLElement | null;
    expect(sidebar).not.toBeNull();
    // Awal: peek — handle disembunyikan, toggle lewat tap tab.
    expect(sidebar!.className).not.toContain('erd-sheet-expanded');
    expect(
      within(dialog).queryByRole('button', { name: /Expand panel|Buka panel|Collapse panel|Tutup panel/i }),
    ).toBeNull();
    // Tap tab Areas: mengembang + tab berpindah + handle muncul.
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Areas$|^Area$/i }));
    expect(sidebar!.className).toContain('erd-sheet-expanded');
    expect(within(dialog).getByRole('tab', { name: /^Areas$|^Area$/i }).getAttribute('aria-selected')).toBe('true');
    const handle = within(dialog).getByRole('button', { name: /Collapse panel|Tutup panel/i });
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    // Tap tab aktif: menciut, handle hilang lagi.
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Areas$|^Area$/i }));
    expect(sidebar!.className).not.toContain('erd-sheet-expanded');
    expect(
      within(dialog).queryByRole('button', { name: /Expand panel|Buka panel|Collapse panel|Tutup panel/i }),
    ).toBeNull();
    // Expand via handle tak mungkin saat ciut — via tab, lalu tap handle + Esc.
    // Tap handle menciutkan + fokus kembali ke tab aktif.
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Areas$|^Area$/i }));
    expect(sidebar!.className).toContain('erd-sheet-expanded');
    fireEvent.click(within(dialog).getByRole('button', { name: /Collapse panel|Tutup panel/i }));
    expect(sidebar!.className).not.toContain('erd-sheet-expanded');
    expect(document.activeElement).toBe(
      within(dialog).getByRole('tab', { name: /^Areas$|^Area$/i }),
    );
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Areas$|^Area$/i }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(sidebar!.className).not.toContain('erd-sheet-expanded');
    expect(screen.queryByRole('dialog', { name: /ERD canvas/i })).toBeTruthy();
  });

  it('presentasi: tanpa chrome sheet (handle/tab bar ikut di-unmount)', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Presentasi$|^Present$/ }));
    expect(within(dialog).queryByRole('button', { name: /Expand panel|Buka panel|Collapse panel|Tutup panel/i })).toBeNull();
    expect(dialog.querySelector('.erd-sidebar')).toBeNull();
  });

  it('panel: tombol + di header Tables/Relations/Areas membuka alur tambah', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    // Tables + → modal tabel baru.
    const tablesPanel = document.querySelector('#erd-panel-tabpanel-tables') as HTMLElement;
    fireEvent.click(within(tablesPanel).getByRole('button', { name: /^New table|^Tabel baru/i }));
    expect(screen.getByPlaceholderText('users')).toBeTruthy();
    fireEvent.keyDown(screen.getByPlaceholderText('users'), { key: 'Escape' });
    // Relations + → modal relasi baru.
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Refs$|^Relasi$/i }));
    const relsPanel = document.querySelector('#erd-panel-tabpanel-relations') as HTMLElement;
    fireEvent.click(within(relsPanel).getByRole('button', { name: /^New relation|^Relasi baru/i }));
    expect(screen.getByRole('dialog', { name: /^New relation/i })).toBeTruthy();
  });

  it('panel: tombol + Areas dispatch area/add; viewer tanpa tombol +', () => {
    mockLive();
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Areas$|^Area$/i }));
    const areasPanel = document.querySelector('#erd-panel-tabpanel-areas') as HTMLElement;
    fireEvent.click(within(areasPanel).getByRole('button', { name: /^New area|^Area baru/i }));
    const dispatch = useProjectMock.mock.results[0]?.value.dispatch as ReturnType<typeof vi.fn>;
    expect(dispatch).toHaveBeenCalledWith({
      type: 'area/add',
      area: expect.objectContaining({ name: 'Area 1', color: null, tableIds: [] }),
    });
  });

  it('panel viewer: tanpa tombol + di semua tab', () => {
    mockLive({ canEdit: false });
    renderSchema('/p/p1?tab=schema&schemaView=erd&canvas=1');
    const dialog = canvasDialog();
    expect(
      within(document.querySelector('#erd-panel-tabpanel-tables') as HTMLElement).queryByRole('button', {
        name: /^New table|^Tabel baru/i,
      }),
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Refs$|^Relasi$/i }));
    expect(
      within(document.querySelector('#erd-panel-tabpanel-relations') as HTMLElement).queryByRole('button', {
        name: /^New relation|^Relasi baru/i,
      }),
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Areas$|^Area$/i }));
    expect(
      within(document.querySelector('#erd-panel-tabpanel-areas') as HTMLElement).queryByRole('button', {
        name: /^New area|^Area baru/i,
      }),
    ).toBeNull();
  });
});
