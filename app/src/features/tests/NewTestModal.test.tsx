import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State } from '../../lib/types';
import { NewTestModal } from './NewTestModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, setStatus: vi.fn() }),
}));

const TASK_A = '55555555-5555-4555-8555-555555555555';
const ISSUE_A = '11111111-1111-4111-8111-111111111111';

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
    issues: [
      {
        id: ISSUE_A,
        title: 'Login broken',
        status: 'open',
        severity: 'medium',
        description: '',
        reproduction: '',
        linkedTaskId: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    testCases: [],
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

describe('NewTestModal linked selects', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockState = makeState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('links a task and issue from the searchable selects', () => {
    render(<MemoryRouter><NewTestModal open onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Linked task' }));
    fireEvent.click(screen.getByRole('option', { name: 'Ship chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Linked issue' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search Linked issue' }), { target: { value: 'login' } });
    fireEvent.click(screen.getByRole('option', { name: 'Login broken' }));
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Test signup' } });
    fireEvent.submit(document.getElementById('new-test-form')!);
    const added = mockDispatch.mock.calls.find((c) => c[0].type === 'testCase/add');
    expect(added?.[0].testCase.taskId).toBe(TASK_A);
    expect(added?.[0].testCase.issueId).toBe(ISSUE_A);
  });
});