import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { State, TestCase } from '../../lib/types';
import { TestModal } from './TestModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: true, projectId: 'p1' }),
}));

const TEST_ID = '33333333-3333-4333-8333-333333333333';
const TASK_A = '55555555-5555-4555-8555-555555555555';

function makeTestCase(over: Partial<TestCase>): TestCase {
  return {
    id: TEST_ID,
    name: 'Login with invalid password',
    status: 'pending',
    taskId: null,
    issueId: null,
    steps: '',
    expected: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function makeState(): State {
  return {
    tasks: [
      {
        id: TASK_A,
        title: 'Ship chat',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        milestoneId: null,
        description: '',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    issues: [],
    testCases: [makeTestCase({})],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;
const mockDispatch = vi.fn();

describe('TestModal linked selects', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockState = makeState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('links a task when editing', () => {
    render(<TestModal testId={TEST_ID} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Linked task' }));
    fireEvent.click(screen.getByRole('option', { name: 'Ship chat' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'testCase/update',
      id: TEST_ID,
      patch: { taskId: TASK_A },
    });
  });

  it('unlinks a task via the None row', () => {
    mockState.testCases = [makeTestCase({ taskId: TASK_A })];
    render(<TestModal testId={TEST_ID} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Linked task' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'testCase/update',
      id: TEST_ID,
      patch: { taskId: null },
    });
  });
});