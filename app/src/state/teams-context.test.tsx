import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamsProvider, useTeams } from './teams-context';
import type { Team } from '../lib/types';

vi.mock('../lib/api', () => ({
  api: {
    listTeams: vi.fn(),
    listInvitations: vi.fn(),
    createTeam: vi.fn(),
    renameTeam: vi.fn(),
    deleteTeam: vi.fn(),
    inviteMember: vi.fn(),
    acceptInvitation: vi.fn(),
    declineInvitation: vi.fn(),
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

const TEAM: Team = {
  id: 't1',
  name: 'Team One',
  role: 'owner',
  plan: 'free',
  planPackageName: 'Free',
  memberCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function Probe() {
  const { teams, loading, error } = useTeams();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="count">{teams ? teams.length : 'none'}</span>
      <span data-testid="error">{error ?? ''}</span>
    </div>
  );
}

describe('teams-context offline bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caches the team list after a successful load', async () => {
    vi.mocked(api.listTeams).mockResolvedValue([TEAM]);
    vi.mocked(api.listInvitations).mockResolvedValue([]);

    render(
      <TeamsProvider>
        <Probe />
      </TeamsProvider>,
    );

    await screen.findByText('1');
    expect(putMetaMock).toHaveBeenCalledWith('teams', [TEAM]);
  });

  it('boots from the cached team list when the network fails', async () => {
    vi.mocked(api.listTeams).mockRejectedValue({ status: 0 });
    getMetaMock.mockResolvedValue([TEAM]);

    render(
      <TeamsProvider>
        <Probe />
      </TeamsProvider>,
    );

    await screen.findByText('1');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('surfaces an error when offline and no cache exists', async () => {
    vi.mocked(api.listTeams).mockRejectedValue({ status: 0 });
    getMetaMock.mockResolvedValue(undefined);

    render(
      <TeamsProvider>
        <Probe />
      </TeamsProvider>,
    );

    await screen.findByText('none');
    expect(screen.getByTestId('error').textContent).not.toBe('');
  });
});