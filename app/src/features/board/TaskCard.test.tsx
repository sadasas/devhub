import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskCard } from './TaskCard';
import type { Task } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Build login',
    status: 'todo',
    priority: 'medium',
    labels: [],
    blockedBy: [],
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('TaskCard', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    dispatchMock.mockReset();
    useProjectMock.mockReturnValue({ state: null, canEdit: true, dispatch: dispatchMock });
  });

  it('renders an unread dot for unread tasks', () => {
    render(<TaskCard task={task()} onOpen={() => {}} unread />);
    expect(document.querySelector('.unread-pill')).toBeTruthy();
    expect(screen.getByText('Unread')).toBeTruthy();
  });

  it('omits the unread dot for read tasks', () => {
    render(<TaskCard task={task()} onOpen={() => {}} />);
    expect(document.querySelector('.unread-pill')).toBeNull();
  });

  it('renders a due chip with a tone for tasks with a due date', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    render(<TaskCard task={task({ dueDate: future })} onOpen={() => {}} />);
    expect(screen.getByText(/^[A-Z][a-z]{2} \d{1,2}$/)).toBeTruthy();
    expect(document.querySelector('.task-due-warn')).toBeTruthy();
  });

  it('renders an overdue chip in danger tone', () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    render(<TaskCard task={task({ dueDate: past })} onOpen={() => {}} />);
    expect(document.querySelector('.task-due-danger')).toBeTruthy();
    expect(screen.getByText(/Overdue \d+d/)).toBeTruthy();
  });

  it('omits the due chip when there is no due date', () => {
    render(<TaskCard task={task()} onOpen={() => {}} />);
    expect(document.querySelector('.task-due')).toBeNull();
  });

  it('renders a neutral chip for a done-on-time task', () => {
    render(
      <TaskCard
        task={task({ status: 'done', dueDate: '2026-08-20', completedAt: '2026-08-14T09:00:00.000Z' })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Done on time')).toBeTruthy();
    expect(document.querySelector('.task-due-neutral')).toBeTruthy();
  });

  it('renders a warn chip for a done-late task', () => {
    render(
      <TaskCard
        task={task({ status: 'done', dueDate: '2026-08-10', completedAt: '2026-08-13T09:00:00.000Z' })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Late 3d')).toBeTruthy();
    expect(document.querySelector('.task-due-warn')).toBeTruthy();
  });

  it('renders a start chip for tasks with a start date', () => {
    render(<TaskCard task={task({ startDate: '2026-08-14' })} onOpen={() => {}} />);
    expect(screen.getByText(/Starts Aug 14/)).toBeTruthy();
    expect(document.querySelector('.task-start')).toBeTruthy();
  });

  it('omits the start chip when there is no start date', () => {
    render(<TaskCard task={task()} onOpen={() => {}} />);
    expect(document.querySelector('.task-start')).toBeNull();
  });

  it('renders a pin button and toggles pinned via dispatch', () => {
    render(<TaskCard task={task({ pinned: true })} onOpen={() => {}} />);
    const pin = screen.getByRole('button', { name: 'Unpin task' });
    expect(pin.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pin);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'task/update',
      id: 't1',
      patch: { pinned: false },
    });
  });

  it('omits the pin button for read-only users', () => {
    useProjectMock.mockReturnValue({ state: null, canEdit: false, dispatch: dispatchMock });
    render(<TaskCard task={task()} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: /Pin task/ })).toBeNull();
  });

  it('marks the priority badge as the hover-swap peer of the pin button', () => {
    render(<TaskCard task={task({ priority: 'medium' })} onOpen={() => {}} />);
    // Badge prioritas membawa kelas swap agar CSS menyembunyikannya saat
    // hover/focus (Pin absolute muncul di tempatnya, tanpa layout-shift).
    const badge = document.querySelector('.task-card-priority');
    expect(badge?.textContent).toMatch(/Med/);
    expect(screen.getByRole('button', { name: 'Pin task' })).toBeTruthy();
    // Info prioritas tetap tersedia untuk screen reader walau badge hidden.
    expect(document.querySelector('.task-card .sr-only')?.textContent).toMatch(/Medium/);
  });

  it('renders an assignee avatar with name tooltip when the member map knows the assignee', () => {
    render(
      <TaskCard
        task={task({ assigneeId: 'm1' })}
        members={{ m1: { email: 'adit@gmail.com', displayName: 'Adit S' } }}
        onOpen={() => {}}
      />,
    );
    expect(document.querySelector('.task-assignee-avatar')).toBeTruthy();
    expect(document.querySelector('.task-avatar .sr-only')?.textContent).toBe('Adit S');
    expect(document.querySelector('.task-assignee-name')).toBeNull();
  });

  it('falls back to the email when the assignee has no display name', () => {
    render(
      <TaskCard
        task={task({ assigneeId: 'm1' })}
        members={{ m1: { email: 'adit@gmail.com' } }}
        onOpen={() => {}}
      />,
    );
    expect(document.querySelector('.task-avatar .sr-only')?.textContent).toBe('adit@gmail.com');
  });

  it('omits the assignee avatar when the assignee is unknown or missing', () => {
    render(<TaskCard task={task({ assigneeId: 'm9' })} members={{ m1: { email: 'adit@gmail.com' } }} onOpen={() => {}} />);
    expect(document.querySelector('.task-avatar')).toBeNull();
  });

  it('renders a compact priority badge', () => {
    render(<TaskCard task={task({ priority: 'urgent' })} onOpen={() => {}} />);
    expect(screen.getByText('Urg')).toBeTruthy();
  });

  it('renders duplicate labels without duplicate React keys', () => {
    const err = console.error;
    const calls: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      calls.push(args);
    };
    try {
      useProjectMock.mockReturnValue({
        state: { milestones: [], tasks: [], testCases: [] },
        canEdit: true,
        dispatch: dispatchMock,
      });
      render(
        <TaskCard
          task={task({ labels: ['d', 'd'], milestoneId: null })}
          onOpen={() => {}}
          showMilestone
        />,
      );
      expect(document.querySelectorAll('.task-label').length).toBe(2);
      expect(calls.some((a) => String(a[0]).includes('same key'))).toBe(false);
    } finally {
      console.error = err;
    }
  });

  it('renders a long unbroken milestone name with a tooltip title', () => {
    const name = `M${'N'.repeat(120)}`;
    useProjectMock.mockReturnValue({
      state: { milestones: [{ id: 'm1', name }], tasks: [], testCases: [] },
      canEdit: true,
      dispatch: dispatchMock,
    });
    render(
      <TaskCard
        task={task({ milestoneId: 'm1' })}
        onOpen={() => {}}
        showMilestone
      />,
    );
    const pill = document.querySelector('.task-card-labels .task-label');
    expect(pill?.getAttribute('title')).toBe(name);
  });

  it('shows the parent name under a subtask title instead of the legacy sub chip', () => {
    useProjectMock.mockReturnValue({
      state: { milestones: [], tasks: [task({ id: 'p1', title: 'Parent task' })], testCases: [] },
      canEdit: true,
      dispatch: dispatchMock,
    });
    render(<TaskCard task={task({ id: 's1', title: 'Sub A', parentTaskId: 'p1' })} onOpen={() => {}} />);
    expect(screen.getByText('Parent task')).toBeTruthy();
    expect(document.querySelector('.task-card .task-label')?.textContent).not.toBe('sub');
  });

  it('renders a subtask progress bar and due rollup on the parent card', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const sub1 = task({ id: 's1', title: 'Sub A', parentTaskId: 't1', status: 'done', dueDate: future });
    const sub2 = task({ id: 's2', title: 'Sub B', parentTaskId: 't1', status: 'todo', dueDate: future });
    useProjectMock.mockReturnValue({
      state: { milestones: [], tasks: [task({}), sub1, sub2], testCases: [] },
      canEdit: true,
      dispatch: dispatchMock,
    });
    render(<TaskCard task={task({})} onOpen={() => {}} />);
    const bar = document.querySelector('.task-card [role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute('aria-valuenow')).toBe('1');
    expect(bar?.getAttribute('aria-valuemax')).toBe('2');
    // Due rollup: parent tanpa due sendiri menampilkan due subtask terdekat.
    expect(document.querySelectorAll('.task-card .task-due').length).toBeGreaterThan(0);
  });

  it('omits progress and rollup when there are no subtasks', () => {
    useProjectMock.mockReturnValue({
      state: { milestones: [], tasks: [task({})], testCases: [] },
      canEdit: true,
      dispatch: dispatchMock,
    });
    render(<TaskCard task={task({})} onOpen={() => {}} />);
    expect(document.querySelector('.task-card [role="progressbar"]')).toBeNull();
  });
});