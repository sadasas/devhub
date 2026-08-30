import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { State, Task } from '../../lib/types';
import { DueCalendar } from './DueCalendar';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), setStatus: vi.fn() }));

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

  it('shows task chips on their due date', () => {
    renderCalendar();
    const chip = screen.getByText('Ship calendar');
    expect(chip).toBeTruthy();
    expect(chip.closest('.due-cal-task')).toBeTruthy();
  });

  it('lists unscheduled tasks in the no-date strip', () => {
    renderCalendar();
    expect(screen.getByText('No date task')).toBeTruthy();
  });

  it('quick-creates on cell click (no modal)', () => {
    const { onQuickCreate } = renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    expect(onQuickCreate).toHaveBeenCalledWith('2026-08-20');
  });

  it('quick-creates on Enter on a focused cell', () => {
    const { onQuickCreate } = renderCalendar();
    fireEvent.focus(document.querySelector('[data-date="2026-08-20"]')!);
    fireEvent.keyDown(document.querySelector('[data-date="2026-08-20"]')!, { key: 'Enter' });
    expect(onQuickCreate).toHaveBeenCalledWith('2026-08-20');
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
    expect(screen.queryByText('Ship calendar')).toBeNull();
  });

  it('caps chips at 3 per row and shows lihat yang lain', () => {
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
    // only 3 visible + strip unscheduled
    const visible = document.querySelectorAll('.due-cal-span');
    expect(visible.length).toBe(3);
    expect(screen.getByText('+4 lagi')).toBeTruthy();
  });

  it('expands row height when lihat yang lain clicked', () => {
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
    fireEvent.click(screen.getByText('+4 lagi'));
    // now all 7 visible
    expect(document.querySelectorAll('.due-cal-span').length).toBe(7);
    expect(screen.getByText('ciutkan')).toBeTruthy();
    // grid row height should have expanded
    const grid = document.querySelector('.due-cal-grid') as HTMLElement;
    expect(grid.style.gridTemplateRows).toContain('px');
    // collapse again
    fireEvent.click(screen.getByText('ciutkan'));
    expect(screen.getByText('+4 lagi')).toBeTruthy();
  });

  it('hides day chips and unscheduled tasks rejected by taskFilter', () => {
    render(
      <DueCalendar
        onOpenTask={vi.fn()}
        onQuickCreate={vi.fn()}
        taskFilter={(t) => t.assigneeId === 'u1'}
      />,
    );
    expect(screen.queryByText('Ship calendar')).toBeNull();
    expect(screen.queryByText('No date task')).toBeNull();
  });

  it('keeps day chips and unscheduled tasks accepted by taskFilter', () => {
    mockState.tasks = [
      { ...mockState.tasks[0]!, assigneeId: 'u1' },
      { ...mockState.tasks[1]!, assigneeId: 'u1' },
    ];
    render(
      <DueCalendar
        onOpenTask={vi.fn()}
        onQuickCreate={vi.fn()}
        taskFilter={(t) => t.assigneeId === 'u1'}
      />,
    );
    expect(screen.getByText('Ship calendar')).toBeTruthy();
    expect(screen.getByText('No date task')).toBeTruthy();
  });

  it('renders multi-day task spanning 25-28 as 4 cells wide', () => {
    mockState.tasks = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'SS',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-28',
        startDate: '2026-08-25',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    renderCalendar();
    const chip = screen.getByText('SS');
    const el = chip.closest('.due-cal-task') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.position).toBe('absolute');
    expect(el.style.width).toContain('calc');
  });
});
