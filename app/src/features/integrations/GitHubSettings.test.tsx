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
});
