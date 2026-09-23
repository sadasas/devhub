import { render, screen } from '@testing-library/react';
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
  });
});
