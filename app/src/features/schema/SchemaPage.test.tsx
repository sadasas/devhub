import { fireEvent, render, screen } from '@testing-library/react';
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

function renderPage(unreadIds?: ReadonlySet<string>) {
  return render(
    <MemoryRouter>
      <SchemaPage unreadIds={unreadIds} />
    </MemoryRouter>,
  );
}

describe('SchemaPage', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        tables: [table(), table({ id: 'tb2', name: 'projects' })],
        relations: [relation()],
        schemaVersions: [version(), version({ id: 'sv2', version: 'v0.2.0' })],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: vi.fn(),
    });
  });

  it('marks tables and schema versions with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['tb1', 'sv1']));
    expect(document.querySelectorAll('.unread-pill').length).toBe(2);
    expect(screen.getAllByText('New').length).toBe(2);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-pill').length).toBe(0);
  });

  it('keeps the versions panel visible in both sub-views', async () => {
    renderPage();
    expect(document.querySelector('.schema-layout')).not.toBeNull();
    const side = document.querySelector('.schema-side');
    expect(side?.textContent).toContain('Schema versions');

    fireEvent.click(screen.getByRole('tab', { name: /ERD/ }));
    expect(await screen.findByText(/drag to pan/)).toBeDefined();
    expect(document.querySelector('.schema-side')?.textContent).toContain('Schema versions');
  });
});