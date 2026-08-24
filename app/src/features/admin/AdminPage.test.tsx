import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiError, api } from '../../lib/api';
import type { AdminPackage, AdminPayment, AdminStats, AdminUser, User } from '../../lib/types';
import { AdminPage } from './AdminPage';

const ADMIN: User = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@test.dev',
  displayName: 'Admin',
  bio: '',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({ user: ADMIN }),
}));

function makeUser(over: Partial<AdminUser> = {}): AdminUser {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'member@test.dev',
    displayName: '',
    role: 'user',
    teamCount: 1,
    createdAt: '2026-02-01T00:00:00.000Z',
    lastActiveAt: null,
    plan: 'free',
    lastPaymentAmount: null,
    lastPaymentAt: null,
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminPage', () => {
  const STATS: AdminStats = {
    users: 2,
    teams: 2,
    projects: 3,
    activeKeys: 1,
    activity24h: 5,
    activity7d: 20,
    revenue24h: 250000,
    revenue7d: 1000000,
    revenueTotal: 5000000,
    paidTeams: 1,
    pendingPayments: 0,
  };

  const CHARTS = {
    revenueByDay: [],
    revenueByPackage: [],
    teamsByPlan: [],
  };

  it('renders overview tab with platform stats by default', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });

    renderPage();
    expect(await screen.findByText('Revenue Total')).toBeDefined();
    expect(screen.getByText('Paid Teams')).toBeDefined();
    expect(screen.getByText('Pending Payments')).toBeDefined();
  });

  it('does not fetch users list while on overview tab', async () => {
    const usersSpy = vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);

    renderPage();
    expect(await screen.findByText('Revenue Total')).toBeDefined();
    expect(usersSpy).not.toHaveBeenCalled();
  });

  it('switches to users tab and shows the user list', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({
      users: [makeUser()],
      total: 1,
    });

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Users/ }));
    expect(await screen.findByText('member@test.dev')).toBeDefined();
    expect(screen.getByText(/Users/)).toBeDefined();
  });

  it('re-fetches platform stats when Refresh is clicked', async () => {
    const statsSpy = vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });

    renderPage();
    await waitFor(() => expect(statsSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(statsSpy).toHaveBeenCalledTimes(2));
  });

  it('changing activity range does not refetch platform stats', async () => {
    const statsSpy = vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    const activitySpy = vi
      .spyOn(api, 'adminStatsActivity')
      .mockResolvedValue([{ date: '2026-08-24', label: 'Mon', count: 5 }]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });

    renderPage();
    await waitFor(() => expect(statsSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(activitySpy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('tab', { name: /Overview/ }));
    fireEvent.click(screen.getByRole('button', { name: '1M' }));

    await waitFor(() => expect(activitySpy).toHaveBeenCalledWith('1m'));
    expect(statsSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when no users match the search', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Users/ }));
    expect(await screen.findByText('No users found')).toBeDefined();
  });

  it('loads payments lazily per tab', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    const listPayments = vi.spyOn(api, 'listAdminPayments').mockResolvedValue({
      payments: [
        {
          id: 'pay-1',
          teamId: 'team-1',
          teamName: 'Team A',
          orderId: 'DH-001',
          buyerEmail: 'user@test.dev',
          packageName: 'Pro',
          durationDays: 30,
          amount: 250000,
          status: 'completed',
          createdAt: '2026-03-01T00:00:00.000Z',
          completedAt: '2026-03-01T00:05:00.000Z',
        },
      ] as AdminPayment[],
      total: 1,
    });

    renderPage();
    expect(listPayments).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: /Payments/ }));
    expect(await screen.findByText('user@test.dev')).toBeDefined();
    expect(listPayments).toHaveBeenCalledTimes(1);
  });

  it('loads packages lazily per tab', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    const listPackages = vi.spyOn(api, 'adminListPackages').mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Pro',
        description: 'Pro plan',
        isFree: false,
        maxMembers: null,
        maxProjects: null,
        sortOrder: 1,
        isActive: true,
        prices: [
          { id: 'price-1', durationDays: 30, priceIdr: 250000 },
          { id: 'price-2', durationDays: 365, priceIdr: 2500000 },
        ],
      },
    ] as AdminPackage[]);

    renderPage();
    expect(listPackages).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: /Packages/ }));
    expect(await screen.findByText('Pro')).toBeDefined();
    expect(screen.getByText('Rp 250.000')).toBeDefined();
    expect(listPackages).toHaveBeenCalledTimes(1);
  });

  it('loads teams lazily per tab', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    const listTeams = vi.spyOn(api, 'listAdminTeams').mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Team A',
        ownerEmail: 'admin@test.dev',
        memberCount: 2,
        projectCount: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    renderPage();
    expect(listTeams).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: /Teams/ }));
    expect(await screen.findByText('Team A')).toBeDefined();
  });

  it('shows an error with retry when the teams list fails to load', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    const listTeams = vi
      .spyOn(api, 'listAdminTeams')
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'))
      .mockResolvedValue([
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Team A',
          ownerEmail: 'admin@test.dev',
          memberCount: 2,
          projectCount: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]);

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Teams/ }));

    expect(await screen.findByText(/Cannot reach the server/)).toBeDefined();
    expect(screen.queryByText('No teams yet')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Team A')).toBeDefined();
    expect(listTeams).toHaveBeenCalledTimes(2);
  });
});
