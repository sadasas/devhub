import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewPage } from './OverviewPage';
import type { Project, State, Task } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());
const listMembersMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

vi.mock('../../lib/api', () => ({
  api: { listMembers: listMembersMock },
}));

vi.mock('../../state/projects-context', () => ({
  useProjects: () => ({ update: vi.fn() }),
}));

function task(over: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'Task',
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

function makeState(): State {
  return {
    tasks: [
      task({ id: 't1', assigneeId: 'm1', status: 'todo', estimate: 4, dueDate: '2026-08-01' }),
      task({ id: 't2', assigneeId: 'm1', status: 'inProgress' }),
      task({ id: 't3', assigneeId: 'm1', status: 'done' }),
      task({ id: 't4', assigneeId: 'm2', status: 'done' }),
      task({ id: 't5', status: 'todo' }),
    ],
    issues: [],
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

const PROJECT: Project = {
  id: 'p1',
  name: 'DevHub',
  description: 'A project workspace.',
  status: 'active',
  visibility: 'private',
  tabs: ['board', 'about', 'whiteboard'],
  prd: {
    purpose: 'Purpose text',
    goals: '',
    features: '',
    scope: '',
    outOfScope: '',
  },
  teamId: 'team1',
  teamName: 'Team',
  role: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('OverviewPage members', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    listMembersMock.mockReset();
    listMembersMock.mockResolvedValue([
      { id: 'm1', email: 'adit@test.dev', role: 'editor', joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'm2', email: 'rani@test.dev', role: 'viewer', joinedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    useProjectMock.mockReturnValue({
      state: makeState(),
      loading: false,
      error: null,
      canEdit: true,
      teamId: 'team1',
    });
  });

  it('renders member rows with aggregated numbers and an unassigned row', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@test.dev');
    expect(await screen.findByText('adit@test.dev')).toBeTruthy();
    expect(screen.getByText('rani@test.dev')).toBeTruthy();
    expect(screen.getByText('Unassigned')).toBeTruthy();
  });

  it('sorts members by open count desc and computes completion percent', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@test.dev');
    const rows = document.querySelectorAll('.member-row:not(.member-row-head)');
    expect(rows[0]!.textContent).toContain('adit@test.dev');
    expect(rows[0]!.textContent).toContain('33%');
    expect(rows[1]!.textContent).toContain('rani@test.dev');
    expect(rows[2]!.textContent).toContain('Unassigned');
  });

  it('marks overdue count with the danger tone', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@test.dev');
    const rows = document.querySelectorAll('.member-row:not(.member-row-head)');
    expect(rows[0]!.querySelector('.member-overdue')).toBeTruthy();
  });

  it('labels the numeric columns Est h and % Done in the header', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@test.dev');
    const head = document.querySelector('.member-row-head');
    expect(head?.textContent).toContain('Est h');
    expect(head?.textContent).toContain('% Done');
  });

  it('aligns the header cells with the data row columns', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@test.dev');
    const head = document.querySelector('.member-row-head');
    expect(head?.children.length).toBe(5);
    expect(head?.children[1]?.textContent).toBe('Member');
    expect(head?.children[3]?.textContent).toContain('Est h');
  });

  it('shows the stacked bar tooltip with open and done counts', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@test.dev');
    const track = document.querySelector('.member-bar-track');
    expect(track?.getAttribute('title')).toBe('2 open · 1 done');
  });

  it('scales bar segments to each member own ratio, not the busiest', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@test.dev');
    const tracks = document.querySelectorAll('.member-bar-track');
    const aditFills = tracks[0]!.querySelectorAll('.member-bar-fill');
    expect(parseFloat((aditFills[0] as HTMLElement).style.width)).toBeCloseTo(66.67, 1);
    expect(parseFloat((aditFills[1] as HTMLElement).style.width)).toBeCloseTo(33.33, 1);
    const unassignedFills = tracks[2]!.querySelectorAll('.member-bar-fill');
    expect(parseFloat((unassignedFills[0] as HTMLElement).style.width)).toBe(100);
    expect(parseFloat((unassignedFills[1] as HTMLElement).style.width)).toBe(0);
  });

  it('skips the members section when there are no tasks', async () => {
    const state = makeState();
    state.tasks = [];
    useProjectMock.mockReturnValue({
      state,
      loading: false,
      error: null,
      canEdit: true,
      teamId: 'team1',
    });
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    expect(screen.queryByText('Members')).toBeNull();
  });
});