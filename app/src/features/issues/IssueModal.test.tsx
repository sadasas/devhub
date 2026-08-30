import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Issue, State } from '../../lib/types';
import { IssueModal } from './IssueModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: true, projectId: 'p1', setStatus: vi.fn() }),
}));

const ISSUE_ID = '11111111-1111-4111-8111-111111111111';
const TASK_A = '55555555-5555-4555-8555-555555555555';
const TASK_B = '66666666-6666-4666-8666-666666666666';

function makeIssue(over: Partial<Issue>): Issue {
  return {
    id: ISSUE_ID,
    title: 'Login broken',
    status: 'open',
    severity: 'medium',
    description: '',
    reproduction: '',
    linkedTaskId: null,
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
      {
        id: TASK_B,
        title: 'Add invites',
        status: 'todo',
        priority: 'low',
        labels: [],
        blockedBy: [],
        milestoneId: null,
        description: '',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    issues: [makeIssue({})],
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

describe('IssueModal linked task select', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockState = makeState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('links a task from the searchable select', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    // inline flow: click + Add to enter linkedTask edit, then open SearchableSelect trigger
    fireEvent.click(screen.getByRole('button', { name: 'Add linked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Linked task' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search Linked task' }), { target: { value: 'invites' } });
    fireEvent.click(screen.getByRole('option', { name: 'Add invites' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { linkedTaskId: TASK_B },
    });
  });

  it('unlinks the task via the None row', () => {
    mockState.issues = [makeIssue({ linkedTaskId: TASK_A })];
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Change linked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Linked task' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { linkedTaskId: null },
    });
  });

  it('renders inline fields mirroring TaskModal', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    // Title is inline editable
    expect(screen.getByRole('button', { name: /Click to edit Title/i })).toBeDefined();
    // Severity and status pills
    expect(screen.getByRole('button', { name: 'Ubah Severity' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ubah Status' })).toBeDefined();
    // Description and reproduction cards
    expect(screen.getByRole('button', { name: 'Edit Description' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit Reproduction steps' })).toBeDefined();
    // Created time is displayed
    expect(screen.getByText('Created time')).toBeDefined();
    // Modal is large (lg)
    expect(document.querySelector('.modal-lg')).not.toBeNull();
  });

  it('edits title inline', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Click to edit Title/i }));
    const input = screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;
    expect(input).toBeDefined();
    fireEvent.change(input, { target: { value: 'New title' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { title: 'New title' },
    });
  });

  it('edits severity via pill select', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Ubah Severity' }));
    const select = document.querySelector('.select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    fireEvent.change(select, { target: { value: 'critical' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { severity: 'critical' },
    });
  });

  it('edits description inline', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Description' }));
    const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New desc' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { description: 'New desc' },
    });
  });
});
