import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApiError } from '../lib/api';
import { getMeta, openDevHubDb, putMeta, resetDevHubDb } from '../lib/idb';
import type { Project } from '../lib/types';
import { ProjectsProvider, useProjects } from './projects-context';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      listProjects: vi.fn(),
      createProject: vi.fn(),
      deleteProject: vi.fn(),
      patchProject: vi.fn(),
    },
  };
});

import { api } from '../lib/api';

const PROJECT: Project = {
  id: 'p1',
  name: 'One',
  description: '',
  status: 'active',
  visibility: 'private',
  tabs: ['board', 'issues'],
  prd: { purpose: '', goals: '', features: '', scope: '', outOfScope: '' },
  teamId: 't1',
  teamName: 'Team',
  role: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function Probe() {
  const { projects, loading, error } = useProjects();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="count">{projects ? projects.length : 'none'}</span>
      <span data-testid="error">{error ?? ''}</span>
    </div>
  );
}

describe('projects-context with the real IndexedDB cache', () => {
  beforeEach(async () => {
    await openDevHubDb();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDevHubDb();
  });

  it('persists the fetched list into the real meta store', async () => {
    vi.mocked(api.listProjects).mockResolvedValue([PROJECT]);

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    );

    await screen.findByText('1');
    expect(await getMeta<Project[]>('projects')).toEqual([PROJECT]);
  });

  it('boots from the real cached meta store on a network error', async () => {
    await putMeta('projects', [PROJECT]);
    vi.mocked(api.listProjects).mockRejectedValue(
      new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'),
    );

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    );

    await screen.findByText('1');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('does not hydrate from the cache on a 401', async () => {
    await putMeta('projects', [PROJECT]);
    vi.mocked(api.listProjects).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'nope'));

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    );

    await screen.findByText('none');
    expect(screen.getByTestId('error').textContent).not.toBe('');
  });
});
