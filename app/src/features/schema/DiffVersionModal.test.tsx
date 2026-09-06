import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Column, Relation, SchemaVersion, Table } from '../../lib/types';
import { DiffVersionModal } from './DiffVersionModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ setStatus: vi.fn() }),
}));

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const V3 = '33333333-3333-4333-8333-333333333333';

function makeVersion(over: Partial<SchemaVersion>): SchemaVersion {
  return {
    id: V1,
    version: '1.0.0',
    appliedAt: '2026-08-01T00:00:00.000Z',
    notes: 'Initial schema',
    snapshot: { tables: [], relations: [] },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('DiffVersionModal version selects', () => {
  it('lists all snapshot versions in both selects', () => {
    render(
      <MemoryRouter>
        <DiffVersionModal
          open
          onClose={vi.fn()}
          versions={[
            makeVersion({ id: V1, version: '1.0.0', appliedAt: '2026-08-01T00:00:00.000Z' }),
            makeVersion({ id: V2, version: '1.1.0', appliedAt: '2026-08-02T00:00:00.000Z' }),
            makeVersion({ id: V3, version: '1.2.0', appliedAt: '2026-08-03T00:00:00.000Z' }),
          ]}
        />
      </MemoryRouter>,
    );
    const from = screen.getByRole('button', { name: 'From (older)' });
    const to = screen.getByRole('button', { name: 'To (newer)' });
    expect(from.textContent).toContain('1.1.0');
    expect(to.textContent).toContain('1.2.0');
    fireEvent.click(from);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toHaveLength(3);
    expect(options.join(' ')).toContain('1.0.0');
    expect(options.join(' ')).toContain('1.2.0');
  });

  it('shows the diff summary after picking two versions', () => {
    render(
      <MemoryRouter>
        <DiffVersionModal
          open
          onClose={vi.fn()}
          versions={[
            makeVersion({ id: V1, version: '1.0.0', appliedAt: '2026-08-01T00:00:00.000Z' }),
            makeVersion({ id: V2, version: '1.1.0', appliedAt: '2026-08-02T00:00:00.000Z' }),
          ]}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'From (older)' }));
    fireEvent.click(screen.getByRole('option', { name: /1\.0\.0/ }));
    expect(screen.getByText(/Showing changes from 1.0.0 to 1.1.0/)).toBeTruthy();
  });
});

