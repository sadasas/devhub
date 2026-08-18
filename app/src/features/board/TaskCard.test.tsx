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
    expect(document.querySelector('.unread-dot')).toBeTruthy();
    expect(screen.getByText('Unread')).toBeTruthy();
  });

  it('omits the unread dot for read tasks', () => {
    render(<TaskCard task={task()} onOpen={() => {}} />);
    expect(document.querySelector('.unread-dot')).toBeNull();
  });

  it('renders a due chip with a tone for tasks with a due date', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    render(<TaskCard task={task({ dueDate: future })} onOpen={() => {}} />);
    expect(screen.getByText(/^Due [A-Z][a-z]{2} \d{1,2}$/)).toBeTruthy();
    expect(document.querySelector('.task-due-warn')).toBeTruthy();
  });

  it('renders an overdue chip in danger tone', () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    render(<TaskCard task={task({ dueDate: past })} onOpen={() => {}} />);
    expect(document.querySelector('.task-due-danger')).toBeTruthy();
    expect(screen.getByText(/Overdue/)).toBeTruthy();
  });

  it('omits the due chip when there is no due date', () => {
    render(<TaskCard task={task()} onOpen={() => {}} />);
    expect(document.querySelector('.task-due')).toBeNull();
  });

  it('renders a success chip for a done-on-time task', () => {
    render(
      <TaskCard
        task={task({ status: 'done', dueDate: '2026-08-20', completedAt: '2026-08-14T09:00:00.000Z' })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Done on time')).toBeTruthy();
    expect(document.querySelector('.task-due-success')).toBeTruthy();
  });

  it('renders a warn chip for a done-late task', () => {
    render(
      <TaskCard
        task={task({ status: 'done', dueDate: '2026-08-10', completedAt: '2026-08-13T09:00:00.000Z' })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Done late 3d')).toBeTruthy();
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

  it('renders an assignee avatar and username when the member map knows the assignee', () => {
    render(
      <TaskCard
        task={task({ assigneeId: 'm1' })}
        members={{ m1: { email: 'adit@test.dev', displayName: 'Adit S' } }}
        onOpen={() => {}}
      />,
    );
    expect(document.querySelector('.task-assignee-name')?.textContent).toBe('Adit S');
    expect(document.querySelector('.task-assignee-avatar')).toBeTruthy();
  });

  it('falls back to the email when the assignee has no display name', () => {
    render(
      <TaskCard
        task={task({ assigneeId: 'm1' })}
        members={{ m1: { email: 'adit@test.dev' } }}
        onOpen={() => {}}
      />,
    );
    expect(document.querySelector('.task-assignee-name')?.textContent).toBe('adit@test.dev');
  });

  it('omits the assignee avatar when the assignee is unknown or missing', () => {
    render(<TaskCard task={task({ assigneeId: 'm9' })} members={{ m1: { email: 'adit@test.dev' } }} onOpen={() => {}} />);
    expect(document.querySelector('.task-avatar')).toBeNull();
  });

  it('renders a compact priority badge', () => {
    render(<TaskCard task={task({ priority: 'urgent' })} onOpen={() => {}} />);
    expect(screen.getByText('Urg')).toBeTruthy();
  });
});