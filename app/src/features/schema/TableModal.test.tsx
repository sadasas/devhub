import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State, Table } from '../../lib/types';
import { TableModal } from './TableModal';

const { setStatusMock, fetchActivityMock, canEditMock, saveMock, mockDispatch } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
  fetchActivityMock: vi.fn(),
  canEditMock: { value: true },
  saveMock: { saving: false, lastSavedAt: null as number | null },
  mockDispatch: vi.fn(),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({
    state: mockState,
    dispatch: mockDispatch,
    canEdit: canEditMock.value,
    projectId: 'p1',
    saving: saveMock.saving,
    lastSavedAt: saveMock.lastSavedAt,
    setStatus: setStatusMock,
  }),
}));

vi.mock('../../lib/api', () => ({
  api: { fetchActivity: fetchActivityMock },
}));

const TABLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeTable(over: Partial<Table> = {}): Table {
  return {
    id: TABLE_ID,
    name: 'users',
    comment: '',
    columns: [{ id: 'c1', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' }],
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function makeState(): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [makeTable()],
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

describe('TableModal footer (Delete kiri + save-state kanan)', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    canEditMock.value = true;
    saveMock.saving = false;
    saveMock.lastSavedAt = null;
    setStatusMock.mockClear();
    fetchActivityMock.mockReset();
    fetchActivityMock.mockResolvedValue([]);
    mockState = makeState();
  });

  it('tanpa save pending: Delete ada, save-state tidak tampil', () => {
    render(<MemoryRouter><TableModal tableId={TABLE_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(document.querySelector('.save-state')).toBeNull();
  });

  it('saving=true: tampil Saving…', () => {
    saveMock.saving = true;
    render(<MemoryRouter><TableModal tableId={TABLE_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Saving…')).toBeTruthy();
  });

  it('tersimpan: CheckCircle + All changes saved di kanan Delete', () => {
    saveMock.saving = false;
    saveMock.lastSavedAt = Date.now();
    render(<MemoryRouter><TableModal tableId={TABLE_ID} onClose={vi.fn()} /></MemoryRouter>);
    const saved = screen.getByText('All changes saved');
    expect(saved).toBeTruthy();
    // Delete di kiri, save-state di kanan (space-between via :has).
    const footer = saved.closest('.modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del.compareDocumentPosition(saved) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('viewer: tanpa footer', () => {
    canEditMock.value = false;
    saveMock.lastSavedAt = Date.now();
    render(<MemoryRouter><TableModal tableId={TABLE_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(document.querySelector('.save-state')).toBeNull();
  });
});
