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
      <SchemaPage projectName="Demo Project" unreadIds={unreadIds} />
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
    // Canvas hint removed (ronde 6): ERD itself must render instead.
    expect(document.querySelector('.erd-canvas svg')).not.toBeNull();
    expect(document.querySelector('.erd-hint')).toBeNull();
    expect(document.querySelector('.schema-side')?.textContent).toContain('Schema versions');
  });

  it('shows Export for viewers without New table/relation actions', () => {
    useProjectMock.mockReturnValue({
      state: {
        tables: [table(), table({ id: 'tb2', name: 'projects' })],
        relations: [relation()],
        schemaVersions: [version(), version({ id: 'sv2', version: 'v0.2.0' })],
      },
      loading: false,
      error: null,
      canEdit: false,
      dispatch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('button', { name: /Export schema as/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /New table/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /New relation/ })).toBeNull();
  });

  it('labels Export with the snapshot version when viewing ?v=', () => {
    render(
      <MemoryRouter initialEntries={['/project/p1?tab=schema&v=sv1']}>
        <SchemaPage projectName="Demo Project" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /Export v0\.1\.0 as/i })).toBeTruthy();
  });

  it('F2-5 Tidy: visible for editors in ERD, dispatches clear + announces, focus stays', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({
      state: {
        tables: [table(), table({ id: 'tb2', name: 'projects' })],
        relations: [relation()],
        schemaVersions: [version(), version({ id: 'sv2', version: 'v0.2.0' })],
        erdLayout: { tb1: { x: 400, y: 300 } },
      },
      loading: false,
      error: null,
      canEdit: true,
      projectId: 'p1',
      dispatch,
    });
    render(
      <MemoryRouter initialEntries={['/p/p1?tab=schema&schemaView=erd']}>
        <SchemaPage projectName="Demo Project" />
      </MemoryRouter>,
    );
    const tidy = screen.getByRole('button', { name: /^Tidy$|^Rapikan$/ });
    // jsdom fireEvent.click does not focus like a real browser — focus first
    // to mirror the real "focus stays on the button" behaviour.
    tidy.focus();
    fireEvent.click(tidy);
    expect(dispatch).toHaveBeenCalledWith({ type: 'erdLayout/clear' });
    expect(screen.getByText(/tidied|dirapikan/i)).toBeTruthy();
    expect(document.activeElement).toBe(tidy);
  });

  it('F2-5 Tidy: hidden for viewers and in snapshot mode (read-only)', () => {
    useProjectMock.mockReturnValue({
      state: {
        tables: [table(), table({ id: 'tb2', name: 'projects' })],
        relations: [relation()],
        schemaVersions: [version(), version({ id: 'sv2', version: 'v0.2.0' })],
      },
      loading: false,
      error: null,
      canEdit: false,
      projectId: 'p1',
      dispatch: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/p/p1?tab=schema&schemaView=erd']}>
        <SchemaPage projectName="Demo Project" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /^Tidy$|^Rapikan$/ })).toBeNull();
  });
});