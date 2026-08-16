import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { State, Task } from '../../lib/types';
import { MilestoneModal } from './MilestoneModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: false }),
}));

const MILESTONE_ID = '44444444-4444-4444-8444-444444444444';
const TASK_A = '55555555-5555-4555-8555-555555555555';
const TASK_B = '66666666-6666-4666-8666-666666666666';

function makeTask(over: Partial<Task>): Task {
  return {
    id: TASK_A,
    title: 'Ship chat',
    status: 'done',
    priority: 'high',
    labels: [],
    blockedBy: [],
    milestoneId: MILESTONE_ID,
    description: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function makeState(tasks: Task[]): State {
  return {
    tasks,
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [
      {
        id: MILESTONE_ID,
        name: 'V0.2.0',
        version: '0.2.0',
        status: 'released',
        changelog: 'Shipped collaboration.',
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

describe('MilestoneModal', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockState = makeState([
      makeTask({ id: TASK_A, title: 'Ship chat', status: 'done' }),
      makeTask({ id: TASK_B, title: 'Add invites', status: 'inProgress' }),
      makeTask({ id: '77777777-7777-4777-8777-777777777777', title: 'Unassigned task', milestoneId: null }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the tasks shipped in this release', () => {
    render(<MilestoneModal milestoneId={MILESTONE_ID} onClose={vi.fn()} />);
    expect(screen.getByText(/Tasks in this release/)).toBeTruthy();
    expect(screen.getByText('Ship chat')).toBeTruthy();
    expect(screen.getByText('Add invites')).toBeTruthy();
    expect(screen.queryByText('Unassigned task')).toBeNull();
  });

  it('shows a hint when no tasks are assigned', () => {
    mockState = makeState([]);
    render(<MilestoneModal milestoneId={MILESTONE_ID} onClose={vi.fn()} />);
    expect(screen.getByText('No tasks assigned to this milestone.')).toBeTruthy();
  });
});