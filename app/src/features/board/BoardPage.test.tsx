import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router';
import type { State, Task } from '../../lib/types';
import { BoardPage } from './BoardPage';

const { listMembersMock, fetchActivityMock, setStatusMock } = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  fetchActivityMock: vi.fn(),
  setStatusMock: vi.fn(),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({
    state: mockState,
    dispatch: vi.fn(),
    canEdit: true,
    teamId: 'team1',
    loading: false,
    error: null,
    setStatus: setStatusMock,
  }),
  wouldCreateCycle: () => false,
}));

vi.mock('../../state/auth-context', () => ({
  useOptionalAuth: () => ({ user: { id: 'u1', email: 'me@test.dev' } }),
}));

vi.mock('../../lib/api', () => ({
  api: { listMembers: listMembersMock, fetchActivity: fetchActivityMock },
}));

function makeTask(id: string, title: string, assigneeId: string | null, status = 'todo'): Task {
  return {
    id,
    title,
    status: status as Task['status'],
    priority: 'medium',
    labels: [],
    blockedBy: [],
    assigneeId,
    milestoneId: null,
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeState(): State {
  return {
    tasks: [
      makeTask('55555555-5555-4555-8555-555555555555', 'My task', 'u1'),
      makeTask('66666666-6666-4666-8666-666666666666', 'Also mine', 'u1'),
      makeTask('77777777-7777-4777-8777-777777777777', 'Someone elses', 'u2'),
    ],
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
  };
}

let mockState: State;

function SearchProbe() {
  const [params] = useSearchParams();
  return <span data-testid="url-probe">{params.toString()}</span>;
}

function renderBoard(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BoardPage unreadIds={new Set()} />
      <SearchProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listMembersMock.mockReset();
  fetchActivityMock.mockReset();
  fetchActivityMock.mockResolvedValue({ items: [] });
  listMembersMock.mockResolvedValue([
    { id: 'u1', email: 'me@test.dev', displayName: 'Me' },
    { id: 'u2', email: 'other@test.dev', displayName: 'Other' },
  ]);
  mockState = makeState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BoardPage only my tasks filter', () => {
  it('shows all tasks and no mine param by default', () => {
    renderBoard();
    expect(document.querySelectorAll('[data-testid="task-card"]').length).toBe(3);
    expect(screen.getByTestId('url-probe').textContent).not.toContain('mine');
  });

  it('filters columns to the current user when toggled and persists ?mine=1', () => {
    renderBoard();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only my tasks' }));
    expect(document.querySelectorAll('[data-testid="task-card"]').length).toBe(2);
    expect(screen.getByTestId('url-probe').textContent).toContain('mine=1');
    expect(screen.queryByText('Someone elses')).toBeNull();
    expect(screen.getByText('My task')).toBeTruthy();
    expect(screen.getByText('Also mine')).toBeTruthy();
  });

  it('restores all tasks when toggled off', () => {
    renderBoard('/?mine=1');
    expect(document.querySelectorAll('[data-testid="task-card"]').length).toBe(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only my tasks' }));
    expect(document.querySelectorAll('[data-testid="task-card"]').length).toBe(3);
    expect(screen.getByTestId('url-probe').textContent).not.toContain('mine');
  });

  it('applies the filter to column counts', () => {
    renderBoard();
    const todoCount = () =>
      document.querySelector('[data-testid="kanban-col-todo"] .kanban-col-count')?.textContent;
    expect(todoCount()).toBe('3');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only my tasks' }));
    expect(todoCount()).toBe('2');
  });

  it('persists the filter across view changes', () => {
    renderBoard('/?mine=1');
    fireEvent.click(screen.getByRole('tab', { name: 'By Milestone' }));
    expect(screen.getByTestId('url-probe').textContent).toContain('mine=1');
    expect(document.querySelectorAll('[data-testid="task-card"]').length).toBe(2);
  });
});