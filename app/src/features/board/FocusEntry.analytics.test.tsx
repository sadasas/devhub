import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State, Task } from '../../lib/types';
import { TaskModal } from './TaskModal';
import { BoardPage } from './BoardPage';

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

vi.mock('../../state/project-context', () => ({
  useProject: () => ({
    state: mockState,
    dispatch: mockDispatch,
    canEdit: true,
    projectId: 'p1',
    teamId: 'team1',
    saving: false,
    lastSavedAt: null,
    loading: false,
    error: null,
    setStatus: setStatusMock,
  }),
  wouldCreateCycle: () => false,
}));

vi.mock('../../state/auth-context', () => ({
  useOptionalAuth: () => ({ user: { id: 'u1', email: 'me@gmail.com' } }),
  useAuth: () => ({ user: { id: 'u1', email: 'me@gmail.com' }, loading: false }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    listMembers: listMembersMock,
    fetchActivity: fetchActivityMock,
    gcalStatus: gcalStatusMock,
    gcalSynced: gcalSyncedMock,
    gcalSetSync: vi.fn(),
    gcalDisconnect: vi.fn(),
    gcalConnectUrl: vi.fn((id: string) => `/api/v1/integrations/gcal/connect?projectId=${id}`),
  },
}));

const TASK_ID = '55555555-5555-4555-8555-555555555555';

function makeTask(over: Partial<Task>): Task {
  return {
    id: TASK_ID,
    title: 'Ship chat',
    status: 'todo',
    priority: 'medium',
    labels: [],
    blockedBy: [],
    assigneeId: null,
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

let mockState: State;
const mockDispatch = vi.fn();

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('focus entry kill-switch', () => {
  it('flag ON shows the Crosshair entry button and Shift+F enters focus', () => {
    flagMock.mockReturnValue(true);
    const onEnterFocus = vi.fn();
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} onEnterFocus={onEnterFocus} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Enter focus mode' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'F', shiftKey: true });
    expect(onEnterFocus).toHaveBeenCalledWith(TASK_ID);
  });

  it('flag OFF hides the Crosshair entry button and Shift+F does nothing', () => {
    flagMock.mockReturnValue(false);
    const onEnterFocus = vi.fn();
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} onEnterFocus={onEnterFocus} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Enter focus mode' })).toBeNull();
    fireEvent.keyDown(document, { key: 'F', shiftKey: true });
    expect(onEnterFocus).not.toHaveBeenCalled();
  });

  it('BoardPage passes onEnterFocus only when the flag is ON', () => {
    flagMock.mockReturnValue(true);
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <BoardPage unreadIds={new Set()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Ship chat'));
    expect(screen.getByRole('button', { name: 'Enter focus mode' })).toBeTruthy();
    unmount();

    flagMock.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/']}>
        <BoardPage unreadIds={new Set()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Ship chat'));
    expect(screen.queryByRole('button', { name: 'Enter focus mode' })).toBeNull();
  });
});
