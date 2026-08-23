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

describe('PricingPage (dinamis dari DB)', () => {
  beforeEach(() => {
    mockListPackages.mockReset().mockResolvedValue({ packages: PACKAGES });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders packages with dynamic limits and Mulai Upgrade button', async () => {
    renderPage();

    expect(await screen.findByText('Free')).toBeDefined();
    expect(screen.getByText('Pro')).toBeDefined();
    expect(screen.getByText(/2 members · 3 projects/)).toBeDefined();
    expect(screen.getByText('Unlimited members')).toBeDefined();
    expect(screen.getByText('Unlimited projects')).toBeDefined();
    expect(await screen.findByRole('button', { name: /Mulai Upgrade/ })).toBeDefined();
  });

  it('shows step 2 confirmation with order summary after choosing a package', async () => {
    const { fireEvent, act } = await import('@testing-library/react');
    renderPage();

    const upgradeBtn = await screen.findByRole('button', { name: /Mulai Upgrade/ });
    await act(async () => {
      fireEvent.click(upgradeBtn);
    });

    expect(await screen.findByText('Konfirmasi Pembelian')).toBeDefined();
    expect(screen.getByText('Step 2: Konfirmasi')).toBeDefined();
    expect(screen.getByText('1 bulan')).toBeDefined();
  });

  it('shows duration cards in step 2', async () => {
    const { fireEvent, act } = await import('@testing-library/react');
    renderPage();

    const upgradeBtn = await screen.findByRole('button', { name: /Mulai Upgrade/ });
    await act(async () => {
      fireEvent.click(upgradeBtn);
    });

    expect(await screen.findByText('1 bulan')).toBeDefined();
    expect(screen.getByText(/12 bulan/)).toBeDefined();
  });

  it('shows a register CTA for anonymous visitors', async () => {
    const { fireEvent, act } = await import('@testing-library/react');
    renderPage();
    const upgradeBtn = await screen.findByRole('button', { name: /Mulai Upgrade/ });
    await act(async () => {
      fireEvent.click(upgradeBtn);
    });

    expect(await screen.findByText(/Create a free account to upgrade/)).toBeDefined();
    expect(screen.getByRole('button', { name: /Create a free account/ })).toBeDefined();
  });

  it('renders FAQ section', async () => {
    renderPage();

    expect(await screen.findByText('Pertanyaan Umum')).toBeDefined();
    expect(screen.getByText('Bagaimana cara upgrade?')).toBeDefined();
    expect(screen.getByText('Apakah ada free trial?')).toBeDefined();
  });
});
