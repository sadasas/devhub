import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { GitHubLink, State, Task } from '../../lib/types';
import { TaskModal } from './TaskModal';

const { setStatusMock, listMembersMock, fetchActivityMock, canEditMock, gcalStatusMock, gcalSyncedMock } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
  listMembersMock: vi.fn(),
  fetchActivityMock: vi.fn(),
  canEditMock: { value: true },
  gcalStatusMock: vi.fn().mockResolvedValue({ connected: false, expired: false, email: null, syncEnabled: false, lastSyncAt: null }),
  gcalSyncedMock: vi.fn().mockResolvedValue({ taskIds: [] }),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: canEditMock.value, projectId: 'p1', teamId: 'team1', setStatus: setStatusMock }),
  wouldCreateCycle: () => false,
}));

vi.mock('../../lib/api', () => ({
  api: {
    listMembers: listMembersMock,
    fetchActivity: fetchActivityMock,
    gcalStatus: gcalStatusMock,
    gcalSynced: gcalSyncedMock,
  },
}));

const TASK_ID = '55555555-5555-4555-8555-555555555555';
const MILESTONE_A = '44444444-4444-4444-8444-444444444444';
const MILESTONE_B = '99999999-9999-4999-8999-999999999999';

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
    milestones: [
      {
        id: MILESTONE_A,
        name: 'V0.2.0',
        version: '0.2.0',
        status: 'planned',
        changelog: '',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: MILESTONE_B,
        name: 'V0.3.0',
        version: '0.3.0',
        status: 'planned',
        changelog: '',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;
const mockDispatch = vi.fn();

describe('TaskModal milestone select', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    canEditMock.value = true;
    setStatusMock.mockClear();
    listMembersMock.mockReset();
    fetchActivityMock.mockReset();
    fetchActivityMock.mockResolvedValue([]);
    listMembersMock.mockResolvedValue([
      { id: 'm1', email: 'adit@gmail.com', role: 'editor', joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'm2', email: 'rani@gmail.com', role: 'viewer', joinedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    mockState = makeState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not announce an editing status while no task is open', () => {
    render(<MemoryRouter><TaskModal taskId={null} onClose={vi.fn()} /></MemoryRouter>);
    expect(setStatusMock).not.toHaveBeenCalled();
  });

  it('announces an editing status while a task is open', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(setStatusMock).toHaveBeenCalledWith('Editing task');
  });

  it('restores the viewing status when the task modal closes', () => {
    const { rerender } = render(
      <MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>,
    );
    rerender(<MemoryRouter><TaskModal taskId={null} onClose={vi.fn()} /></MemoryRouter>);
    expect(setStatusMock).toHaveBeenLastCalledWith('Viewing Board');
  });

  it('assigns a milestone from the searchable select', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="milestone"] .prop-view') as Element);
    fireEvent.change(screen.getByRole('combobox', { name: 'Search Milestone' }), { target: { value: '0.3' } });
    fireEvent.click(screen.getByRole('option', { name: /V0\.3\.0/ }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { milestoneId: MILESTONE_B },
    });
  });

  it('unassigns the milestone via the None row', () => {
    mockState = makeState();
    mockState.tasks = [makeTask({ milestoneId: MILESTONE_A })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'V0.2.0' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { milestoneId: null },
    });
  });

  it('shows the due date and the done date for a done task', () => {
    canEditMock.value = false;
    mockState.tasks = [
      makeTask({
        status: 'done',
        dueDate: '2026-08-10',
        completedAt: '2026-08-13T12:00:00.000Z',
      }),
    ];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByText('Late 3d')).toBeNull();
    expect(screen.getByText(/Aug 10, 2026/)).toBeTruthy();
    expect(screen.getByText(/Aug 13, 2026/)).toBeTruthy();
  });

  it('shows the danger chip only for overdue tasks', () => {
    canEditMock.value = false;
    mockState.tasks = [makeTask({ status: 'todo', dueDate: '2000-01-01' })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const chip = document.querySelector('.task-due-danger');
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toMatch(/Overdue/);
  });

  it('omits the done date when the task is not done', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByText(/^Aug \d{1,2}, 2026$/)).toBeNull();
  });

  it('assigns a member from the assignee select', async () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="assignee"] .prop-view') as Element);
    fireEvent.change(screen.getByRole('combobox', { name: 'Search Assignee' }), { target: { value: 'adit' } });
    fireEvent.click(await screen.findByRole('option', { name: /adit@test\.dev/ }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { assigneeId: 'm1' },
    });
  });

  it('clears the assignee via the None row', async () => {
    mockState.tasks = [makeTask({ assigneeId: 'm1' })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const assigneeActivator = document.querySelector('[data-prop="assignee"] .prop-view');
    expect(assigneeActivator).toBeTruthy();
    fireEvent.click(assigneeActivator as Element);
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { assigneeId: null },
    });
  });

  it('shows the auto actual hours with the estimate input inline', () => {
    mockState.tasks = [makeTask({ status: 'done', actualHours: 24.5 })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    expect(screen.getByText(/24\.5h/)).toBeTruthy();
    expect(screen.queryByLabelText('Actual (hours)')).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Estimate' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Estimate' })).toBeTruthy();
  });

  it('dispatches numeric inline estimate on change', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Estimate' }), { target: { value: '8' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { estimate: 8 },
    });
  });

  it('does not reveal controls on row hover', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('[data-prop="milestone"]');
    expect(row).toBeTruthy();
    fireEvent.mouseEnter(row as Element);
    expect(row?.querySelector('.prop-view')).toBeTruthy();
    expect(document.querySelector('#task-milestone')).toBeNull();
  });

  it('opens milestone options in a single activator click', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="milestone"] .prop-view') as Element);
    expect(screen.getByRole('option', { name: /V0\.3\.0/ })).toBeTruthy();
  });

  it('returns to view after picking a milestone', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="milestone"] .prop-view') as Element);
    fireEvent.click(screen.getByRole('option', { name: /V0\.3\.0/ }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { milestoneId: MILESTONE_B },
    });
    const row = document.querySelector('[data-prop="milestone"]');
    expect(row?.querySelector('.prop-view')).toBeTruthy();
    expect(document.querySelector('#task-milestone')).toBeNull();
  });

  it('reveals the estimate control on activator click for keyboard users', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('spinbutton', { name: 'Estimate' })).toBeNull();
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    expect(screen.getByRole('spinbutton', { name: 'Estimate' })).toBeTruthy();
  });

  it('shows blocked-by editing immediately without hover (touch-safe)', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('.detail-side [data-blocked-row]');
    expect(row).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeTruthy();
  });

  it('renders test cases as an info row in the sidebar', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('.detail-side [data-prop="testCases"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('—');
    expect(row?.querySelector('.prop-chev')).toBeNull();
    expect(row?.querySelector('.prop-edit')).toBeNull();
  });

  it('shows a label column instead of an icon in the assignee row', async () => {
    mockState.tasks = [makeTask({ assigneeId: 'm1' })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
    const row = document.querySelector('[data-prop="assignee"]');
    expect(row?.querySelector('.prop-label')?.textContent).toBe('Assignee');
    expect(row?.querySelector('.prop-ic')).toBeNull();
  });

  it('renders a label column on every sidebar row', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const rows = document.querySelectorAll('.detail-side .prop');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.querySelector('.prop-label')).toBeTruthy();
    });
  });

  it('opens status options in a single click and closes after picking', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getByRole('option', { name: 'In Progress' })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Done' }));
    expect(document.querySelector('#task-status')).toBeNull();
    expect(document.querySelector('[data-prop="status"] .prop-view')).toBeTruthy();
  });

  it('shows the blocked-done error under the Status row (status trigger)', () => {
    const blockerId = '66666666-6666-4666-8666-666666666666';
    mockState.tasks = [
      makeTask({ blockedBy: [blockerId] }),
      makeTask({ id: blockerId, title: 'Blocker', status: 'todo' }),
    ];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    fireEvent.click(screen.getByRole('option', { name: 'Done' }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('finish them first');
    // Tepat sesudah baris Status di sidebar — bukan di kolom utama.
    const statusRow = document.querySelector('[data-prop="status"]');
    expect(statusRow?.nextElementSibling).toBe(alert);
    expect(document.querySelector('.detail-side')?.contains(alert)).toBe(true);
    expect(mockDispatch).not.toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { status: 'done' },
    });
  });

  it('shows the blocked-done error above the GitHub section (suggest trigger)', () => {
    const blockerId = '66666666-6666-4666-8666-666666666666';
    const merged: GitHubLink = {
      id: '11111111-1111-4111-8111-111111111111',
      repo: 'org/repo',
      kind: 'pr',
      ref: '7',
      url: 'https://github.com/org/repo/pull/7',
      title: 'Fix login',
      status: 'merged',
    };
    mockState.tasks = [
      makeTask({ status: 'review', blockedBy: [blockerId], githubLinks: [merged] }),
      makeTask({ id: blockerId, title: 'Blocker', status: 'todo' }),
    ];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const markDone = screen.getByRole('button', { name: 'Mark done' });
    fireEvent.click(markDone);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('finish them first');
    // Di kolom utama tepat sebelum section GitHub — bukan di sidebar.
    expect(document.querySelector('.detail-side')?.contains(alert)).toBe(false);
    expect(alert.compareDocumentPosition(markDone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens priority options in a single click and closes after picking', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
    expect(screen.getByRole('option', { name: 'Urgent' })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'High' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { priority: 'high' },
    });
    expect(document.querySelector('#task-priority')).toBeNull();
  });

  it('marks the row hot while its control is mounted', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('[data-prop="milestone"]');
    expect(row?.getAttribute('data-hot')).toBeNull();
    fireEvent.click(row?.querySelector('.prop-view') as Element);
    expect(row?.getAttribute('data-hot')).toBeTruthy();
  });

  it('picks a start-end range from the custom date picker', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="dates"] .prop-view') as Element);
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy();
    const now = new Date();
    const iso = (day: number) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    fireEvent.click(screen.getByRole('button', { name: iso(10) }));
    fireEvent.click(screen.getByRole('button', { name: iso(20) }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { startDate: iso(10), dueDate: iso(20) },
    });
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).toBeNull();
  });

  it('keeps the date picker open when the row blurs to the body', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="dates"] .prop-view') as Element);
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy();
    fireEvent.blur(document.querySelector('[data-prop="dates"]') as Element, { relatedTarget: document.body });
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy();
  });

  it('toggles a library label into the draft without dispatching yet', () => {
    mockState.labelDefs = [
      { id: 'ld1', name: 'bug', color: 'red', description: '', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    ];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="labels"] .prop-view') as Element);
    fireEvent.click(screen.getByRole('button', { name: 'bug' }));
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task/update' }),
    );
  });

  it('shows actual hours as an editable row with popup', () => {
    mockState.tasks = [makeTask({ actualHours: 24.5 })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('[data-prop="actual"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('24.5h');
    expect(row?.querySelector('.prop-edit')).toBeTruthy();
    fireEvent.click(row?.querySelector('.prop-view') as Element);
    expect(screen.getByRole('spinbutton', { name: 'Actual' })).toBeTruthy();
  });

  it('dispatches decimal inline estimate, keeping the dot', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Estimate' }), { target: { value: '8.5' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { estimate: 8.5 },
    });
  });

  it('opens the labels popup without changing the row text', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const before = document.querySelector('[data-prop="labels"]')?.textContent;
    fireEvent.click(document.querySelector('[data-prop="labels"] .prop-view') as Element);
    expect(screen.getByRole('dialog', { name: 'Labels' })).toBeTruthy();
    expect(document.querySelector('[data-prop="labels"]')?.textContent).toBe(before);
  });

  it('creates a label definition inline from the picker', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="labels"] .prop-view') as Element);
    fireEvent.change(screen.getByRole('textbox', { name: 'New label…' }), { target: { value: 'urgent-fix' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create label "urgent-fix"' }));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'labelDef/add' }),
    );
  });

  it('opens the estimate popup with a numeric guard on keys', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    const input = screen.getByRole('spinbutton', { name: 'Estimate' });
    expect(input).toBeTruthy();
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('shows blocker remove buttons immediately when editable', () => {
    mockState.tasks = [makeTask({ blockedBy: ['other-id'] }), makeTask({ id: 'other-id', title: 'Other' })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Remove blocker Other' })).toBeTruthy();
  });
});

