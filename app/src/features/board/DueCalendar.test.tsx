import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { State, Task } from '../../lib/types';
import { DueCalendar } from './DueCalendar';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), setStatus: vi.fn() }));

const MILESTONE_A = '44444444-4444-4444-8444-444444444444';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mocks.dispatch, canEdit: true, setStatus: mocks.setStatus }),
}));

function makeState(): State {
  return {
    tasks: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Ship calendar',
        status: 'inProgress',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-20',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        title: 'No date task',
        status: 'todo',
        priority: 'low',
        labels: [],
        blockedBy: [],
        dueDate: null,
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'V0.2.0',
        version: '0.2.0',
        status: 'planned',
        targetDate: '2026-08-25',
        changelog: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;

function renderCalendar() {
  const onOpenTask = vi.fn();
  const onQuickCreate = vi.fn();
  const view = render(<DueCalendar onOpenTask={onOpenTask} onQuickCreate={onQuickCreate} />);
  return { onOpenTask, onQuickCreate, view };
}

function dataTransfer() {
  return { getData: () => '55555555-5555-4555-8555-555555555555', setData: vi.fn(), effectAllowed: 'move' } as unknown as DataTransfer;
}

beforeEach(() => {
  mocks.dispatch.mockReset();
  mockState = makeState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DueCalendar', () => {
  it('renders a month grid with day cells', () => {
    renderCalendar();
    expect(screen.getByText('August 2026')).toBeTruthy();
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(document.querySelectorAll('.due-cal-cell').length).toBe(42);
  });

  it('shows task chips on their due date and milestones as diamonds', () => {
    renderCalendar();
    const cell = document.querySelector('[data-date="2026-08-20"]');
    expect(cell?.textContent).toContain('Ship calendar');
    const milestoneCell = document.querySelector('[data-date="2026-08-25"]');
    expect(milestoneCell?.querySelector('.due-cal-milestone')).toBeTruthy();
  });

  it('lists unscheduled tasks in the no-date strip', () => {
    renderCalendar();
    expect(screen.getByText('No date task')).toBeTruthy();
  });

  it('opens a day popup listing tasks when a cell is clicked', () => {
    const { onOpenTask } = renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Thursday, August 20')).toBeTruthy();
    expect(within(dialog).getByText('Ship calendar')).toBeTruthy();
    expect(onOpenTask).not.toHaveBeenCalled();
  });

  it('shows an empty state for days without tasks', () => {
    renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-21"]')!);
    expect(screen.getByText('No tasks due')).toBeTruthy();
    expect(screen.getByText('Tasks dropped on this day appear here.')).toBeTruthy();
  });

  it('shows a summary count and rich rows with priority, milestone and estimate', () => {
    mockState.tasks = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Ship calendar',
        status: 'inProgress',
        priority: 'high',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-20',
        milestoneId: MILESTONE_A,
        estimate: 4,
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        title: 'Ship docs',
        status: 'done',
        priority: 'low',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-20',
        estimate: 2,
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('2 tasks · 1 done')).toBeTruthy();
    expect(within(dialog).getByText('High')).toBeTruthy();
    expect(within(dialog).getByText('V0.2.0')).toBeTruthy();
    expect(within(dialog).getByText('4h')).toBeTruthy();
    expect(within(dialog).getByText('In Progress')).toBeTruthy();
    expect(dialog.querySelectorAll('.due-day-row').length).toBe(2);
    expect(dialog.querySelector('.data-row')).toBeNull();
  });

  it('sorts day tasks by status order (done last)', () => {
    mockState.tasks = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Aaa todo',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-20',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        title: 'Bbb done',
        status: 'done',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-20',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        title: 'Ccc in progress',
        status: 'inProgress',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-20',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    const titles = within(screen.getByRole('dialog'))
      .getAllByRole('button')
      .map((b) => b.textContent ?? '');
    const todo = titles.findIndex((t) => t.includes('Aaa todo'));
    const inProgress = titles.findIndex((t) => t.includes('Ccc in progress'));
    const done = titles.findIndex((t) => t.includes('Bbb done'));
    expect(todo).toBeGreaterThan(-1);
    expect(inProgress).toBeGreaterThan(todo);
    expect(done).toBeGreaterThan(inProgress);
  });

  it('renders milestone chips in the day modal', () => {
    renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-25"]')!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('◆ V0.2.0')).toBeTruthy();
  });

  it('opens the task modal from the day popup row', () => {
    const { onOpenTask } = renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Ship calendar'));
    expect(onOpenTask).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555');
    expect(screen.queryByText('Thursday, August 20')).not.toBeTruthy();
  });

  it('quick-creates a task for the day via the Add task button', () => {
    const { onQuickCreate } = renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Add task/ }));
    expect(onQuickCreate).toHaveBeenCalledWith('2026-08-20');
    expect(screen.queryByText('Thursday, August 20')).not.toBeTruthy();
  });

  it('opens the day popup with Enter on a focused cell', () => {
    renderCalendar();
    fireEvent.focus(document.querySelector('[data-date="2026-08-20"]')!);
    fireEvent.keyDown(document.querySelector('[data-date="2026-08-20"]')!, { key: 'Enter' });
    expect(screen.getByText('Thursday, August 20')).toBeTruthy();
  });

  it('opens the task modal when a chip is clicked', () => {
    const { onOpenTask } = renderCalendar();
    fireEvent.click(screen.getByText('Ship calendar'));
    expect(onOpenTask).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555');
  });

  it('reschedules a task by dropping it on another day', () => {
    renderCalendar();
    const chip = screen.getByText('Ship calendar');
    fireEvent.dragStart(chip, { dataTransfer: dataTransfer() });
    fireEvent.drop(document.querySelector('[data-date="2026-08-21"]')!, { dataTransfer: dataTransfer() });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: '55555555-5555-4555-8555-555555555555',
      patch: { dueDate: '2026-08-21' },
    });
  });

  it('clears the due date when dropped on the strip', () => {
    renderCalendar();
    const chip = screen.getByText('Ship calendar');
    fireEvent.dragStart(chip, { dataTransfer: dataTransfer() });
    fireEvent.drop(document.querySelector('.due-cal-strip')!, { dataTransfer: dataTransfer() });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: '55555555-5555-4555-8555-555555555555',
      patch: { dueDate: null },
    });
  });

  it('navigates months with the prev and next buttons', () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('September 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('August 2026')).toBeTruthy();
  });

  it('toggles between month and week views', () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('tab', { name: 'Week' }));
    expect(document.querySelectorAll('.due-cal-cell').length).toBe(7);
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    expect(document.querySelectorAll('.due-cal-cell').length).toBe(42);
  });

  it('hides completed tasks when the toggle is on', () => {
    mockState.tasks[0]!.status = 'done';
    renderCalendar();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide completed' }));
    const cell = document.querySelector('[data-date="2026-08-20"]');
    expect(cell?.textContent).not.toContain('Ship calendar');
  });

  it('caps chips at 3 per cell and shows a +N more chip', () => {
    const tasks: Task[] = Array.from({ length: 7 }, (_, i) => ({
      id: `aaaaaaa${i}-aaaa-4aaa-8aaa-aaaaaaaaaa${i}a`,
      title: `Task ${i}`,
      status: 'todo',
      priority: 'low',
      labels: [],
      blockedBy: [],
      dueDate: '2026-08-20',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockState.tasks = tasks;
    renderCalendar();
    const cell = document.querySelector('[data-date="2026-08-20"]')!;
    expect(cell.querySelectorAll('.due-cal-task').length).toBe(3);
    expect(screen.getByText('+4 more')).toBeTruthy();
  });

  it('groups multiple milestones into a single row', () => {
    mockState.milestones = [
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'V0.2.0',
        version: '0.2.0',
        status: 'planned',
        targetDate: '2026-08-25',
        changelog: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '99999999-9999-4999-8999-999999999999',
        name: 'V0.3.0',
        version: '0.3.0',
        status: 'planned',
        targetDate: '2026-08-25',
        changelog: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    renderCalendar();
    const cell = document.querySelector('[data-date="2026-08-25"]')!;
    const container = cell.querySelector('.due-cal-milestones');
    expect(container).toBeTruthy();
    expect(container!.querySelectorAll('.due-cal-milestone').length).toBe(2);
  });

  it('opens the day popup with all tasks from the +N more chip', () => {
    const tasks: Task[] = Array.from({ length: 7 }, (_, i) => ({
      id: `bbbbbb${i}-bbbb-4bbb-8bbb-bbbbbbbbbbb${i}`,
      title: `Overflow task ${i}`,
      status: 'todo',
      priority: 'low',
      labels: [],
      blockedBy: [],
      dueDate: '2026-08-20',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockState.tasks = tasks;
    renderCalendar();
    fireEvent.click(screen.getByText('+4 more'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Overflow task 0')).toBeTruthy();
    expect(within(dialog).getByText('Overflow task 6')).toBeTruthy();
  });
});