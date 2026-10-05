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

  it('shows title, props list and timer', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(screen.getByText('Ship chat')).toBeTruthy();
    const props = document.querySelector('.focus-detail-props') as HTMLElement;
    expect(props).toBeTruthy();
    expect(props.textContent).toContain('Status');
    expect(props.textContent).toContain('Priority');
    expect(screen.getByText('25:00')).toBeTruthy();
  });

  it('dispatches mark-done from the topbar', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    const topbar = document.querySelector('.focus-topbar') as HTMLElement;
    fireEvent.click(within(topbar).getByRole('button', { name: 'Done' }));
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

  it('has no bottombar (wireframe 02: single Done action lives in the topbar)', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(document.querySelector('.focus-bottombar')).toBeNull();
  });

  it('shows full-width Done bar and marks done on click', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    const bar = document.querySelector('.focus-done-bar') as HTMLElement;
    expect(bar).toBeTruthy();
    fireEvent.click(within(bar).getByRole('button', { name: 'Done' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { status: 'done' },
    });
  });

  it('hides the full-width Done bar when task is done', () => {
    mockState.tasks[0] = makeTask({ status: 'done' });
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(document.querySelector('.focus-done-bar')).toBeNull();
  });

  it('props toggle collapses the 10-row properties list', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(document.querySelector('.focus-detail-props')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'Hide details' });
    fireEvent.click(toggle);
    expect(document.querySelector('.focus-detail-props')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show task details' }));
    const props = document.querySelector('.focus-detail-props') as HTMLElement;
    expect(props).toBeTruthy();
    expect(props.textContent).toContain('Status');
    expect(props.textContent).toContain('Test cases');
  });

  it('meta row shows priority without legacy badges/created rows', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(document.querySelector('.focus-badges')).toBeNull();
    expect(document.querySelector('.detail-created')).toBeNull();
    expect(document.querySelector('.focus-detail-meta')).toBeTruthy();
    expect(document.querySelector('.focus-detail-meta')!.textContent).toContain('Medium');
  });

  it('subtask composer shows no hint and outside click closes + resets', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(screen.queryByText('Enter to add')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /New subtask/i }));
    const box = screen.getByRole('textbox', { name: 'New subtask…' });
    fireEvent.change(box, { target: { value: 'draft yarg' } });
    expect(screen.queryByText('Enter to add')).toBeNull();
    fireEvent.click(document.body);
    expect(screen.queryByRole('textbox', { name: 'New subtask…' })).toBeNull();
  });

  it('checklist input closes + resets on outside click', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    fireEvent.click(screen.getByRole('button', { name: /New item/i }));
    const box = screen.getByRole('textbox', { name: 'New item…' });
    fireEvent.change(box, { target: { value: 'draft item' } });
    fireEvent.click(document.body);
    expect(screen.queryByRole('textbox', { name: 'New item…' })).toBeNull();
  });

  it('clicking checklist add while subtask composer open switches composers', () => {
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    fireEvent.click(screen.getByRole('button', { name: /New subtask/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New subtask…' }), {
      target: { value: 'draft yarg' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New item/i }));
    expect(screen.queryByRole('textbox', { name: 'New subtask…' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'New item…' })).toBeTruthy();
  });

  it('parent picker opens its popup immediately on click', () => {
    mockState.tasks.push(makeTask({ id: 'parent-1-id', title: 'Parent candidate' }));
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    fireEvent.click(screen.getByRole('button', { name: 'Make subtask of…' }));
    // Tombol pembuka tetap tampil (jangkar popup), tanpa baris trigger tambahan.
    expect(screen.getByRole('button', { name: 'Make subtask of…' })).toBeTruthy();
    expect(document.querySelector('#task-parent-picker')).toBeNull();
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByRole('option', { name: /Parent candidate/ })).toBeTruthy();
  });

  it('clicking subtask add while checklist input open switches composers', () => {    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    fireEvent.click(screen.getByRole('button', { name: /New item/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New item…' }), {
      target: { value: 'draft item' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New subtask/i }));
    expect(screen.queryByRole('textbox', { name: 'New item…' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'New subtask…' })).toBeTruthy();
  });

  it('subtask detail shows parent pill and info without subtask tools', () => {
    mockState.tasks.push(makeTask({ id: 'parent-9', title: 'Rapikan halaman login', status: 'todo' }));
    mockState.tasks[0] = makeTask({ parentTaskId: 'parent-9', title: 'd' });
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(screen.getByText('Subtask of Rapikan halaman login')).toBeTruthy();
    expect(screen.getByText(/can't have subtasks of its own/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /New subtask/i })).toBeNull();
    expect(screen.queryByText('Make subtask of…')).toBeNull();
  });

  it('subtask crumb navigates back to the parent', () => {
    mockState.tasks.push(makeTask({ id: 'parent-9', title: 'Rapikan halaman login', status: 'todo' }));
    mockState.tasks[0] = makeTask({ parentTaskId: 'parent-9', title: 'd' });
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    fireEvent.click(screen.getByRole('button', { name: 'Back to parent task' }));
    expect(screen.getByRole('button', { name: /New subtask/i })).toBeTruthy();
  });

  it('subtask detach dispatches parentTaskId null', () => {
    mockState.tasks.push(makeTask({ id: 'parent-9', title: 'Rapikan halaman login', status: 'todo' }));
    mockState.tasks[0] = makeTask({ parentTaskId: 'parent-9', title: 'd' });
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    fireEvent.click(screen.getByRole('button', { name: 'Detach' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { parentTaskId: null },
    });
  });
});
