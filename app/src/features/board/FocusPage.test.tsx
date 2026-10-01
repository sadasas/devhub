import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Project, State, Task } from '../../lib/types';
import { FocusPage } from './FocusPage';

const { setStatusMock, listMembersMock, fetchActivityMock, gcalStatusMock, gcalSyncedMock } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
  listMembersMock: vi.fn(),
  fetchActivityMock: vi.fn(),
  gcalStatusMock: vi.fn().mockResolvedValue({ connected: false, expired: false, email: null, syncEnabled: false, lastSyncAt: null }),
  gcalSyncedMock: vi.fn().mockResolvedValue({ taskIds: [] }),
}));

vi.mock('../../state/projects-context', () => ({
  useProjects: () => ({ projects: mockProjects }),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({
    state: mockState,
    dispatch: mockDispatch,
    canEdit: true,
    projectId: 'p1',
    teamId: 'team1',
    saving: false,
    lastSavedAt: null,
    setStatus: setStatusMock,
  }),
  ProjectProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  wouldCreateCycle: () => false,
}));

vi.mock('../../state/auth-context', () => ({
  useOptionalAuth: () => ({ user: null }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    listMembers: listMembersMock,
    fetchActivity: fetchActivityMock,
    gcalStatus: gcalStatusMock,
    gcalSynced: gcalSyncedMock,
  },
}));

const PROJECT_ID = 'p1';
const TASK_ID = '55555555-5555-4555-8555-555555555555';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

function makeTask(over: Partial<Task>): Task {
  return {
    id: TASK_ID,
    title: 'Ship chat',
    status: 'todo',
    priority: 'medium',
    labels: [],
    blockedBy: [],
    milestoneId: null,
    description: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function makeState(): State {
  return {
    tasks: [makeTask({})],
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

function makeProjects(): Project[] {
  return [
    {
      id: PROJECT_ID,
      name: 'P',
      description: '',
      status: 'active',
      visibility: 'private',
      tabs: [],
      prd: { purpose: '', goals: '', features: '', scope: '', outOfScope: '' },
      teamId: 'team1',
      teamName: 'T',
      role: 'editor',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    } as Project,
  ];
}

let mockState: State;
let mockProjects: Project[] | null;
const mockDispatch = vi.fn();

function renderFocus(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/project/:projectId" element={<div>BOARD</div>} />
        <Route path="/project/:projectId/focus/:taskId" element={<FocusPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
}

describe('FocusPage', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    setStatusMock.mockClear();
    listMembersMock.mockReset();
    fetchActivityMock.mockReset();
    fetchActivityMock.mockResolvedValue([]);
    listMembersMock.mockResolvedValue([]);
    mockState = makeState();
    mockProjects = makeProjects();
    setScrollY(0);
  });

  afterEach(() => {
    setScrollY(0);
    vi.restoreAllMocks();
  });

  it('redirects an unknown task to the board', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${UNKNOWN_ID}`);
    expect(screen.getByText('BOARD')).toBeTruthy();
    expect(screen.queryByText('Ship chat')).toBeNull();
  });

  it('shows title, sidebar and timer', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(screen.getByText('Ship chat')).toBeTruthy();
    expect(document.querySelector('[data-prop="status"]')).toBeTruthy();
    expect(screen.getByText('25:00')).toBeTruthy();
  });

  it('dispatches mark-done from the topbar', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    const topbar = document.querySelector('.focus-topbar') as HTMLElement;
    fireEvent.click(within(topbar).getByRole('button', { name: 'Mark done' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { status: 'done' },
    });
  });

  it('exits to the board on Escape', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(screen.getByText('Ship chat')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('BOARD')).toBeTruthy();
  });

  it('exits to the board on Shift+F', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(screen.getByText('Ship chat')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'F', shiftKey: true });
    expect(screen.getByText('BOARD')).toBeTruthy();
  });

  it('topbar starts unscrolled at the top', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    const topbar = document.querySelector('.focus-topbar');
    expect(topbar).toBeTruthy();
    expect(topbar!.classList.contains('focus-topbar--scrolled')).toBe(false);
  });

  it('topbar gains scrolled class after scroll and loses it back at top', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    const topbar = document.querySelector('.focus-topbar') as HTMLElement;
    expect(topbar.classList.contains('focus-topbar--scrolled')).toBe(false);
    setScrollY(120);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(topbar.classList.contains('focus-topbar--scrolled')).toBe(true);
    setScrollY(0);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(topbar.classList.contains('focus-topbar--scrolled')).toBe(false);
  });

  it('unmount removes the scroll listener without error', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(document.querySelector('.focus-topbar')).toBeTruthy();
    expect(() => unmount()).not.toThrow();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();
  });

  it('bottom bar renders when todo and dispatches mark-done', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    const bar = document.querySelector('.focus-bottombar');
    expect(bar).toBeTruthy();
    const btn = bar!.querySelector('button');
    expect(btn?.textContent).toContain('Mark done');
    fireEvent.click(btn!);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { status: 'done' },
    });
  });

  it('bottom bar is absent when the task is done', () => {
    mockState.tasks[0]!.status = 'done';
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(document.querySelector('.focus-bottombar')).toBeNull();
  });

  it('props toggle collapses the sidebar rows', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(document.querySelector('[data-prop="status"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(document.querySelector('[data-prop="status"]')).toBeNull();
    expect(document.querySelector('[data-prop="priority"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(document.querySelector('[data-prop="status"]')).toBeTruthy();
  });

  it('badges row exists with status and priority chips', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    const badges = document.querySelector('.focus-badges');
    expect(badges).toBeTruthy();
    expect(badges!.textContent).toContain('Todo');
    expect(badges!.textContent).toContain('Medium');
  });
});
