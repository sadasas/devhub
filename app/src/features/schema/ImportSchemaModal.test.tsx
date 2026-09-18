import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportSchemaModal } from './ImportSchemaModal';
import type { Column, State, Table } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

const NOW = '2026-08-01T00:00:00.000Z';

const DDL_TWO = `CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL
);
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id UUID REFERENCES users(id)
);`;

const DRAWDB_JSON = JSON.stringify({
  title: 'fixture',
  database: 'Postgres',
  tables: [
    {
      id: 't-users',
      name: 'users',
      fields: [
        { id: 'f-u-id', name: 'id', type: 'UUID', primaryKey: true, nullable: false },
        { id: 'f-u-email', name: 'email', type: 'VARCHAR(255)', nullable: false },
      ],
    },
    {
      id: 't-posts',
      name: 'posts',
      fields: [
        { id: 'f-p-id', name: 'id', type: 'UUID', primaryKey: true, notNull: true },
        { id: 'f-p-author', name: 'author_id', type: 'UUID', nullable: true },
      ],
    },
  ],
  relationships: [
    {
      startTableId: 't-posts',
      startFieldId: 'f-p-author',
      endTableId: 't-users',
      endFieldId: 'f-u-id',
      cardinality: '1:N',
      onDelete: 'cascade',
    },
  ],
});

const DBML_TEXT = `Table users {
  id int [pk]
  email varchar
}`;

function col(id: string, name: string): Column {
  return { id, name, type: 'uuid', nullable: name !== 'id', primaryKey: name === 'id', default: null, comment: '' };
}

function tbl(id: string, name: string, columns: Column[] = [col(`${id}-c1`, 'id')]): Table {
  return { id, createdAt: NOW, updatedAt: NOW, name, comment: '', columns, indexes: [] };
}

function makeState(over: Partial<State> = {}): State {
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
    ...over,
  };
}

const mockDispatch = vi.fn();