describe('TaskModal subtasks', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    canEditMock.value = true;
    fetchActivityMock.mockReset();
    fetchActivityMock.mockResolvedValue([]);
    listMembersMock.mockReset();
    listMembersMock.mockResolvedValue([]);
    mockState = makeState();
  });

  function openAddRow() {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '+ New subtask…' }));
    return screen.getByRole('textbox', { name: 'New subtask…' }) as HTMLTextAreaElement;
  }

  it('chains subtasks on Enter, inheriting priority and milestone with empty assignee', () => {
    mockState.tasks = [makeTask({ priority: 'high', milestoneId: MILESTONE_A })];
    const input = openAddRow();
    fireEvent.change(input, { target: { value: 'Sub A' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/add',
      task: expect.objectContaining({
        title: 'Sub A',
        status: 'todo',
        priority: 'high',
        milestoneId: MILESTONE_A,
        parentTaskId: TASK_ID,
        assigneeId: null,
        startDate: null,
        dueDate: null,
      }),
    });
    // Chain: input tetap terbuka dan dikosongkan untuk berikutnya.
    expect(screen.getByRole('textbox', { name: 'New subtask…' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'New subtask…' }), { target: { value: 'Sub B' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New subtask…' }), { key: 'Enter' });
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });

  it('closes the add card on outside click and on Escape', () => {
    openAddRow();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('textbox', { name: 'New subtask…' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ New subtask…' }));
    const reopened = screen.getByRole('textbox', { name: 'New subtask…' });
    fireEvent.change(reopened, { target: { value: 'draft' } });
    fireEvent.keyDown(reopened, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'New subtask…' })).toBeNull();
  });

  it('renders the title as a borderless composer textarea', () => {
    openAddRow();
    const box = screen.getByRole('textbox', { name: 'New subtask…' });
    expect(box.tagName).toBe('TEXTAREA');
    expect(box.classList.contains('composer-title')).toBe(true);
  });

  it('shows the inherited priority as a static pill in the add card', () => {
    mockState.tasks = [makeTask({ priority: 'high' })];
    openAddRow();
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('navigates when a subtask row is clicked', () => {
    const SUB_ID = '66666666-6666-4666-8666-666666666666';
    mockState.tasks = [makeTask({}), makeTask({ id: SUB_ID, title: 'Sub A', parentTaskId: TASK_ID })];
    const onNavigate = vi.fn();
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} onNavigate={onNavigate} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open subtask Sub A' }));
    expect(onNavigate).toHaveBeenCalledWith(SUB_ID);
  });

  it('shows a Subtask badge and breadcrumb back to the parent', () => {
    const SUB_ID = '66666666-6666-4666-8666-666666666666';
    mockState.tasks = [makeTask({ title: 'Parent task' }), makeTask({ id: SUB_ID, title: 'Sub A', parentTaskId: TASK_ID })];
    const onNavigate = vi.fn();
    render(<MemoryRouter><TaskModal taskId={SUB_ID} onClose={vi.fn()} onNavigate={onNavigate} /></MemoryRouter>);
    expect(screen.getByText('Subtask')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to parent task' }));
    expect(onNavigate).toHaveBeenCalledWith(TASK_ID);
  });

  it('hides the subtasks section entirely inside a subtask modal', () => {
    const SUB_ID = '66666666-6666-4666-8666-666666666666';
    mockState.tasks = [makeTask({}), makeTask({ id: SUB_ID, title: 'Sub A', parentTaskId: TASK_ID })];
    render(<MemoryRouter><TaskModal taskId={SUB_ID} onClose={vi.fn()} onNavigate={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByText('Subtasks')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ New subtask…' })).toBeNull();
  });

  it('shows action icons on Detach and Make-subtask-of buttons', () => {
    const SUB_ID = '66666666-6666-4666-8666-666666666666';
    mockState.tasks = [makeTask({ title: 'Parent task' }), makeTask({ id: SUB_ID, title: 'Sub A', parentTaskId: TASK_ID })];
    render(<MemoryRouter><TaskModal taskId={SUB_ID} onClose={vi.fn()} onNavigate={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Detach' }).querySelector('svg')).toBeTruthy();
    mockState.tasks = [makeTask({ title: 'Parent task' })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} onNavigate={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Make subtask of…' }).querySelector('svg')).toBeTruthy();
  });
});