import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardSettingsTab } from './DashboardSettingsTab';
import type { BillingStatus, Team, User } from '../../lib/types';

const useTeamsMock = vi.hoisted(() => vi.fn());
const useAuthMock = vi.hoisted(() => vi.fn());
const billingStatusMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/teams-context', () => ({ useTeams: useTeamsMock }));
vi.mock('../../state/auth-context', () => ({ useAuth: useAuthMock }));
vi.mock('../../lib/api', () => ({
  api: {
    billingStatus: billingStatusMock,
    checkTeamSlug: vi.fn(),
    removeMember: vi.fn(),
  },
}));

function team(over: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    name: 'Alpha',
    icon: null,
    slug: 'alpha',
    role: 'owner',
    plan: 'free',
    planPackageName: 'Free',
    memberCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const user: User = {
  id: 'u1',
  email: 'u@example.com',
  displayName: 'U',
  bio: '',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const billing: BillingStatus = {
  team: { id: 'team-1', name: 'Alpha', plan: 'free', planExpiresAt: null, planPackageName: 'Free' },
  usage: { members: { used: 1, limit: 2 }, projects: { used: 1, limit: 3 } },
  payments: [],
};

function renderSettings(entry: string, teamValue: Team = team()) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <DashboardSettingsTab team={teamValue} onBackToProjects={() => {}} />
    </MemoryRouter>,
  );
}

describe('DashboardSettingsTab panel', () => {
  beforeEach(() => {
    useTeamsMock.mockReset();
    useAuthMock.mockReset();
    billingStatusMock.mockReset();
    useTeamsMock.mockReturnValue({
      renameTeam: vi.fn(),
      renameSlug: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    useAuthMock.mockReturnValue({ user });
    billingStatusMock.mockResolvedValue(billing);
  });

  it('renders the General section by default without any sidebar', async () => {
    renderSettings('/alpha/settings');
    expect(await screen.findByRole('heading', { name: 'General' })).toBeTruthy();
    // Single-sidebar rule: the nav lives in the main sidebar, not here.
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Plan' })).toBeNull();
  });

  it('shows the Plan section for ?section=plan', async () => {
    renderSettings('/alpha/settings?section=plan');
    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'General' })).toBeNull();
  });

  it('maps the legacy ?section=billing deep-link to Usage', async () => {
    renderSettings('/alpha/settings?section=billing');
    expect(await screen.findByRole('heading', { name: 'Usage' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'General' })).toBeNull();
  });

  it('falls back to General for an unknown section', async () => {
    renderSettings('/alpha/settings?section=nope');
    expect(await screen.findByRole('heading', { name: 'General' })).toBeTruthy();
  });

  it('falls back to General for the removed ?section=github (moved to project settings)', async () => {
    renderSettings('/alpha/settings?section=github');
    expect(await screen.findByRole('heading', { name: 'General' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'GitHub' })).toBeNull();
  });

  it('renders no-access without content for viewers', async () => {
    renderSettings('/alpha/settings', team({ role: 'viewer' }));
    expect(await screen.findByText('No access to settings')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
