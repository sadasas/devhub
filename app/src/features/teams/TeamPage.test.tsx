import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Team } from '../../lib/types';
import { TeamPage } from './TeamPage';

const teamsApi = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listTeamInvitations: vi.fn(),
  setMemberRole: vi.fn(),
  declineInvitation: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: teamsApi,
  ApiError: class ApiError extends Error {},
}));

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({
    teams: [
      {
        id: 't1',
        name: 'Team A',
        role: 'owner',
        plan: 'free',
        memberCount: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] satisfies Team[],
    refresh: vi.fn(),
    deleteTeam: vi.fn(),
    renameTeam: vi.fn(),
  }),
}));

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@test.dev', displayName: 'Ana', bio: '', createdAt: '' },
  }),
}));

function renderPage(entry = '/team/t1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/team/:teamId" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  teamsApi.listMembers.mockResolvedValue([
    { id: 'u1', email: 'ana@test.dev', role: 'owner', joinedAt: '2026-01-01T00:00:00.000Z' },
  ]);
  teamsApi.listTeamInvitations.mockResolvedValue([]);
});

describe('TeamPage', () => {
  it('renders the team header and member list without chat tabs', async () => {
    renderPage();
    expect(await screen.findByText('Team A')).toBeTruthy();
    expect(screen.getByText('ana@test.dev')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Chat/ })).toBeNull();
    expect(screen.getByRole('tab', { name: /Members/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Billing/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Billing/ }).getAttribute('aria-selected')).toBe('false');
    expect(screen.queryByTestId('chat-panel')).toBeNull();
  });

  it('shows an empty state when the team has no members', async () => {
    teamsApi.listMembers.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No members yet')).toBeTruthy();
  });
});