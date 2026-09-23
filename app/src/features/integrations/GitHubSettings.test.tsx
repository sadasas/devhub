import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubSettings } from './GitHubSettings';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    githubStatus: vi.fn(),
    githubInstallUrl: vi.fn(),
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
    </MemoryRouter>,
  );
}

describe('GitHubSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.githubStatus.mockResolvedValue(status());
  });

  it('shows connect button and manual bind when disconnected', async () => {
    renderSettings();
    expect(await screen.findByRole('button', { name: 'Connect GitHub' })).toBeTruthy();
    expect(screen.getByLabelText('Installation ID')).toBeTruthy();
  });

  it('binds manually via installation ID and shows the picker', async () => {
    apiMock.githubSetup.mockResolvedValue({ installationId: 77, accountLogin: 'acme', accountType: 'Organization' });
    apiMock.githubInstallRepos.mockResolvedValue({
      repos: [{ owner: 'acme', repo: 'api', fullName: 'acme/api', isPrivate: true }],
    });
    renderSettings();
    await screen.findByRole('button', { name: 'Connect GitHub' });
    fireEvent.change(screen.getByLabelText('Installation ID'), { target: { value: '77' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bind installed App' }));
    await waitFor(() => expect(apiMock.githubSetup).toHaveBeenCalledWith(77));
    expect(await screen.findByText('acme/api')).toBeTruthy();
    expect(
      screen.getByText('App installed — pick a repository below to finish connecting.'),
    ).toBeTruthy();
  });

  it('rejects non-numeric installation IDs', async () => {
    renderSettings();
    await screen.findByRole('button', { name: 'Connect GitHub' });
    fireEvent.change(screen.getByLabelText('Installation ID'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bind installed App' }));
    expect(await screen.findByText('Enter a numeric installation ID.')).toBeTruthy();
    expect(apiMock.githubSetup).not.toHaveBeenCalled();
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
  });
});
