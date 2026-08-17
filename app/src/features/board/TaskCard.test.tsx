import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskCard } from './TaskCard';
import type { Task } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

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
    useProjectMock.mockReturnValue({ state: null, canEdit: true });
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
    render(<TaskCard task={task({ dueDate: '2026-08-20' })} onOpen={() => {}} />);
    expect(screen.getByText(/Due Aug 20/)).toBeTruthy();
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

  it('renders a start chip for tasks with a start date', () => {
    render(<TaskCard task={task({ startDate: '2026-08-14' })} onOpen={() => {}} />);
    expect(screen.getByText(/Starts Aug 14/)).toBeTruthy();
    expect(document.querySelector('.task-start')).toBeTruthy();
  });

  it('omits the start chip when there is no start date', () => {
    render(<TaskCard task={task()} onOpen={() => {}} />);
    expect(document.querySelector('.task-start')).toBeNull();
  });
});