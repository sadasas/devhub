import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { BillingStatus } from '../../lib/types';
import { TeamBillingPanel } from './TeamBillingPanel';

const mocks = vi.hoisted(() => ({ billingStatus: vi.fn(), listPackages: vi.fn(), startCheckout: vi.fn() }));



vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      billingStatus: mocks.billingStatus,
      listPackages: mocks.listPackages,
      startCheckout: mocks.startCheckout,
    },
  };
});

const BASE: BillingStatus = {
  team: { id: 't1', name: 'Platform', plan: 'free', planExpiresAt: null },
  usage: {
    members: { used: 1, limit: 2 },
    projects: { used: 3, limit: 3 },
  },
  payments: [],
};

function renderPanel(isAdmin = true) {
  return render(
    <MemoryRouter>
      <TeamBillingPanel teamId="t1" isAdmin={isAdmin} />
    </MemoryRouter>,
  );
}

describe('TeamBillingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders free plan with full-usage meter and View Pricing CTA', async () => {
    vi.mocked(mocks.billingStatus).mockResolvedValue(BASE);
    renderPanel();

    expect(await screen.findByText('Free plan')).toBeDefined();
    expect(screen.getByText('1 / 2')).toBeDefined();
    expect(screen.getByText('3 / 3')).toBeDefined();
    expect(screen.getByRole('button', { name: /View Pricing/ })).toBeDefined();
  });

  it('renders pro plan as unlimited without upsell and lists payment history', async () => {
    vi.mocked(mocks.billingStatus).mockResolvedValue({
      team: { id: 't1', name: 'Platform', plan: 'pro', planExpiresAt: '2026-12-01T00:00:00.000Z' },
      usage: {
        members: { used: 5, limit: null },
        projects: { used: 40, limit: null },
      },
      payments: [
        {
          orderId: 'DH-1',
          packageName: 'Pro',
          durationDays: 30,
          amount: 250_000,
          status: 'completed',
          createdAt: '2026-08-01T00:00:00.000Z',
          completedAt: '2026-08-01T09:00:00.000Z',
        },
      ],
    });
    renderPanel();

    expect(await screen.findByText(/Active until/)).toBeTruthy();
    expect(screen.getAllByText('Unlimited')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /View Pricing/ })).toBeNull();
    expect(screen.getByText('Paid')).toBeDefined();
    expect(screen.getByText(/Pro · 30 days/)).toBeDefined();
  });

  it('hides upgrade actions from non-admin members', async () => {
    vi.mocked(mocks.billingStatus).mockResolvedValue(BASE);
    renderPanel(false);

    expect(await screen.findByText(/Contact a team admin to upgrade/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /View Pricing/ })).toBeNull();
  });
});
