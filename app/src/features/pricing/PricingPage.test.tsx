import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { BillingPackage } from '../../lib/types';
import { PricingPage } from './PricingPage';
const { mockListPackages, mockStartCheckout } = vi.hoisted(() => ({ mockListPackages: vi.fn(), mockStartCheckout: vi.fn() }));
let mockUser: { id: string } | null = null;
let mockTeams: { id: string; name: string }[] = [];
vi.mock('../../lib/api', async (importOriginal) => { const actual = await importOriginal<typeof import('../../lib/api')>(); return { ...actual, api: { ...actual.api, listPackages: mockListPackages, startCheckout: mockStartCheckout } }; });
vi.mock('../../state/auth-context', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('../../state/teams-context', () => ({ useTeams: () => ({ teams: mockTeams }) }));
vi.mock('../../state/projects-context', () => ({ useProjects: () => ({ projects: [] }) }));
function renderPage(initialEntries?: string[]) { return render(<MemoryRouter initialEntries={initialEntries}><PricingPage /></MemoryRouter>); }
const PACKAGES: BillingPackage[] = [
  { id: 'pkg-free', name: 'Free', description: 'For getting started', isFree: true, maxMembers: 2, maxProjects: 3, maxStorageBytes: 0, sortOrder: 0, isFeatured: false, prices: [] },
  { id: 'pkg-pro', name: 'Pro', description: 'Unlimited members & projects', isFree: false, maxMembers: null, maxProjects: null, maxStorageBytes: 104857600, sortOrder: 1, isFeatured: true, prices: [{ id: 'pr-30', durationDays: 30, priceIdr: 250_000, originalPriceIdr: null }, { id: 'pr-365', durationDays: 365, priceIdr: 2_500_000, originalPriceIdr: null }] },
];
describe('PricingPage (single-page flow)', () => {
  beforeEach(() => { mockListPackages.mockReset().mockResolvedValue({ packages: PACKAGES }); mockStartCheckout.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); mockUser = null; mockTeams = []; });
  it('renders both plans with dynamic limits and duration cards', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Free' })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Pro/ })).toBeDefined();
    expect(screen.getAllByText(/2 members/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/3 projects/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Unlimited members').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Unlimited projects').length).toBeGreaterThanOrEqual(1);
    const radios = await screen.findAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(2);
    // Durasi dari DB (hari), bukan hardcode Monthly/Yearly.
    expect(screen.getByRole('radio', { name: /30 hari|30 days/ })).toBeDefined();
    expect(screen.getByRole('radio', { name: /365 hari|365 days/ })).toBeDefined();
  });
  it('shows dynamic CTA with price', async () => { renderPage(); expect(await screen.findByRole('button', { name: /Upgrade to Pro|Upgrade ke Pro/ })).toBeDefined(); });
  it('shows duration cards on the page (no step 2)', async () => {
    renderPage();
    expect(await screen.findByRole('region', { name: /Select workspace|Pilih workspace|Bill to workspace|Tagih ke workspace/ })).toBeDefined();
    const radios = await screen.findAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(2);
  });
  it('shows a register CTA for anonymous visitors', async () => { renderPage(); expect(await screen.findByText(/Create free account|Buat akun gratis/)).toBeDefined(); });
  it('renders FAQ section', async () => { renderPage(); expect(await screen.findByText(/FAQ|Pertanyaan Umum/)).toBeDefined(); expect(screen.getByText(/How do I upgrade|Bagaimana cara upgrade/)).toBeDefined(); expect(screen.getByText(/How do I downgrade|Bagaimana cara downgrade/)).toBeDefined(); expect(screen.getByText(/7-day read-only grace|read-only 7 hari/)).toBeDefined(); });
  it('renders trust section', async () => { renderPage(); expect(await screen.findByText(/Secure payment|Pembayaran aman/)).toBeDefined(); expect(screen.getByText(/Powered by Pakasir/)).toBeDefined(); });
  it('opens a confirm modal without creating the order', async () => {
    mockUser = { id: 'u1' }; mockTeams = [{ id: 't1', name: 'Test Team' }];
    renderPage(['/pricing?teamId=t1']);
    await screen.findByRole('heading', { name: /Pro/ });
    const proBtn = screen.getByRole('button', { name: /Upgrade to Pro|Upgrade ke Pro/ }); fireEvent.click(proBtn);
    expect(await screen.findByText(/Confirm payment|Konfirmasi pembayaran/)).toBeDefined();
    expect(mockStartCheckout).not.toHaveBeenCalled();
  });
  it('creates the order only after confirming in the modal, then redirects', async () => {
    mockUser = { id: 'u1' }; mockTeams = [{ id: 't1', name: 'Test Team' }];
    mockStartCheckout.mockResolvedValueOnce({ url: 'http://example.com/pay', orderId: 'order-12345678' });
    renderPage(['/pricing?teamId=t1']);
    await screen.findByRole('heading', { name: /Pro/ });
    fireEvent.click(screen.getByRole('button', { name: /Upgrade to Pro|Upgrade ke Pro/ }));
    await screen.findByText(/Confirm payment|Konfirmasi pembayaran/);
    fireEvent.click(screen.getByRole('button', { name: /Pay Rp|Bayar Rp/ }));
    await waitFor(() => { expect(mockStartCheckout).toHaveBeenCalledTimes(1); });
    // sukses = modal ditutup untuk redirect (jsdom tak bisa navigasi nyata)
    await waitFor(() => { expect(screen.queryByText(/Confirm payment|Konfirmasi pembayaran/)).toBeNull(); });
  });
  it('creates nothing when the confirm modal is cancelled', async () => {
    mockUser = { id: 'u1' }; mockTeams = [{ id: 't1', name: 'Test Team' }];
    renderPage(['/pricing?teamId=t1']);
    await screen.findByRole('heading', { name: /Pro/ });
    fireEvent.click(screen.getByRole('button', { name: /Upgrade to Pro|Upgrade ke Pro/ }));
    await screen.findByText(/Confirm payment|Konfirmasi pembayaran/);
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$|^Batal$/ }));
    expect(mockStartCheckout).not.toHaveBeenCalled();
    expect(screen.queryByText(/Confirm payment|Konfirmasi pembayaran/)).toBeNull();
  });
  it('shows checkout error inside the modal and allows retry', async () => {
    mockUser = { id: 'u1' }; mockTeams = [{ id: 't1', name: 'Test Team' }];
    mockStartCheckout.mockRejectedValueOnce(new Error('Billing disabled'));
    renderPage(['/pricing?teamId=t1']);
    await screen.findByRole('heading', { name: /Pro/ });
    fireEvent.click(screen.getByRole('button', { name: /Upgrade to Pro|Upgrade ke Pro/ }));
    await screen.findByText(/Confirm payment|Konfirmasi pembayaran/);
    fireEvent.click(screen.getByRole('button', { name: /Pay Rp|Bayar Rp/ }));
    // Error non-ApiError memakai fallback (getErrorMessage), bukan pesan mentah.
    expect(await screen.findByText(/Failed to start checkout|Gagal memulai checkout/)).toBeDefined();
    // modal stays open for retry
    expect(screen.queryByText(/Confirm payment|Konfirmasi pembayaran/)).not.toBeNull();
  });
  it('prevents double checkout while one is in flight', async () => {    mockUser = { id: 'u1' }; mockTeams = [{ id: 't1', name: 'Test Team' }];
    let resolveCheckout!: (v: unknown) => void; mockStartCheckout.mockImplementationOnce(() => new Promise((r) => { resolveCheckout = r; }));
    renderPage(['/pricing?teamId=t1']); await screen.findByRole('heading', { name: /Pro/ });
    fireEvent.click(screen.getByRole('button', { name: /Upgrade to Pro|Upgrade ke Pro/ }));
    await screen.findByText(/Confirm payment|Konfirmasi pembayaran/);
    const payBtn = screen.getByRole('button', { name: /Pay Rp|Bayar Rp/ });
    fireEvent.click(payBtn); fireEvent.click(payBtn);
    await waitFor(() => { expect(mockStartCheckout).toHaveBeenCalledTimes(1); });
    await act(async () => { resolveCheckout({ url: 'http://example.com', orderId: 'order-12345678' }); });
    expect(mockStartCheckout).toHaveBeenCalledTimes(1);
  });
  it('badges the package flagged isFeatured instead of the first paid package', async () => {
    const flagged: BillingPackage[] = [
      { ...PACKAGES[0]! },
      { ...PACKAGES[1]!, isFeatured: false },
      { id: 'pkg-biz', name: 'Business', description: 'Business tier', isFree: false, maxMembers: null, maxProjects: null, maxStorageBytes: null, sortOrder: 2, isFeatured: true, prices: [{ id: 'bz-30', durationDays: 30, priceIdr: 500_000, originalPriceIdr: null }] },
    ];
    mockListPackages.mockResolvedValueOnce({ packages: flagged });
    renderPage();
    await screen.findByRole('heading', { name: 'Business' });
    const bizCard = screen.getByRole('heading', { name: 'Business' }).closest('section')!;
    const proCard = screen.getByRole('heading', { name: /Pro/ }).closest('section')!;
    expect(bizCard.hasAttribute('data-featured')).toBe(true);
    expect(proCard.hasAttribute('data-featured')).toBe(false);
  });
  it('falls back to the first paid package when nothing is flagged', async () => {
    const unflagged: BillingPackage[] = [
      { ...PACKAGES[0]! },
      { ...PACKAGES[1]!, isFeatured: false },
    ];
    mockListPackages.mockResolvedValueOnce({ packages: unflagged });
    renderPage();
    await screen.findByRole('heading', { name: /Pro/ });
    const proCard = screen.getByRole('heading', { name: /Pro/ }).closest('section')!;
    expect(proCard.hasAttribute('data-featured')).toBe(true);
  });
});
