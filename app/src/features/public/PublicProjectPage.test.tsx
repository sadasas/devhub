import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiError, api } from '../../lib/api';
import type { PublicProject, State } from '../../lib/types';
import { PublicProjectPage } from './PublicProjectPage';

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({ user: null }),
}));

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function makeMeta(over: Partial<PublicProject> = {}): PublicProject {
  return {
    id: PROJECT_ID,
    name: 'Demo Project',
    description: 'A public demo',
    status: 'active',
    visibility: 'public',
    tabs: ['board', 'issues', 'stack', 'milestones', 'about'],
    prd: {
      purpose: '',
      goals: '',
      features: '',
      scope: '',
      outOfScope: '',
    },
    teamName: 'Personal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...over,
  };
}

function makeState(over: Partial<State> = {}): State {
  return {
    tasks: [],
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
    ...over,
  };
}

function renderPage(entries: string[] = [`/p/${PROJECT_ID}`]) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <PublicProjectPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PublicProjectPage', () => {
  it('renders every task in its board column without truncation', async () => {
    const base = { id: 't', title: 'Task', status: 'todo' as const, priority: 'medium' as const, labels: [], blockedBy: [], description: '' };
    const tasks = Array.from({ length: 25 }, (_, i) => ({
      ...base,
      id: `t${i}`,
      title: `Task ${i}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    vi.spyOn(api, 'getPublicProject').mockResolvedValue(makeMeta());
    vi.spyOn(api, 'getPublicState').mockResolvedValue({ state: makeState({ tasks }), version: 1 });

    const { container } = renderPage();
    const heading = await screen.findByRole('heading', { name: 'Demo Project' });
    expect(heading).toBeDefined();

    await waitFor(() => {
      expect(container.querySelectorAll('.task-card').length).toBe(25);
    });
    expect(screen.getByText('25')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
  });

  it('groups tasks by milestone with an Unassigned column', async () => {
    const base = { id: 't', priority: 'medium' as const, labels: [], blockedBy: [], description: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    vi.spyOn(api, 'getPublicProject').mockResolvedValue(makeMeta());
    vi.spyOn(api, 'getPublicState').mockResolvedValue(
      { state: makeState({
        milestones: [
          { id: 'm1', name: 'Alpha', version: '1.0.0', status: 'planned', targetDate: '2026-03-01', changelog: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
        tasks: [
          { ...base, id: 't1', title: 'Milestoned task', status: 'todo', milestoneId: 'm1' },
          { ...base, id: 't2', title: 'Milestoned done', status: 'done', milestoneId: 'm1' },
          { ...base, id: 't3', title: 'Unassigned task', status: 'inProgress', milestoneId: null },
        ],
      }), version: 1 },
    );

    renderPage();
    await screen.findByRole('heading', { name: 'Demo Project' });

    fireEvent.click(screen.getByRole('tab', { name: 'By Milestone' }));

    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('1.0.0')).toBeDefined();
    expect(screen.getByText('Unassigned')).toBeDefined();
    await waitFor(() => {
      expect(screen.getAllByText('2 · 50%').length).toBeGreaterThan(0);
    });
  });

  it('shows issue description and reproduction on the Issues tab', async () => {
    vi.spyOn(api, 'getPublicProject').mockResolvedValue(makeMeta());
    vi.spyOn(api, 'getPublicState').mockResolvedValue(
      { state: makeState({
        issues: [
          {
            id: 'i1',
            title: 'Login broken',
            severity: 'high',
            status: 'open',
            description: 'Root cause is the expired token check.',
            reproduction: '1. Log in\n2. Wait 25 hours\n3. Refresh',
            linkedTaskId: null,
            authorId: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }), version: 1 },
    );

    renderPage();
    await screen.findByRole('heading', { name: 'Demo Project' });

    fireEvent.click(screen.getByRole('tab', { name: 'Issues' }));

    expect(await screen.findByText('Login broken')).toBeDefined();
    expect(screen.getByText('Root cause is the expired token check.')).toBeDefined();
    const repro = screen.getByText(/1\. Log in/);
    expect(repro.textContent).toContain('2. Wait 25 hours');
  });

  it('shows a not-found state when the project is private or missing', async () => {
    vi.spyOn(api, 'getPublicProject').mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Project not found'),
    );
    vi.spyOn(api, 'getPublicState').mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Project not found'),
    );

    renderPage();

    expect(await screen.findByText('Project not found')).toBeDefined();
    expect(
      screen.getByText('This project does not exist or is not shared publicly.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to DevHub' })).toBeDefined();
  });

  it('shows an error state on network failure', async () => {
    vi.spyOn(api, 'getPublicProject').mockRejectedValue(
      new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'),
    );
    vi.spyOn(api, 'getPublicState').mockRejectedValue(
      new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'),
    );

    renderPage();

    expect(
      await screen.findByText('Cannot reach the server. Is it running?'),
    ).toBeDefined();
  });

  it('renders only the tabs the owner shared publicly', async () => {
    vi.spyOn(api, 'getPublicProject').mockResolvedValue(
      makeMeta({ tabs: ['board', 'milestones'] }),
    );
    vi.spyOn(api, 'getPublicState').mockResolvedValue({ state: makeState(), version: 1 });

    renderPage();
    await screen.findByRole('heading', { name: 'Demo Project' });

    const nav = screen.getByRole('tablist', { name: 'Public project sections' });
    const tabNames = Array.from(nav.querySelectorAll('[role="tab"]')).map(
      (el) => el.textContent?.trim(),
    );
    expect(tabNames).toEqual(['Board', 'Milestones']);
  });

  it('falls back to the first public tab when the requested tab is not shared', async () => {
    vi.spyOn(api, 'getPublicProject').mockResolvedValue(
      makeMeta({ tabs: ['milestones'] }),
    );
    vi.spyOn(api, 'getPublicState').mockResolvedValue({ state: makeState(), version: 1 });

    renderPage([`/p/${PROJECT_ID}?tab=issues`]);
    await screen.findByRole('heading', { name: 'Demo Project' });

    expect(screen.getByRole('tab', { name: 'Milestones' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('shows only the stat cards that belong to public tabs on About', async () => {
    vi.spyOn(api, 'getPublicProject').mockResolvedValue(
      makeMeta({ tabs: ['about', 'stack'] }),
    );
    vi.spyOn(api, 'getPublicState').mockResolvedValue(
      {
        state: makeState({
          tasks: [{ id: 't1', title: 'Task', status: 'todo', priority: 'medium', labels: [], blockedBy: [], description: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
          techEntries: [{ id: 'e1', name: 'React', version: '19', category: 'frontend', status: 'current', notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
        }),
        version: 1,
      },
    );

    renderPage([`/p/${PROJECT_ID}?tab=about`]);
    await screen.findByRole('heading', { name: 'Demo Project' });

    expect(await screen.findByText('Stack entries')).toBeDefined();
    expect(screen.getByText('Test cases')).toBeDefined();
    expect(screen.queryByText('Tasks')).toBeNull();
  });
});