function renderModal() {
  return render(
    <MemoryRouter>
      <ImportSchemaModal open onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

function pasteSource(value: string): void {
  fireEvent.change(screen.getByLabelText('Schema source'), { target: { value } });
}

function callsOf(type: string): Array<Record<string, unknown>> {
  return mockDispatch.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((a) => a['type'] === type);
}

describe('ImportSchemaModal', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    useProjectMock.mockReset();
    useProjectMock.mockReturnValue({ state: makeState(), dispatch: mockDispatch, setStatus: vi.fn() });
  });

  it('focuses the source textarea on open for keyboard-first use', () => {
    renderModal();
    expect(document.activeElement?.id).toBe('import-schema-textarea');
  });

  it('previews parse counts from pasted DDL without dispatching', () => {
    renderModal();
    pasteSource(DDL_TWO);
    // 2 tables, 4 columns, 1 relation, 0 skipped.
    expect(screen.getByText(/\+2 tables, \+4 columns, \+1 relations, 0 skipped/)).toBeTruthy();
    expect(screen.getByText('New (2)')).toBeTruthy();
    expect(screen.queryByText(/Skipped duplicates/)).toBeNull();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('merge skips case-insensitive duplicates, drops dangling relations, and auto-snapshots pre-import state', () => {
    useProjectMock.mockReturnValue({
      state: makeState({ tables: [tbl('ex-users', 'USERS', [col('ex-u-id', 'id'), col('ex-u-email', 'email')])] }),
      dispatch: mockDispatch,
      setStatus: vi.fn(),
    });
    renderModal();
    pasteSource(DDL_TWO);
    expect(screen.getByText(/\+1 tables, \+2 columns, \+0 relations, 2 skipped/)).toBeTruthy();
    expect(screen.getByText('New (1)')).toBeTruthy();
    expect(screen.getByText('Skipped duplicates (1)')).toBeTruthy();
    expect(screen.getByText(/1 relations skipped/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    // Auto-snapshot ON by default: version auto `v1`, notes default, pre-import snapshot.
    const snapshots = callsOf('schemaVersion/add');
    expect(snapshots).toHaveLength(1);
    const snap = snapshots[0]!['version'] as { version: string; notes: string; snapshot: { tables: Table[] } };
    expect(snap.version).toBe('v1');
    expect(snap.notes).toBe('Before import');
    expect(snap.snapshot.tables).toHaveLength(1);
    expect(snap.snapshot.tables[0]!.name).toBe('USERS');

    // Only the fresh table is added; the dangling relation is NOT dispatched.
    const added = callsOf('table/add');
    expect(added).toHaveLength(1);
    expect((added[0]!['table'] as Table).name).toBe('posts');
    expect(callsOf('relation/add')).toHaveLength(0);
    expect(callsOf('table/remove')).toHaveLength(0);
  });

  it('disables confirm and shows an InlineError when zero tables are valid', () => {
    renderModal();
    pasteSource('CREATE VIEW v AS SELECT 1;');
    expect(screen.getByText(/\+0 tables, \+0 columns, \+0 relations, 0 skipped/)).toBeTruthy();
    expect(screen.getByText(/No valid tables to import/)).toBeTruthy();
    expect(screen.getByText(/Line 1:/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('replace mode gates behind a separate confirm dialog with cascade copy', () => {
    useProjectMock.mockReturnValue({
      state: makeState({ tables: [tbl('ex-users', 'users', [col('ex-u-id', 'id')])] }),
      dispatch: mockDispatch,
      setStatus: vi.fn(),
    });
    renderModal();
    pasteSource(DDL_TWO);
    fireEvent.click(screen.getByLabelText(/Replace/));
    // Main confirm becomes Continue and dispatches nothing yet.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mockDispatch).not.toHaveBeenCalled();

    expect(screen.getByText('Replace 1 tables with 2 imported?')).toBeTruthy();
    expect(screen.getByText(/cascade/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(callsOf('schemaVersion/add')).toHaveLength(1);
    expect(callsOf('table/remove')).toHaveLength(1);
    expect(callsOf('table/add')).toHaveLength(2);
    // Replace imports every relation — endpoints all exist in the import set.
    expect(callsOf('relation/add')).toHaveLength(1);
  });

  it('auto-detects DrawDB JSON in Auto mode', () => {
    renderModal();
    pasteSource(DRAWDB_JSON);
    expect(screen.getByText(/\+2 tables, \+4 columns, \+1 relations, 0 skipped/)).toBeTruthy();
    expect(screen.getByText('New (2)')).toBeTruthy();
  });

  it('parses DBML in Auto mode and with explicit DBML selected', () => {
    renderModal();
    pasteSource(DBML_TEXT);
    // users: id int [pk] + email varchar → 1 table, 2 columns, 0 relations.
    expect(screen.getByText(/\+1 tables, \+2 columns, \+0 relations, 0 skipped/)).toBeTruthy();
    expect(screen.queryByText(/DBML import is coming soon/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(false);

    fireEvent.click(screen.getByLabelText('Postgres DDL'));
    pasteSource(DBML_TEXT);
    // Explicit DDL choice runs the DDL parser (DBML text → unsupported, 0 tables).
    expect(screen.queryByText(/DBML import is coming soon/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByLabelText('DBML'));
    expect(screen.getByText(/\+1 tables, \+2 columns, \+0 relations, 0 skipped/)).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('copy errors copies the per-line warnings to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      renderModal();
      pasteSource('CREATE VIEW v AS SELECT 1;');
      fireEvent.click(screen.getByRole('button', { name: 'Copy errors' }));
      expect(writeText).toHaveBeenCalledOnce();
      expect(String(writeText.mock.calls[0]![0])).toContain('Line 1:');
      expect(await screen.findByText('Copied')).toBeTruthy();
    } finally {
      // jsdom has no clipboard by default — remove the stub for other files.
      Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true });
    }
  });
});
