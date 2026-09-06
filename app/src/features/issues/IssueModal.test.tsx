import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Issue, State } from '../../lib/types';
import { IssueModal } from './IssueModal';

const { setStatusMock, fetchActivityMock, canEditMock } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
  fetchActivityMock: vi.fn(),
  canEditMock: { value: true },
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: canEditMock.value, projectId: 'p1', setStatus: setStatusMock }),
}));

vi.mock('../../lib/api', () => ({
  api: { fetchActivity: fetchActivityMock },
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
    canEditMock.value = true;
    setStatusMock.mockClear();
    fetchActivityMock.mockReset();
    fetchActivityMock.mockResolvedValue([]);
    mockState = makeState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('links a task from the searchable select', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    // PropRow flow: single activator click, then straight to combobox/option.
    fireEvent.click(document.querySelector('[data-prop="linkedTask"] .prop-view') as Element);
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
    fireEvent.click(screen.getByRole('button', { name: 'Ship chat' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { linkedTaskId: null },
    });
  });

  it('renders composer fields mirroring TaskModal', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    // Title is an always-editable composer textarea (Name unification)
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDefined();
    // Severity and status pills
    expect(screen.getByRole('button', { name: 'Medium' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open' })).toBeDefined();
    // Linked task activator shows — with a label column
    expect(document.querySelector('[data-prop="linkedTask"] .prop-label')?.textContent).toBe('Linked task');
    expect(document.querySelector('[data-prop="linkedTask"] .prop-view')).toBeTruthy();
    // Description and reproduction bare markdown fields
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Reproduction steps' })).toBeDefined();
    // Created time is displayed
    expect(screen.getByText('Created time')).toBeDefined();
    // Footer delete for editors
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined();
    // Modal is large (lg)
    expect(document.querySelector('.modal-lg')).not.toBeNull();
  });

  it('edits title in the composer title field', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    const input = screen.getByRole('textbox', { name: 'Name' }) as HTMLTextAreaElement;
    expect(input).toBeDefined();
    fireEvent.change(input, { target: { value: 'New title' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { title: 'New title' },
    });
  });

  it('shows titleRequired when the title is empty', () => {
    mockState.issues = [makeIssue({ title: '   ' })];
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Title is required')).toBeDefined();
  });

  it('edits severity via pill select', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
    fireEvent.click(screen.getByRole('option', { name: 'Critical' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { severity: 'critical' },
    });
  });

  it('edits status via pill select', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('option', { name: 'Resolved' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { status: 'resolved' },
    });
  });

  it('edits description inline', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    const textarea = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New desc' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { description: 'New desc' },
    });
  });

  it('opens severity options in a single activator click', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
    expect(screen.getByRole('option', { name: 'Critical' })).toBeTruthy();
  });

  it('returns to view after picking a severity', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
    fireEvent.click(screen.getByRole('option', { name: 'High' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'issue/update',
      id: ISSUE_ID,
      patch: { severity: 'high' },
    });
    const row = document.querySelector('[data-prop="severity"]');
    expect(row?.querySelector('.prop-view')).toBeTruthy();
    expect(document.querySelector('#issue-severity')).toBeNull();
  });

  it('marks the row hot while its control is mounted', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('[data-prop="status"]');
    expect(row?.getAttribute('data-hot')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(row?.getAttribute('data-hot')).toBeTruthy();
  });

  it('renders severity/status badges without dot spans', () => {
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    const sevRow = document.querySelector('[data-prop="severity"]');
    expect(sevRow?.querySelector('.prop-view span span')).toBeNull();
    const statusRow = document.querySelector('[data-prop="status"]');
    expect(statusRow?.querySelector('.prop-view span span')).toBeNull();
  });

  it('renders plain values without controls when read-only', () => {
    canEditMock.value = false;
    mockState.issues = [makeIssue({ description: 'Broken on login', reproduction: 'Click login' })];
    render(<MemoryRouter><IssueModal issueId={ISSUE_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Login broken')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Medium' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByText('Broken on login')).toBeTruthy();
    expect(screen.getByText('Click login')).toBeTruthy();
  });
});
