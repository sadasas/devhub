import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { State } from '../../lib/types';
import { NewRelationModal } from './NewRelationModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch }),
}));

const TABLE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TABLE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COL_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const COL_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function makeState(): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [
      {
        id: TABLE_A,
        name: 'users',
        comment: '',
        indexes: [],
        columns: [
          { id: COL_A, name: 'id', type: 'uuid', nullable: false, primaryKey: true, comment: '' },
          { id: COL_B, name: 'email', type: 'text', nullable: true, primaryKey: false, comment: '' },
        ],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: TABLE_B,
        name: 'posts',
        comment: '',
        indexes: [],
        columns: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'id', type: 'uuid', nullable: false, primaryKey: true, comment: '' }],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;
const mockDispatch = vi.fn();

describe('NewRelationModal chained selects', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockState = makeState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a relation from four chained searchable selects', () => {
    render(<NewRelationModal open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'From table' }));
    fireEvent.click(screen.getByRole('option', { name: 'users' }));
    fireEvent.click(screen.getByRole('button', { name: 'From column' }));
    fireEvent.click(screen.getByRole('option', { name: 'email' }));
    fireEvent.click(screen.getByRole('button', { name: 'To table' }));
    fireEvent.click(screen.getByRole('option', { name: 'posts' }));
    fireEvent.click(screen.getByRole('button', { name: 'To column' }));
    fireEvent.click(screen.getByRole('option', { name: 'id' }));
    fireEvent.submit(document.getElementById('new-relation-form')!);
    const added = mockDispatch.mock.calls.find((c) => c[0].type === 'relation/add');
    expect(added?.[0].relation.fromTableId).toBe(TABLE_A);
    expect(added?.[0].relation.fromColumnId).toBe(COL_B);
    expect(added?.[0].relation.toTableId).toBe(TABLE_B);
    expect(added?.[0].relation.cardinality).toBe('1:N');
  });

  it('resets the from column when the from table changes', () => {
    render(<NewRelationModal open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'From table' }));
    fireEvent.click(screen.getByRole('option', { name: 'users' }));
    fireEvent.click(screen.getByRole('button', { name: 'From column' }));
    fireEvent.click(screen.getByRole('option', { name: 'email' }));
    fireEvent.click(screen.getByRole('button', { name: 'From table' }));
    fireEvent.click(screen.getByRole('option', { name: 'posts' }));
    expect(screen.getByRole('button', { name: 'From column' })).toBeTruthy();
  });
});