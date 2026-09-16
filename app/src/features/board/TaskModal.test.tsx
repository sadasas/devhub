import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State, Task } from '../../lib/types';
import { TaskModal } from './TaskModal';

const { setStatusMock, listMembersMock, fetchActivityMock, canEditMock } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
  listMembersMock: vi.fn(),
  fetchActivityMock: vi.fn(),
  canEditMock: { value: true },
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: canEditMock.value, projectId: 'p1', teamId: 'team1', setStatus: setStatusMock }),
  wouldCreateCycle: () => false,
}));

vi.mock('../../lib/api', () => ({
  api: { listMembers: listMembersMock, fetchActivity: fetchActivityMock },
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
      { id: 'm1', email: 'adit@test.dev', role: 'editor', joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'm2', email: 'rani@test.dev', role: 'viewer', joinedAt: '2026-01-01T00:00:00.000Z' },
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
    expect(screen.queryByText('Done late 3d')).toBeNull();
    expect(screen.getByText(/Aug 10, 2026/)).toBeTruthy();
    expect(screen.getByText(/Aug 13, 2026/)).toBeTruthy();
  });

  it('shows the danger chip only for overdue tasks', () => {
    canEditMock.value = false;
    mockState.tasks = [makeTask({ status: 'todo', dueDate: '2000-01-01' })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const chip = document.querySelector('.task-due-danger');
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toMatch(/OD/);
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
    expect(screen.getByRole('spinbutton', { name: 'Estimate (hours)' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Estimate (hours)' })).toBeTruthy();
  });

  it('dispatches numeric inline estimate on change', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Estimate (hours)' }), { target: { value: '8' } });
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
    expect(screen.queryByRole('spinbutton', { name: 'Estimate (hours)' })).toBeNull();
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    expect(screen.getByRole('spinbutton', { name: 'Estimate (hours)' })).toBeTruthy();
  });

  it('reveals blocked-by editing on row hover and hides it on leave', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: '+ Add' })).toBeNull();
    const row = document.querySelector('.detail-side [data-blocked-row]');
    expect(row).toBeTruthy();
    fireEvent.mouseEnter(row as Element);
    expect(screen.getByRole('button', { name: '+ Add' })).toBeTruthy();
    fireEvent.mouseLeave(row as Element);
    expect(screen.queryByRole('button', { name: '+ Add' })).toBeNull();
  });

  it('renders test cases as an info row in the sidebar', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('.detail-side [data-prop="testCases"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('—');
    expect(row?.querySelector('.prop-chev')).toBeNull();
  });

  it('shows a label column instead of an icon in the assignee row', async () => {
    mockState.tasks = [makeTask({ assigneeId: 'm1' })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('adit@test.dev');
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

  it('holds commas in the labels draft until blur commits two labels', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="labels"] .prop-view') as Element);
    const input = screen.getByRole('textbox', { name: 'Labels' });
    fireEvent.change(input, { target: { value: 'bug, fix' } });
    expect((input as HTMLInputElement).value).toBe('bug, fix');
    expect(mockDispatch).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { labels: ['bug', 'fix'] },
    });
  });

  it('shows actual hours in its own row without a chevron', () => {
    mockState.tasks = [makeTask({ actualHours: 24.5 })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('[data-prop="actual"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('24.5h');
    expect(row?.querySelector('.prop-chev')).toBeNull();
  });

  it('dispatches decimal inline estimate, keeping the dot', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Estimate (hours)' }), { target: { value: '8.5' } });
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

  it('cancels the labels draft on Escape without dispatching', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="labels"] .prop-view') as Element);
    fireEvent.change(screen.getByRole('textbox', { name: 'Labels' }), { target: { value: 'bug' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Labels' }), { key: 'Escape' });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Labels' })).toBeNull();
  });

  it('opens the estimate popup with a numeric guard on keys', () => {
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="estimate"] .prop-view') as Element);
    const input = screen.getByRole('spinbutton', { name: 'Estimate (hours)' });
    expect(input).toBeTruthy();
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('reserves blocker remove buttons hidden when idle', () => {
    mockState.tasks = [makeTask({ blockedBy: ['other-id'] }), makeTask({ id: 'other-id', title: 'Other' })];
    render(<MemoryRouter><TaskModal taskId={TASK_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('[data-blocked-row]');
    expect(row?.querySelector('button[aria-label^="Remove blocker"]')).toBeNull();
    fireEvent.mouseEnter(row as Element);
    expect(screen.getByRole('button', { name: 'Remove blocker Other' })).toBeTruthy();
  });
});