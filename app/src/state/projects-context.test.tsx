import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsProvider, useProjects } from './projects-context';
import type { Project } from '../lib/types';

vi.mock('../lib/api', () => ({
  api: {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    patchProject: vi.fn(),
  },
}));

vi.mock('../lib/idb-provider', () => ({
  isNetworkError: vi.fn((err: unknown) => (err as { status?: number } | null)?.status === 0),
}));

const { getMetaMock, putMetaMock } = vi.hoisted(() => ({
  getMetaMock: vi.fn(),
  putMetaMock: vi.fn(),
}));

vi.mock('../lib/idb', () => ({
  getMeta: getMetaMock,
  putMeta: putMetaMock,
}));

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

describe('projects-context offline bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caches the list after a successful load', async () => {
    vi.mocked(api.listProjects).mockResolvedValue([PROJECT]);

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    );

    await screen.findByText('1');
    expect(putMetaMock).toHaveBeenCalledWith('projects', [PROJECT]);
  });

  it('boots from the cached list when the network fails', async () => {
    vi.mocked(api.listProjects).mockRejectedValue({ status: 0 });
    getMetaMock.mockResolvedValue([PROJECT]);

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    );

    await screen.findByText('1');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('surfaces an error when offline and no cache exists', async () => {
    vi.mocked(api.listProjects).mockRejectedValue({ status: 0 });
    getMetaMock.mockResolvedValue(undefined);

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    );

    await screen.findByText('none');
    expect(screen.getByTestId('error').textContent).not.toBe('');
  });
});