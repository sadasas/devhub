import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Project, State, Task } from '../../lib/types';
import { FocusPage } from './FocusPage';

const { setStatusMock, listMembersMock, fetchActivityMock, gcalStatusMock, gcalSyncedMock, trackMock, flagMock } =
  vi.hoisted(() => ({
    setStatusMock: vi.fn(),
    listMembersMock: vi.fn(),
    fetchActivityMock: vi.fn(),
    gcalStatusMock: vi.fn().mockResolvedValue({ connected: false, expired: false, email: null, syncEnabled: false, lastSyncAt: null }),
    gcalSyncedMock: vi.fn().mockResolvedValue({ taskIds: [] }),
    trackMock: vi.fn(),
    flagMock: vi.fn(() => true),
  }));

// Mock the wrapper module — never posthog-js directly.
vi.mock('../../lib/analytics', () => ({
  track: trackMock,
  useFeatureFlag: flagMock,
  FOCUS_MODE_FLAG: 'focus-mode-enabled',
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

describe('FocusPage analytics + kill-switch', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    trackMock.mockReset();
    flagMock.mockReset();
    flagMock.mockReturnValue(true);
    setStatusMock.mockClear();
    listMembersMock.mockReset();
    fetchActivityMock.mockReset();
    fetchActivityMock.mockResolvedValue([]);
    listMembersMock.mockResolvedValue([]);
    mockState = makeState();
    mockProjects = makeProjects();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flag ON renders focus and fires focus_page_view with the task id', () => {
    flagMock.mockReturnValue(true);
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(screen.getByText('Ship chat')).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith('focus_page_view', { taskId: TASK_ID });
  });

  it('flag OFF redirects to the board and fires no page view', () => {
    flagMock.mockReturnValue(false);
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(screen.getByText('BOARD')).toBeTruthy();
    expect(screen.queryByText('Ship chat')).toBeNull();
    expect(trackMock).not.toHaveBeenCalledWith('focus_page_view', expect.anything());
  });

  it('topbar mark-done fires focus_mark_done with source topbar', () => {
    flagMock.mockReturnValue(true);
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    const topbar = document.querySelector('.focus-topbar') as HTMLElement;
    fireEvent.click(within(topbar).getByRole('button', { name: 'Done' }));
    expect(trackMock).toHaveBeenCalledWith('focus_mark_done', { source: 'topbar' });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { status: 'done' },
    });
  });

  it('has no bottombar (wireframe 02: single Done action lives in the topbar)', () => {
    flagMock.mockReturnValue(true);
    renderFocus(`/project/${PROJECT_ID}/focus/${TASK_ID}`);
    expect(document.querySelector('.focus-bottombar')).toBeNull();
  });
});
