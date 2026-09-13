import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
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
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({
      users: [makeUser()],
      total: 1,
    });

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Users/ }));
    expect(await screen.findByText('member@test.dev')).toBeDefined();
    // Fase 1: tab + tab-toolbar-title sama-sama "Users" → pakai getAllByText
    expect(screen.getAllByText(/Users/).length).toBeGreaterThan(0);
    // Fase 1: wrapper density-compact + tabel semantik
    expect(document.querySelector('.density-compact')).not.toBeNull();
    expect(document.querySelector('table.admin-table')).not.toBeNull();
  });

  it('re-fetches platform stats when Refresh is clicked', async () => {
    const statsSpy = vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
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
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Users/ }));
    expect(await screen.findByText('No users found')).toBeDefined();
  });

  it('loads payments lazily per tab', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
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
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
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
        isFeatured: true,
        prices: [
          { id: 'price-1', durationDays: 30, priceIdr: 250000 },
          { id: 'price-2', durationDays: 365, priceIdr: 2500000 },
        ],
      },
    ] as AdminPackage[]);

    renderPage();
    expect(listPackages).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: /Plans|Packages/ }));
    expect(await screen.findByText('Pro')).toBeDefined();
    expect(screen.getByText('Rp 250.000')).toBeDefined();
    expect(listPackages).toHaveBeenCalledTimes(1);
  });

  it('loads teams lazily per tab', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    const listTeams = vi.spyOn(api, 'listAdminTeams').mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Team A',
        plan: 'free' as const,
        planPackageId: null,
        planDurationDays: null,
        planExpiresAt: null,
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
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
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
          plan: 'free' as const,
          planPackageId: null,
          planDurationDays: null,
          planExpiresAt: null,
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

  it('shows last-refresh timestamp next to ghost Refresh (Fase 1)', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });

    renderPage();
    expect(await screen.findByText('Revenue Total')).toBeDefined();
    // timestamp muncul setelah settled (initial load)
    expect(await screen.findByText(/Last refresh|Not refreshed/)).toBeDefined();
    const refreshBtn = screen.getByRole('button', { name: 'Refresh' });
    expect(refreshBtn.className).toMatch(/btn-ghost/);
  });

  it('renders users payment IDR right-aligned tabular (Fase 1)', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({
      users: [
        makeUser({
          displayName: 'Member',
          lastPaymentAmount: 250000,
          lastPaymentAt: '2026-03-01T00:00:00.000Z',
        }),
      ],
      total: 1,
    });

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Users/ }));
    expect(await screen.findByText('Rp 250.000')).toBeDefined();
    const cell = screen.getByText('Rp 250.000').closest('td');
    expect(cell?.className).toMatch(/num/);
    expect(screen.getByText('Rp 250.000').className).toMatch(/tabular/);
  });

  it('shows numbered pager with Showing x of y on users (Fase 1)', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    const many = Array.from({ length: 25 }, (_, i) =>
      makeUser({ id: `22222222-2222-4222-8222-2222222222${String(i).padStart(2, '0')}`, email: `u${i}@test.dev` }),
    );
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: many, total: 30 });

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Users/ }));
    expect(await screen.findByText(/Showing 1.*of 30/)).toBeDefined();
    // numbered buttons 1 dan 2
    expect(screen.getByRole('button', { name: /Go to page 2|Ke halaman 2/ })).toBeDefined();
  });

  it('packages uses single ⋯ row menu and neutral inactive badge (Fase 1)', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    vi.spyOn(api, 'adminListPackages').mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Pro',
        description: '',
        isFree: false,
        maxMembers: null,
        maxProjects: null,
        sortOrder: 1,
        isActive: false,
        isFeatured: false,
        prices: [{ id: 'price-1', durationDays: 30, priceIdr: 250000 }],
      },
    ] as AdminPackage[]);

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Plans|Packages/ }));
    expect(await screen.findByText('Pro')).toBeDefined();
    // satu menu ⋯ per baris (bukan 3 ikon)
    const menuBtn = await screen.findByRole('button', { name: /Row actions|Aksi baris/ });
    expect(menuBtn).toBeDefined();
    expect(menuBtn.getAttribute('aria-label')).toBeTruthy();
    // badge nonaktif = neutral, bukan danger (bedakan dari segmented "Inactive")
    const inactive =
      screen.getAllByText('Inactive').find((el) => el.closest('.badge')) ?? screen.getAllByText('Inactive')[0];
    expect(inactive?.closest('.badge')?.className).toMatch(/badge-neutral/);
    expect(inactive?.closest('.badge')?.className).not.toMatch(/badge-danger/);
    // baris dim (Opsi B)
    expect(document.querySelector('tr.is-dim')).not.toBeNull();
    // header kanan: Export sekunder + New package primer
    expect(screen.getByRole('button', { name: /Export CSV|Ekspor CSV/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /New package/ })).toBeDefined();
  });

  it('payments empty-filtered shows reset action (Fase 1)', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    vi.spyOn(api, 'listAdminPayments').mockResolvedValue({ payments: [], total: 0 });

    render(
      <MemoryRouter initialEntries={['/?tab=payments&status=pending']}>
        <AdminPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('No payments yet')).toBeDefined();
    expect(screen.getByRole('button', { name: /Reset filters|Atur ulang/ })).toBeDefined();
  });

  it('packages edit opens right drawer with aria-modal (Fase 2)', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    vi.spyOn(api, 'adminListPackages').mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Pro',
        description: '',
        isFree: false,
        maxMembers: null,
        maxProjects: null,
        sortOrder: 1,
        isActive: true,
        isFeatured: false,
        prices: [{ id: 'price-1', durationDays: 30, priceIdr: 250000 }],
      },
    ] as AdminPackage[]);

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Plans|Packages/ }));
    expect(await screen.findByText('Pro')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Row actions|Aksi baris/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit/ }));
    const dialog = await screen.findByRole('dialog', { name: /Edit package/ });
    // drawer kanan, bukan modal tengah
    expect(dialog.className).toMatch(/drawer/);
    expect(dialog.className).not.toMatch(/modal-md/);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    // footer: Batal ghost kiri + primer kanan tetap ada
    expect(screen.getByRole('button', { name: /Cancel|Batal/ })).toBeDefined();
  });

  it('shows inactive badge only on inactive prices (price isActive indicator)', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    vi.spyOn(api, 'adminListPackages').mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Pro',
        description: '',
        isFree: false,
        maxMembers: null,
        maxProjects: null,
        sortOrder: 1,
        isActive: true,
        isFeatured: false,
        prices: [
          { id: 'price-1', durationDays: 30, priceIdr: 250000, originalPriceIdr: null, isActive: true },
          { id: 'price-2', durationDays: 365, priceIdr: 2500000, originalPriceIdr: null, isActive: false },
        ],
      },
    ] as AdminPackage[]);

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Plans|Packages/ }));
    expect(await screen.findByText('Pro')).toBeDefined();
    // Paket aktif → badge level paket "Active"; "Inactive" di tabel hanya di baris harga nonaktif
    // (scope tabel: abaikan tombol segmen filter "Inactive" di FilterBar)
    const table = within(document.querySelector('table.admin-table') as HTMLElement);
    expect(table.getAllByText('Inactive')).toHaveLength(1);
    expect(screen.getByText('Rp 2.500.000')).toBeDefined();
  });

  it('package drawer marks inactive price rows with badge + reactivate hint', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    vi.spyOn(api, 'adminListPackages').mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Pro',
        description: '',
        isFree: false,
        maxMembers: null,
        maxProjects: null,
        sortOrder: 1,
        isActive: true,
        isFeatured: false,
        prices: [
          { id: 'price-1', durationDays: 30, priceIdr: 250000, originalPriceIdr: null, isActive: true },
          { id: 'price-2', durationDays: 365, priceIdr: 2500000, originalPriceIdr: null, isActive: false },
        ],
      },
    ] as AdminPackage[]);

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Plans|Packages/ }));
    expect(await screen.findByText('Pro')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Row actions|Aksi baris/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit/ }));
    const dialog = await screen.findByRole('dialog', { name: /Edit package/ });
    const scope = within(dialog as HTMLElement);
    expect(scope.getAllByText('Inactive')).toHaveLength(1);
    expect(scope.getByText(/reactivate it on save|tetap.*nonaktif/)).toBeDefined();
  });

  it('team plan modal offers only active prices (inactive hidden)', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'adminStatsCharts').mockResolvedValue(CHARTS);
    vi.spyOn(api, 'adminStatsActivity').mockResolvedValue([]);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    vi.spyOn(api, 'listAdminTeams').mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Team A',
        plan: 'free' as const,
        planPackageId: null,
        planDurationDays: null,
        planExpiresAt: null,
        ownerEmail: 'admin@test.dev',
        memberCount: 2,
        projectCount: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    vi.spyOn(api, 'adminListPackages').mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Pro',
        description: '',
        isFree: false,
        maxMembers: null,
        maxProjects: null,
        sortOrder: 1,
        isActive: true,
        isFeatured: false,
        prices: [
          { id: 'price-1', durationDays: 30, priceIdr: 250000, originalPriceIdr: null, isActive: true },
          { id: 'price-2', durationDays: 365, priceIdr: 2500000, originalPriceIdr: null, isActive: false },
        ],
      },
    ] as AdminPackage[]);

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Teams/ }));
    expect(await screen.findByText('Team A')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Row actions|Aksi baris/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Change plan|Ubah plan/ }));
    const dialog = await screen.findByRole('dialog', { name: /Change team plan/ });
    const scope = within(dialog as HTMLElement);
    expect(scope.getByRole('button', { name: /30d/ })).toBeDefined();
    expect(scope.queryByRole('button', { name: /365d/ })).toBeNull();
  });
});