describe('DiffVersionModal modified sections (F3-2)', () => {
  const TABLE_USERS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const TABLE_TEAMS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const COL_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const COL_USER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const REL_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  function col(over: Partial<Column> = {}): Column {
    return {
      id: COL_ID,
      name: 'id',
      type: 'uuid',
      nullable: false,
      primaryKey: true,
      default: null,
      comment: '',
      ...over,
    };
  }

  function table(id: string, over: Partial<Table> = {}): Table {
    return {
      id,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      name: id === TABLE_TEAMS ? 'teams' : 'users',
      comment: '',
      columns: id === TABLE_TEAMS ? [col({ id: COL_USER_ID, name: 'user_id' })] : [col()],
      indexes: [],
      ...over,
    };
  }

  function relation(over: Partial<Relation> = {}): Relation {
    return {
      id: REL_ID,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      fromTableId: TABLE_USERS,
      fromColumnId: COL_ID,
      toTableId: TABLE_TEAMS,
      toColumnId: COL_USER_ID,
      cardinality: '1:N',
      onDelete: 'cascade',
      ...over,
    };
  }

  function renderModal(versions: SchemaVersion[]) {
    return render(
      <MemoryRouter>
        <DiffVersionModal open onClose={vi.fn()} versions={versions} />
      </MemoryRouter>,
    );
  }

  it('renders tables/columns/relations modified sections with change details', () => {
    renderModal([
      makeVersion({
        id: V1,
        version: '1.0.0',
        appliedAt: '2026-08-01T00:00:00.000Z',
        snapshot: { tables: [table(TABLE_USERS), table(TABLE_TEAMS)], relations: [relation()] },
      }),
      makeVersion({
        id: V2,
        version: '1.1.0',
        appliedAt: '2026-08-02T00:00:00.000Z',
        snapshot: {
          tables: [
            table(TABLE_USERS, { comment: 'core table', columns: [col({ type: 'text' })] }),
            table(TABLE_TEAMS),
          ],
          relations: [relation({ onDelete: 'restrict' })],
        },
      }),
    ]);
    expect(screen.getByText('Tables modified (1)')).toBeTruthy();
    expect(screen.getByText('comment: (empty) → core table')).toBeTruthy();
    expect(screen.getByText('Columns modified (1)')).toBeTruthy();
    expect(screen.getByText('type: uuid → text')).toBeTruthy();
    expect(screen.getByText('Relations changed (1)')).toBeTruthy();
    expect(screen.getByText('onDelete: cascade → restrict')).toBeTruthy();
    // Modified-only diff must not show the empty state (9-bucket check).
    expect(screen.queryByText(/No differences/)).toBeNull();
  });

  it('labels added relations human-readably from the to snapshot', () => {
    renderModal([
      makeVersion({
        id: V1,
        version: '1.0.0',
        appliedAt: '2026-08-01T00:00:00.000Z',
        snapshot: { tables: [table(TABLE_USERS), table(TABLE_TEAMS)], relations: [] },
      }),
      makeVersion({
        id: V2,
        version: '1.1.0',
        appliedAt: '2026-08-02T00:00:00.000Z',
        snapshot: { tables: [table(TABLE_USERS), table(TABLE_TEAMS)], relations: [relation()] },
      }),
    ]);
    expect(screen.getByText('Relations added (1)')).toBeTruthy();
    expect(screen.getByText('users.id → teams.user_id (1:N, cascade)')).toBeTruthy();
  });

  it('labels removed relations from the from snapshot and falls back to id prefix when endpoints are missing', () => {
    const MISSING_TABLE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const MISSING_COL = '99999999-9999-4999-8999-999999999999';
    renderModal([
      makeVersion({
        id: V1,
        version: '1.0.0',
        appliedAt: '2026-08-01T00:00:00.000Z',
        snapshot: {
          tables: [table(TABLE_USERS), table(TABLE_TEAMS)],
          relations: [
            relation(),
            relation({
              id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              fromTableId: MISSING_TABLE,
              fromColumnId: MISSING_COL,
              toTableId: MISSING_TABLE,
              toColumnId: MISSING_COL,
            }),
          ],
        },
      }),
      makeVersion({
        id: V2,
        version: '1.1.0',
        appliedAt: '2026-08-02T00:00:00.000Z',
        snapshot: { tables: [table(TABLE_USERS), table(TABLE_TEAMS)], relations: [] },
      }),
    ]);
    expect(screen.getByText('Relations removed (2)')).toBeTruthy();
    // Resolved from the from snapshot (tables still exist there).
    expect(screen.getByText('users.id → teams.user_id (1:N, cascade)')).toBeTruthy();
    // Dangling endpoints fall back to 8-char id prefixes.
    expect(screen.getByText('ffffffff.99999999 → ffffffff.99999999 (1:N, cascade)')).toBeTruthy();
  });

  it('shows No differences for identical snapshots', () => {
    const snap = { tables: [table(TABLE_USERS)], relations: [] as Relation[] };
    renderModal([
      makeVersion({ id: V1, version: '1.0.0', appliedAt: '2026-08-01T00:00:00.000Z', snapshot: snap }),
      makeVersion({
        id: V2,
        version: '1.1.0',
        appliedAt: '2026-08-02T00:00:00.000Z',
        snapshot: structuredClone(snap),
      }),
    ]);
    expect(screen.getByText(/No differences/)).toBeTruthy();
  });
});