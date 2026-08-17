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
});