import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { BillingPackage } from '../../lib/types';
import { PricingPage } from './PricingPage';

const { mockListPackages, mockStartCheckout } = vi.hoisted(() => ({
  mockListPackages: vi.fn(),
  mockStartCheckout: vi.fn(),
}));

let mockUser: { id: string } | null = null;
let mockTeams: { id: string; name: string }[] = [];

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, listPackages: mockListPackages, startCheckout: mockStartCheckout },
  };
});

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({ teams: mockTeams }),
}));

function renderPage(initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PricingPage />
    </MemoryRouter>,
  );
}

const PACKAGES: BillingPackage[] = [
  {
    id: 'pkg-free',
    name: 'Free',
    description: 'For getting started',
    isFree: true,
    maxMembers: 2,
    maxProjects: 3,
    prices: [],
  },
  {
    id: 'pkg-pro',
    name: 'Pro',
    description: 'Unlimited members & projects',
    isFree: false,
    maxMembers: null,
    maxProjects: null,
    prices: [
      { id: 'pr-30', durationDays: 30, priceIdr: 250_000, originalPriceIdr: null },
      { id: 'pr-365', durationDays: 365, priceIdr: 2_500_000, originalPriceIdr: null },
    ],
  },
];

describe('PricingPage (single-page flow)', () => {
  beforeEach(() => {
    mockListPackages.mockReset().mockResolvedValue({ packages: PACKAGES });
    mockStartCheckout.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockUser = null;
    mockTeams = [];
  });

  it('renders both plans with dynamic limits and duration cards', async () => {
    renderPage();

    expect(await screen.findByText('Free')).toBeDefined();
    expect(screen.getByText('Pro')).toBeDefined();
    expect(screen.getByText(/2 members/)).toBeDefined();
    expect(screen.getByText(/3 projects/)).toBeDefined();
    expect(screen.getAllByText('Unlimited members').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Unlimited projects').length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('1 bulan')).toBeDefined();
    expect(screen.getByText(/12 bulan/)).toBeDefined();
  });

  it('shows dynamic CTA with price', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /Upgrade ke Pro/ })).toBeDefined();
  });

  it('shows duration cards on the page (no step 2)', async () => {
    renderPage();

    expect(await screen.findByText('Pilih periode:')).toBeDefined();
    expect(screen.getByText('1 bulan')).toBeDefined();
    expect(screen.getByText(/12 bulan/)).toBeDefined();
  });

  it('shows a register CTA for anonymous visitors', async () => {
    renderPage();

    expect(await screen.findByText(/Buat akun gratis/)).toBeDefined();
  });

  it('renders FAQ section', async () => {
    renderPage();

    expect(await screen.findByText('Pertanyaan Umum')).toBeDefined();
    expect(screen.getByText('Bagaimana cara upgrade?')).toBeDefined();
    expect(screen.getByText('Apakah ada free trial?')).toBeDefined();
  });

  it('renders trust section', async () => {
    renderPage();

    expect(await screen.findByText(/Pembayaran aman/)).toBeDefined();
    expect(screen.getByText(/Powered by Pakasir/)).toBeDefined();
  });

  it('shows checkout error on the correct card when multiple paid packages', async () => {
    mockUser = { id: 'u1' };
    mockTeams = [{ id: 't1', name: 'Test Team' }];
    const PACKAGES_3: BillingPackage[] = [
      PACKAGES[0]!,
      PACKAGES[1]!,
      {
        id: 'pkg-biz',
        name: 'Business',
        description: 'Business tier',
        isFree: false,
        maxMembers: null,
        maxProjects: null,
        prices: [{ id: 'bz-30', durationDays: 30, priceIdr: 500_000, originalPriceIdr: null }],
      },
    ];
    mockListPackages.mockResolvedValueOnce({ packages: PACKAGES_3 });
    mockStartCheckout.mockRejectedValueOnce(new Error('Billing disabled'));

    renderPage(['/pricing?teamId=t1']);

    await screen.findByText('Pro');
    expect(screen.getByText('Business')).toBeDefined();

    const upgradeBtns = screen.getAllByRole('button', { name: /Upgrade ke/ });
    const bizBtn = upgradeBtns.find((b) => b.textContent?.includes('Business'))!;
    await act(async () => { fireEvent.click(bizBtn); });

    const bizCard = screen.getByText('Business').closest('section')!;
    expect(await within(bizCard).findByText(/Gagal memulai checkout/)).toBeDefined();

    const proCard = screen.getByText('Pro').closest('section')!;
    expect(within(proCard).queryByText(/Gagal memulai checkout/)).toBeNull();
  });

  it('prevents double checkout while one is in flight', async () => {
    mockUser = { id: 'u1' };
    mockTeams = [{ id: 't1', name: 'Test Team' }];
    const PACKAGES_3: BillingPackage[] = [
      PACKAGES[0]!,
      PACKAGES[1]!,
      {
        id: 'pkg-biz',
        name: 'Business',
        description: 'Business tier',
        isFree: false,
        maxMembers: null,
        maxProjects: null,
        prices: [{ id: 'bz-30', durationDays: 30, priceIdr: 500_000, originalPriceIdr: null }],
      },
    ];
    mockListPackages.mockResolvedValueOnce({ packages: PACKAGES_3 });
    let resolveCheckout!: (v: unknown) => void;
    mockStartCheckout.mockImplementationOnce(() => new Promise((r) => { resolveCheckout = r; }));

    renderPage(['/pricing?teamId=t1']);
    await screen.findByText('Pro');

    // First click triggers checkout
    const proBtn = screen.getByRole('button', { name: /Upgrade ke Pro/ });
    fireEvent.click(proBtn);
    await waitFor(() => {
      expect(mockStartCheckout).toHaveBeenCalledTimes(1);
    });

    // Second click on different package should be blocked by disabled button
    const bizBtn = screen.getByRole('button', { name: /Upgrade ke Business/ });
    fireEvent.click(bizBtn);
    // startCheckout should still be called only once
    expect(mockStartCheckout).toHaveBeenCalledTimes(1);

    // Clean up
    await act(async () => { resolveCheckout({ url: 'http://example.com' }); });
  });
});
