import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewPage } from './OverviewPage';
import type { Project, State, Task } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());
const listMembersMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const setStatusMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

vi.mock('../../lib/api', () => ({
  api: { listMembers: listMembersMock },
}));

vi.mock('../../state/projects-context', () => ({
  useProjects: () => ({ update: updateMock }),
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
      { id: 'm1', email: 'adit@gmail.com', role: 'editor', joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'm2', email: 'rani@gmail.com', role: 'viewer', joinedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    useProjectMock.mockReturnValue({
      state: makeState(),
      loading: false,
      error: null,
      canEdit: true,
      teamId: 'team1',
      setStatus: setStatusMock,
    });
  });

  it('renders member rows with aggregated numbers and an unassigned row', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
    expect(await screen.findByText('adit@gmail.com')).toBeTruthy();
    expect(screen.getByText('rani@gmail.com')).toBeTruthy();
    expect(screen.getByText('Unassigned')).toBeTruthy();
  });

  it('sorts members by open count desc and computes completion percent', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
    const rows = document.querySelectorAll('.member-row:not(.member-row-head)');
    expect(rows[0]!.textContent).toContain('adit@gmail.com');
    expect(rows[0]!.textContent).toContain('33%');
    expect(rows[1]!.textContent).toContain('rani@gmail.com');
    expect(rows[2]!.textContent).toContain('Unassigned');
  });

  it('marks overdue count with the danger tone', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
    const rows = document.querySelectorAll('.member-row:not(.member-row-head)');
    expect(rows[0]!.querySelector('.member-overdue')).toBeTruthy();
  });

  it('labels the numeric columns Est h and % Done in the header', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
    const head = document.querySelector('.member-row-head');
    expect(head?.textContent).toContain('Est h');
    expect(head?.textContent).toContain('% Done');
  });

  it('aligns the header cells with the data row columns', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
    const head = document.querySelector('.member-row-head');
    expect(head?.children.length).toBe(5);
    expect(head?.children[1]?.textContent).toBe('Member');
    expect(head?.children[3]?.textContent).toContain('Est h');
  });

  it('shows the stacked bar tooltip with open and done counts', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
    const track = document.querySelector('.member-bar-track');
    expect(track?.getAttribute('title')).toBe('2 open · 1 done');
  });

  it('scales bar segments to each member own ratio, not the busiest', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
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
      setStatus: setStatusMock,
    });
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    expect(screen.queryByText('Members')).toBeNull();
  });
});

describe('OverviewPage improvements', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    listMembersMock.mockReset();
    updateMock.mockReset();
    listMembersMock.mockResolvedValue([
      { id: 'm1', email: 'adit@gmail.com', role: 'editor', joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'm2', email: 'rani@gmail.com', role: 'viewer', joinedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    useProjectMock.mockReturnValue({
      state: makeState(),
      loading: false,
      error: null,
      canEdit: true,
      teamId: 'team1',
      setStatus: setStatusMock,
    });
  });

  it('renders an overdue tile that links to the board', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    const tile = await screen.findByRole('link', { name: /Overdue/ });
    expect(tile.getAttribute('href')).toContain('tab=board');
  });

  it('links every counter tile to its tab', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    expect((await screen.findByRole('link', { name: /Open issues/ })).getAttribute('href')).toContain('tab=issues');
    expect((await screen.findByRole('link', { name: /Tables/ })).getAttribute('href')).toContain('tab=schema');
  });

  it('counts priority bars from open tasks only', async () => {
    // makeState: 5 medium-priority tasks, 2 of them done → open-only chart shows 3.
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    const headings = await screen.findAllByText('Tasks by priority');
    const h3 = headings.find((el) => el.tagName === 'H3');
    const priorityCard = h3!.closest('.stat-card');
    expect(priorityCard?.textContent).toContain('Medium');
    const values = [...priorityCard!.querySelectorAll('.bar-value')].map((el) => el.textContent);
    expect(values).toContain('3');
    expect(values).not.toContain('5');
  });

  it('warns about overdue milestones when there is no upcoming one', async () => {
    const state = makeState();
    state.milestones = [
      {
        id: 'ms1',
        name: 'v1.0',
        status: 'planned',
        targetDate: '2020-01-01',
        changelog: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    useProjectMock.mockReturnValue({
      state,
      loading: false,
      error: null,
      canEdit: true,
      teamId: 'team1',
    });
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    expect(await screen.findByText(/Overdue milestones/)).toBeTruthy();
    expect(screen.getByText('v1.0')).toBeTruthy();
  });

  it('shows no header or edit actions at all for read-only roles', async () => {
    useProjectMock.mockReturnValue({
      state: makeState(),
      loading: false,
      error: null,
      canEdit: false,
      teamId: 'team1',
    });
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    await screen.findByText('adit@gmail.com');
    expect(screen.queryByRole('button', { name: /Edit PRD/ })).toBeNull();
    expect(document.querySelector('.data-list-header button')).toBeNull();
    expect(document.querySelector('.data-list-header a')).toBeNull();
  });

  it('renders one edit button per PRD section plus the hero description', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    const edits = await screen.findAllByRole('button', { name: /^Edit PRD:/ });
    expect(edits.length).toBe(6);
  });

  it('opens a single-field composer modal for one section only', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit PRD: Purpose' }));
    const dialog = await screen.findByRole('dialog');
    // Gaya composer ala New task: bare field + chrome modal-composer.
    expect(dialog.className).toContain('modal-composer');
    const boxes = within(dialog).getAllByRole('textbox');
    expect(boxes.length).toBe(1);
    const box = boxes[0]!;
    expect(box.className).toContain('textarea-bare');
    expect((box as HTMLTextAreaElement).value).toBe('Purpose text');
    expect(box.getAttribute('placeholder')).toBe('Why this project exists — the problem it solves.');
    expect(within(dialog).queryByText('Goals')).toBeNull();
    // Judul ganda dihapus: kepala field disembunyikan, judul modal + aria tetap ada.
    expect(dialog.querySelector('.md-bare-head')).toBeNull();
    expect(box.getAttribute('aria-label')).toBe('Purpose');
  });

  it('saves one section without touching the others', async () => {
    updateMock.mockResolvedValue(undefined);
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit PRD: Purpose' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'New purpose' } });
    fireEvent.submit(dialog.querySelector('form')!);
    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith('p1', {
      prd: { purpose: 'New purpose', goals: '', features: '', scope: '', outOfScope: '' },
    });
  });

  it('edits the hero description through its own button', async () => {
    updateMock.mockResolvedValue(undefined);
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit PRD: Description' }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value).toBe('A project workspace.');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'New desc' } });
    fireEvent.submit(dialog.querySelector('form')!);
    await vi.waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith('p1', { description: 'New desc' });
  });

  it('shows the small-team note when at most one member is assigned', async () => {
    const state = makeState();
    state.tasks = [task({ id: 't1', assigneeId: 'm1', status: 'todo' })];
    useProjectMock.mockReturnValue({
      state,
      loading: false,
      error: null,
      canEdit: true,
      teamId: 'team1',
    });
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    expect(await screen.findByText(/Small team/)).toBeTruthy();
  });

  it('labels the role chip as the viewer own role', async () => {
    render(<MemoryRouter><OverviewPage project={PROJECT} /></MemoryRouter>);
    expect(await screen.findByText('Your role: Owner')).toBeTruthy();
  });
});