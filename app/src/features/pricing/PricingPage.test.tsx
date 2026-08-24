import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { BillingPackage } from '../../lib/types';
import { PricingPage } from './PricingPage';

const { mockListPackages, mockUser } = vi.hoisted(() => ({
  mockListPackages: vi.fn(),
  mockUser: null as { id: string } | null,
}));

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, listPackages: mockListPackages, startCheckout: vi.fn() },
  };
});

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({ teams: [] }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
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
      { id: 'pr-30', durationDays: 30, priceIdr: 250_000 },
      { id: 'pr-365', durationDays: 365, priceIdr: 2_500_000 },
    ],
  },
];

describe('PricingPage (single-page flow)', () => {
  beforeEach(() => {
    mockListPackages.mockReset().mockResolvedValue({ packages: PACKAGES });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
