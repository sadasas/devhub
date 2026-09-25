import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubSettings } from './GitHubSettings';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    githubStatus: vi.fn(),
    githubInstallUrl: vi.fn(),
    githubInstallations: vi.fn(),
    githubSetup: vi.fn(),
    githubInstallRepos: vi.fn(),
    githubConnect: vi.fn(),
    githubDisconnect: vi.fn(),
    githubAutomation: vi.fn(),
    githubDrain: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => ({ api: apiMock }));
vi.mock('../../hooks/useCopyFeedback', () => ({
  useCopyFeedback: () => ({ copied: false, copy: vi.fn() }),
}));

function status(over: Record<string, unknown> = {}) {
  return {
    connected: false,
    owner: null,
    repo: null,
    installationId: null,
    accountLogin: null,
    automation: null,
    ...over,
  };
}

function renderSettings(entry = '/project/p1?tab=settings&section=integrations') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <GitHubSettings projectId="11111111-1111-4111-8111-111111111111" canConnect isAdmin />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{`${loc.pathname}${loc.search}`}</span>;
}

describe('GitHubSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.githubStatus.mockResolvedValue(status());
    apiMock.githubInstallations.mockResolvedValue({ installations: [] });
  });

  it('shows connect button when disconnected', async () => {
    renderSettings();
    // Label pendek "Connect" = pola mirror Google (bukan "Connect GitHub").
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeTruthy();
  });

  it('shows linked repo with automation and disconnect', async () => {
    apiMock.githubStatus.mockResolvedValue(
      status({
        connected: true,
        owner: 'acme',
        repo: 'web',
        installationId: 42,
        accountLogin: 'acme',
        automation: { onPrOpened: 'suggest', onPrMerged: 'suggest' },
      }),
    );
    renderSettings();
    expect(await screen.findByText('Linked to acme/web (acme).')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry failed sync' })).toBeTruthy();
    expect(apiMock.githubInstallations).not.toHaveBeenCalled();
  });

  it('lists known installations for manual pick without redirect', async () => {
    apiMock.githubInstallations.mockResolvedValue({
      installations: [{ installationId: 42, accountLogin: 'org-lama', accountType: 'Organization', status: 'connected' }],
    });
    apiMock.githubInstallRepos.mockResolvedValue({
      repos: [{ owner: 'org-lama', repo: 'web', fullName: 'org-lama/web', isPrivate: false }],
    });
    renderSettings();
    expect(await screen.findByText('GitHub installation')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'GitHub installation' }));
    fireEvent.click(await screen.findByRole('option', { name: 'org-lama (Organization)' }));
    await waitFor(() => expect(apiMock.githubInstallRepos).toHaveBeenCalledWith(42));
    expect(await screen.findByRole('button', { name: 'Connect repository' })).toBeTruthy();
  });

  it('offers install on another account when installations exist', async () => {
    apiMock.githubInstallations.mockResolvedValue({
      installations: [{ installationId: 7, accountLogin: 'akun-a', accountType: 'User', status: 'connected' }],
    });
    renderSettings();
    expect(await screen.findByRole('button', { name: 'Install on another GitHub account' })).toBeTruthy();
  });

  it('shows a single unconfigured warn and keeps connect clickable (opsi B)', async () => {
    const notConfigured = Object.assign(new Error('GitHub App is not configured'), {
      code: 'GITHUB_NOT_CONFIGURED',
    });
    apiMock.githubInstallations.mockRejectedValue(notConfigured);
    apiMock.githubInstallUrl.mockRejectedValue(notConfigured);
    renderSettings();
    const banner = await screen.findByTestId('github-unconfigured');
    expect(banner.getAttribute('role')).toBe('alert');
    // Opsi B: Connect tetap aktif (klik = cek ulang live), tanpa banner dobel.
    // Disclosure statis selalu tampil (pola GCal) — hanya picker yang disembunyikan.
    expect(screen.getByRole('button', { name: 'Connect' }).getAttribute('disabled')).toBeNull();
    expect(screen.queryByTestId('github-toast')).toBeNull();
    expect(screen.queryByText(/short-lived GitHub App token/)).not.toBeNull();
    // Klik ulang saat masih unconfigured: tetap satu banner, tanpa danger tambahan.
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(apiMock.githubInstallUrl).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('github-unconfigured')).toBeTruthy();
    expect(screen.queryByTestId('github-toast')).toBeNull();
    // Aturan global slot-tunggal: semua banner di bawah konten (danger → warn
    // → success); teks statis utuh, warn sesudah seluruh konten termasuk aksi.
    const disclosure = screen.getByText(/short-lived GitHub App token/);
    const warn = screen.getByTestId('github-unconfigured');
    const connect = screen.getByRole('button', { name: 'Connect' });
    expect(disclosure.compareDocumentPosition(warn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(connect.compareDocumentPosition(warn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a success flash for ?github=connected and strips the query', async () => {
    renderSettings('/project/p1?tab=settings&section=integrations&github=connected&repo=acme%2Fweb');
    const flash = await screen.findByTestId('github-flash');
    expect(flash.getAttribute('role')).toBe('status');
    expect(within(flash).getByText('GitHub connected: acme/web.')).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).not.toContain('github=');
    });
  });

  it('shows an error flash for ?github_error= and strips the query', async () => {
    renderSettings('/project/p1?tab=settings&section=integrations&github_error=boom');
    const flash = await screen.findByTestId('github-flash');
    expect(flash.getAttribute('role')).toBe('alert');
    expect(within(flash).getByText('boom')).not.toBeNull();
  });

  it('disconnects through ConfirmDeleteDialog', async () => {
    apiMock.githubStatus.mockResolvedValue(
      status({
        connected: true,
        owner: 'acme',
        repo: 'web',
        installationId: 42,
        accountLogin: 'acme',
        automation: { onPrOpened: 'suggest', onPrMerged: 'suggest' },
      }),
    );
    apiMock.githubDisconnect.mockResolvedValue({ ok: true });
    renderSettings();

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Disconnect repository?')).not.toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(apiMock.githubDisconnect).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('github-notice')).toBeTruthy();
  });

  it('keeps the mapping when disconnect is cancelled', async () => {
    apiMock.githubStatus.mockResolvedValue(
      status({
        connected: true,
        owner: 'acme',
        repo: 'web',
        installationId: 42,
        accountLogin: 'acme',
        automation: { onPrOpened: 'suggest', onPrMerged: 'suggest' },
      }),
    );
    renderSettings();

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByText('Disconnect repository?')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(apiMock.githubDisconnect).not.toHaveBeenCalled();
    expect(screen.getByText('Linked to acme/web (acme).')).not.toBeNull();
  });

  it('renders flash below content in the single bottom slot', async () => {
    renderSettings('/project/p1?tab=settings&section=integrations&github=connected&repo=acme%2Fweb');
    const flash = await screen.findByTestId('github-flash');
    const desc = screen.getByText(/One repository per project/);
    expect(desc.compareDocumentPosition(flash) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
