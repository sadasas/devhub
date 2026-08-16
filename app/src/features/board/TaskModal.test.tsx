import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State, Task } from '../../lib/types';
import { TaskModal } from './TaskModal';

const { setStatusMock } = vi.hoisted(() => ({ setStatusMock: vi.fn() }));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: true, projectId: 'p1', setStatus: setStatusMock }),
  wouldCreateCycle: () => false,
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
    setStatusMock.mockClear();
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
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Milestone' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Milestone' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: TASK_ID,
      patch: { milestoneId: null },
    });
  });
});