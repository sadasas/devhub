import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State, TestCase } from '../../lib/types';
import { TestModal } from './TestModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: true, projectId: 'p1', saving: false, lastSavedAt: null, setStatus: vi.fn() }),
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
    render(<MemoryRouter><TestModal testId={TEST_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="task"] .prop-view') as Element);
    fireEvent.click(screen.getByRole('option', { name: 'Ship chat' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'testCase/update',
      id: TEST_ID,
      patch: { taskId: TASK_A },
    });
  });

  it('unlinks a task via the None row', () => {
    mockState.testCases = [makeTestCase({ taskId: TASK_A })];
    render(<MemoryRouter><TestModal testId={TEST_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Ship chat' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'testCase/update',
      id: TEST_ID,
      patch: { taskId: null },
    });
  });

  it('opens status options in a single activator click', () => {
    render(<MemoryRouter><TestModal testId={TEST_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByRole('option', { name: 'Pass' })).toBeTruthy();
  });

  it('returns to view after picking a task', () => {
    render(<MemoryRouter><TestModal testId={TEST_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="task"] .prop-view') as Element);
    fireEvent.click(screen.getByRole('option', { name: 'Ship chat' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'testCase/update',
      id: TEST_ID,
      patch: { taskId: TASK_A },
    });
    const row = document.querySelector('[data-prop="task"]');
    expect(row?.querySelector('.prop-view')).toBeTruthy();
    expect(document.querySelector('#test-task')).toBeNull();
  });

  it('marks the row hot while its control is mounted', () => {
    render(<MemoryRouter><TestModal testId={TEST_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('[data-prop="task"]');
    expect(row?.getAttribute('data-hot')).toBeNull();
    fireEvent.click(document.querySelector('[data-prop="task"] .prop-view') as Element);
    expect(row?.getAttribute('data-hot')).toBeTruthy();
  });

  it('renders label columns without icons and a dotless status badge', () => {
    render(<MemoryRouter><TestModal testId={TEST_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(document.querySelector('[data-prop="status"] .prop-label')?.textContent).toBe('Status');
    expect(document.querySelector('[data-prop="task"] .prop-label')?.textContent).toBe('Linked task');
    expect(document.querySelector('[data-prop="issue"] .prop-label')?.textContent).toBe('Linked issue');
    expect(document.querySelector('[data-prop="status"] .prop-ic')).toBeNull();
    const badge = document.querySelector('[data-prop="status"] .prop-view > span');
    expect(badge?.textContent).toContain('Pending');
    expect(badge?.querySelector('span')).toBeNull();
  });
});
