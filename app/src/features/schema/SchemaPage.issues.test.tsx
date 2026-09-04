import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function validTables(): Table[] {
  return [
    table({
      id: 'tb1',
      name: 'users',
      columns: [
        { id: 'c1', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' },
      ],
      indexes: ['id'],
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

function mockLive(tables: Table[], relations: Relation[] = []) {
  useProjectMock.mockReturnValue({
    state: { tables, relations, schemaVersions: [version()] },
    loading: false,
    error: null,
    canEdit: true,
    dispatch: vi.fn(),
  });
}

function renderErd(route = '/p/p1?tab=schema&schemaView=erd') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SchemaPage projectName="Demo Project" />
    </MemoryRouter>,
  );
}

function renderCanvas() {
  return renderErd('/p/p1?tab=schema&schemaView=erd&canvas=1');
}

function canvasPanel(): HTMLElement {
  const dialog = screen.getByRole('dialog', { name: /ERD canvas|Kanvas ERD/i });
  return within(dialog).getByRole('complementary', { name: /properties|properti/i });
}

function panelToggle(p: HTMLElement): HTMLElement {
  const btn = p.querySelector('.erd-panel-issues .schema-issues-head-button');
  if (!btn) throw new Error('panel issues toggle not found');
  return btn as HTMLElement;
}

describe('SchemaPage F2-3 issues badge + strip', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
  });

  it('nol issue: no badge, no strip in ERD view', () => {
    mockLive(validTables(), []);
    renderErd();
    expect(screen.queryByRole('button', { name: /schema issues/i })).toBeNull();
    expect(document.querySelector('.schema-issues-strip')).toBeNull();
    expect(document.querySelector('#schema-issues-strip')).toBeNull();
  });

  it('nol issue: badge hidden in Tables view even with issues present', () => {
    mockLive(buggyTables(), []);
    render(
      <MemoryRouter initialEntries={['/p/p1?tab=schema&schemaView=tables']}>
        <SchemaPage projectName="Demo Project" />
      </MemoryRouter>,
    );
    // Badge only in ERD view per spec.
    expect(screen.queryByRole('button', { name: /schema issues/i })).toBeNull();
    expect(document.querySelector('.schema-issues-strip')).toBeNull();
  });

  it('N issue: badge Issues:N + strip <ul> with Locate + Open table (live)', () => {
    mockLive(buggyTables(), []);
    renderErd();
    const badge = screen.getByRole('button', { name: /2 schema issues/i });
    expect(badge.textContent).toMatch(/Issues?:\s*2/);
    // Ronde 6: badge bukan toggle (tanpa aria-expanded) — collapse via header.
    expect(badge.getAttribute('aria-expanded')).toBeNull();
    expect(badge.getAttribute('aria-controls')).toBe('schema-issues-strip');

    const strip = document.querySelector('#schema-issues-strip');
    expect(strip).not.toBeNull();
    const list = strip?.querySelector('ul');
    expect(list).not.toBeNull();
    const rows = strip?.querySelectorAll('li');
    expect(rows?.length).toBe(2);

    // Each row: warn icon + human message (label + lint message) + Locate.
    const locates = screen.getAllByRole('button', { name: /Locate|Temukan/i });
    expect(locates.length).toBe(2);
    // pk-null + index-typo are column/index type -> second Open table button per row.
    const opens = screen.getAllByRole('button', { name: /Open table|Buka tabel/i });
    expect(opens.length).toBe(2);
  });

  it('badge membuka + fokus strip, tidak toggle; collapse via header', async () => {
    mockLive(buggyTables(), []);
    renderErd();
    const badge = screen.getByRole('button', { name: /2 schema issues/i });
    expect(document.querySelector('#schema-issues-strip')).not.toBeNull();
    // Klik badge saat terbuka: tetap terbuka + fokus ke strip (rAF).
    fireEvent.click(badge);
    expect(document.querySelector('#schema-issues-strip')).not.toBeNull();
    await waitFor(() => {
      expect(document.activeElement?.classList.contains('schema-issues-focus')).toBe(true);
    });
    // Collapse hanya via header strip — header tetap terlihat.
    const header = document.querySelector('#schema-issues-title.schema-issues-head-button');
    expect(header).not.toBeNull();
    fireEvent.click(header!);
    expect(document.querySelector('#schema-issues-list')).toBeNull();
    expect(document.querySelector('#schema-issues-title')).not.toBeNull();
    // Badge membuka kembali.
    fireEvent.click(badge);
    expect(document.querySelector('#schema-issues-list')).not.toBeNull();
  });

  it('Locate dipanggil: centers ERD + highlights node 2s', async () => {
    mockLive(buggyTables(), []);
    renderErd();
    const locates = screen.getAllByRole('button', { name: /Locate|Temukan/i });
    expect(locates.length).toBeGreaterThan(0);
    fireEvent.click(locates[0]!);
    await waitFor(() => {
      expect(document.querySelector('.erd-table-highlight')).not.toBeNull();
    });
    expect(document.querySelector('.erd-table-highlight')?.getAttribute('data-table-id')).toBe('tb1');
  });

  it('snapshot mode: issues from snapshot, Locate pans without Open table', async () => {
    const live = validTables();
    const snap = buggyTables();
    useProjectMock.mockReturnValue({
      state: {
        tables: live,
        relations: [],
        schemaVersions: [version({ id: 'sv1', version: 'v0.1.0', snapshot: { tables: snap, relations: [] } })],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: vi.fn(),
    });
    renderErd('/p/p1?tab=schema&schemaView=erd&v=sv1');
    // Snapshot-safe count comes from the snapshot (2 issues), not live (0).
    const badge = screen.getByRole('button', { name: /2 schema issues/i });
    expect(badge.textContent).toMatch(/Issues?:\s*2/);
    expect(document.querySelector('#schema-issues-strip')).not.toBeNull();
    // Read-only snapshot: Locate stays, Open table hidden.
    expect(screen.getAllByRole('button', { name: /Locate|Temukan/i }).length).toBe(2);
    expect(screen.queryByRole('button', { name: /Open table|Buka tabel/i })).toBeNull();
    // Locate still pans/highlights in snapshot mode.
    fireEvent.click(screen.getAllByRole('button', { name: /Locate|Temukan/i })[0]!);
    await waitFor(() => {
      expect(document.querySelector('.erd-table-highlight')).not.toBeNull();
    });
  });
});

describe('SchemaPage U5 issues in props panel (collapsible, bottom-most)', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    document.body.style.overflow = '';
  });

  it('canvas expanded: issues section is bottom-most in the panel with toggle [aria-expanded/controls]', () => {
    mockLive(buggyTables(), []);
    renderCanvas();
    const p = canvasPanel();
    const section = document.querySelector('#erd-panel-issues-strip');
    expect(section).not.toBeNull();
    expect(p.contains(section)).toBe(true);
    expect(p.lastElementChild?.getAttribute('id')).toBe(
      'erd-panel-issues-strip',
    );
    expect(within(p).getByText(/Schema issues \(2\)|Masalah schema \(2\)/i)).toBeTruthy();
    const toggle = panelToggle(p);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe('erd-panel-issues-list');
    const body = document.querySelector('#erd-panel-issues-list');
    expect(body).not.toBeNull();
    expect(body?.querySelectorAll('li').length).toBe(2);
    // No duplicate legacy ids in canvas mode (regular strip hidden).
    expect(document.querySelectorAll('#schema-issues-strip').length).toBe(0);
  });

  it('canvas collapsed: panel toggle hides the list, toolbar pill has no badge (ronde 3)', () => {
    mockLive(buggyTables(), []);
    renderCanvas();
    const dialog = screen.getByRole('dialog', { name: /ERD canvas|Kanvas ERD/i });
    const pill = within(dialog).getByRole('toolbar', { name: /canvas tools|peralatan kanvas/i });
    // Ronde 3 ITEM 3b: badge dihapus dari pill toolbar — count hanya di panel.
    expect(within(pill).queryByRole('button', { name: /schema issues|masalah schema/i })).toBeNull();
    expect(document.querySelector('.erd-canvas-mode-pill .schema-issues-badge')).toBeNull();
    const p = canvasPanel();
    fireEvent.click(panelToggle(p));
    expect(document.querySelector('#erd-panel-issues-list')).toBeNull();
    expect(panelToggle(p).getAttribute('aria-expanded')).toBe('false');
    // Header stays with count N in the panel (bottom-most section).
    expect(within(p).getByText(/Schema issues \(2\)|Masalah schema \(2\)/i)).toBeTruthy();
    // Panel toggle re-expands the same list.
    fireEvent.click(panelToggle(p));
    expect(document.querySelector('#erd-panel-issues-list')).not.toBeNull();
    expect(panelToggle(p).getAttribute('aria-expanded')).toBe('true');
  });

  it('regular ERD tab unchanged: legacy strip above relation-list, no panel ids', () => {
    const rel: Relation = {
      id: 'r1',
      fromTableId: 'tb1',
      fromColumnId: 'c1',
      toTableId: 'tb2',
      toColumnId: 'c2',
      cardinality: '1:N',
      onDelete: 'cascade',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockLive(buggyTables(), [rel]);
    renderErd();
    const strip = document.querySelector('#schema-issues-strip');
    expect(strip).not.toBeNull();
    expect(strip?.classList.contains('erd-panel-issues')).toBe(false);
    expect(document.querySelector('#erd-panel-issues-strip')).toBeNull();
    expect(document.querySelectorAll('#schema-issues-strip').length).toBe(1);
    const badge = screen
      .getAllByRole('button', { name: /schema issues|masalah schema/i })
      .find((b) => b.getAttribute('aria-controls') === 'schema-issues-strip');
    expect(badge).toBeDefined();
    expect(badge!.getAttribute('aria-controls')).toBe('schema-issues-strip');
    const relationList = document.querySelector('.relation-list');
    expect(relationList).not.toBeNull();
    // Strip stays above the relation list (legacy order preserved).
    expect(strip!.compareDocumentPosition(relationList!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip?.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('canvas locate still works from the panel list (Locate/Open reuse)', async () => {
    mockLive(buggyTables(), []);
    renderCanvas();
    const p = canvasPanel();
    const locates = within(p).getAllByRole('button', { name: /Locate|Temukan/i });
    expect(locates.length).toBe(2);
    // Open table actions reused 100% in live mode.
    expect(within(p).getAllByRole('button', { name: /Open table|Buka tabel/i }).length).toBe(2);
    fireEvent.click(locates[0]!);
    await waitFor(() => {
      expect(document.querySelector('.erd-table-highlight')).not.toBeNull();
    });
    expect(document.querySelector('.erd-table-highlight')?.getAttribute('data-table-id')).toBe('tb1');
  });

  it('zero issues: panel section auto-collapsed with "No issues", regular tab stays hidden', () => {
    mockLive(validTables(), []);
    renderCanvas();
    const p = canvasPanel();
    // U5 choice: zero issues stays mounted auto-collapsed (honest vs disappearing).
    expect(document.querySelector('#erd-panel-issues-strip')).not.toBeNull();
    expect(panelToggle(p).getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('#erd-panel-issues-list')).toBeNull();
    // Toolbar pill never shows a badge in canvas mode (ronde 3 ITEM 3b).
    expect(document.querySelector('.erd-canvas-mode-pill .schema-issues-badge')).toBeNull();
    fireEvent.click(panelToggle(p));
    expect(panelToggle(p).getAttribute('aria-expanded')).toBe('true');
    expect(within(p).getByText(/No issues|Tidak ada masalah/i)).toBeTruthy();
  });
});
