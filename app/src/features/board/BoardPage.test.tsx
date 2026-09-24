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
    projectId: 'p1',
    loading: false,
    error: null,
    setStatus: setStatusMock,
  }),
  wouldCreateCycle: () => false,
}));

vi.mock('../../state/auth-context', () => ({
  useOptionalAuth: () => ({ user: { id: 'u1', email: 'me@gmail.com' } }),
}));

vi.mock('../../lib/api', () => {
  class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    ApiError,
    api: {
      listMembers: listMembersMock,
      fetchActivity: fetchActivityMock,
      // GCalSettings (mounted in calendar view): default disconnected.
      gcalStatus: vi.fn().mockResolvedValue({
        connected: false,
        expired: false,
        email: null,
        syncEnabled: false,
        lastSyncAt: null,
      }),
      gcalSynced: vi.fn().mockResolvedValue({ taskIds: [] }),
      gcalSetSync: vi.fn(),
      gcalDisconnect: vi.fn(),
      gcalConnectUrl: vi.fn((id: string) => `/api/v1/integrations/gcal/connect?projectId=${id}`),
    },
  };
});

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
    { id: 'u1', email: 'me@gmail.com', displayName: 'Me' },
    { id: 'u2', email: 'other@gmail.com', displayName: 'Other' },
  ]);
  mockState = makeState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function openFilterMenu() {
  fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
}

describe('BoardPage only my tasks filter', () => {
  it('shows all tasks and no mine param by default', () => {
    renderBoard();
    expect(document.querySelectorAll('[data-testid="task-card"]').length).toBe(3);
    expect(screen.getByTestId('url-probe').textContent).not.toContain('mine');
  });

  it('filters columns to the current user when toggled and persists ?mine=1', () => {
    renderBoard();
    openFilterMenu();
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
    openFilterMenu();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only my tasks' }));
    expect(document.querySelectorAll('[data-testid="task-card"]').length).toBe(3);
    expect(screen.getByTestId('url-probe').textContent).not.toContain('mine');
  });

  it('applies the filter to column counts', () => {
    renderBoard();
    const todoCount = () =>
      document.querySelector('[data-testid="kanban-col-todo"] .kanban-col-count')?.textContent;
    expect(todoCount()).toBe('3');
    openFilterMenu();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only my tasks' }));
    expect(todoCount()).toBe('2');
  });

  it('persists the filter across view changes', () => {
    renderBoard('/?mine=1');
    fireEvent.click(screen.getByRole('button', { name: 'By Milestone' }));
    expect(screen.getByTestId('url-probe').textContent).toContain('mine=1');
    expect(document.querySelectorAll('[data-testid="task-card"]').length).toBe(2);
  });
});

describe('BoardPage status swipe (narrow)', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('767px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('renders 4 swipe tabs without chevrons or dots', () => {
    renderBoard();
    expect(document.querySelector('[data-testid="kanban-swipe"]')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      expect.stringContaining('Todo'),
      expect.stringContaining('In Progress'),
      expect.stringContaining('Review'),
      expect.stringContaining('Done'),
    ]);
    expect(screen.queryByRole('button', { name: /Previous|Next/ })).toBeNull();
    expect(document.querySelector('.kanban-swipe-nav-btn')).toBeNull();
    expect(document.querySelector('.kanban-dots')).toBeNull();
    expect(document.querySelector('.kanban-dot')).toBeNull();
  });

  it('switches columns via tabs', () => {
    renderBoard();
    expect(document.querySelector('.kanban-swipe-tab.is-active')?.textContent).toContain('Todo');
    fireEvent.click(screen.getByRole('tab', { name: /Review/ }));
    expect(document.querySelector('.kanban-swipe-tab.is-active')?.textContent).toContain('Review');
    fireEvent.click(screen.getByRole('tab', { name: /Done/ }));
    expect(document.querySelector('.kanban-swipe-tab.is-active')?.textContent).toContain('Done');
  });

  it('renders full non-draggable cards with a live region', () => {
    renderBoard();
    const cards = document.querySelectorAll('[data-testid="task-card"]');
    expect(cards.length).toBe(3);
    cards.forEach((c) => {
      expect(c.classList.contains('task-card--compact')).toBe(false);
      expect(c.getAttribute('draggable')).toBe('false');
    });
    expect(document.querySelector('.kanban--swipe [role="status"]')?.textContent).toContain('Todo');
  });

  it('uses the short Task label on the swipe add button', () => {
    renderBoard();
    const add = document.querySelector('.kanban--swipe .kanban-add-btn');
    expect(add?.textContent).toContain('Task');
    expect(add?.textContent).not.toContain('Add task');
  });

  it('renders the view switcher as a group of toggle buttons', () => {
    renderBoard();
    expect(screen.getByRole('group', { name: 'Board view' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'By Status' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles the CSS fullscreen overlay without the Fullscreen API', () => {
    renderBoard();
    const fsBtn = screen.getByRole('button', { name: /Fullscreen/ });
    expect(document.querySelector('.board-shell--fullscreen')).toBeNull();
    fireEvent.click(fsBtn);
    expect(document.querySelector('.board-shell--fullscreen')).toBeTruthy();
    // Esc exits the overlay.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.board-shell--fullscreen')).toBeNull();
  });
});

describe('BoardPage calendar toolbar filters', () => {
  it('hides the sort trigger in calendar mode, filters inside the filter menu', async () => {
    renderBoard('/?view=calendar');
    // Tak ada opsi sort di mode kalender → trigger Sort disembunyikan total.
    expect(screen.queryByRole('button', { name: 'Sort' })).toBeNull();
    const filterTrigger = screen.getByRole('button', { name: 'Filter' });
    const actions = filterTrigger.closest('.board-toolbar-actions')!;
    expect(actions).toBeTruthy();
    const fsBtn = screen.getByRole('button', { name: /Fullscreen/ });
    expect(fsBtn.closest('.board-toolbar-actions')).toBe(actions);
    fireEvent.click(filterTrigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Only my tasks' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Hide completed' })).toBeTruthy();
  });

  it('hides completed chips when Hide completed is toggled', async () => {
    mockState.tasks = [
      makeTask('55555555-5555-4555-8555-555555555555', 'Done chip', 'u1', 'done'),
      makeTask('66666666-6666-4666-8666-666666666666', 'Open chip', 'u1', 'todo'),
    ];
    mockState.tasks[0]!.dueDate = '2026-09-08';
    mockState.tasks[1]!.dueDate = '2026-09-08';
    renderBoard('/?view=calendar');
    await screen.findByText('Open chip');
    expect(screen.getByText('Done chip')).toBeTruthy();
    openFilterMenu();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide completed' }));
    expect(screen.queryByText('Done chip')).toBeNull();
    expect(screen.getByText('Open chip')).toBeTruthy();
  });
});