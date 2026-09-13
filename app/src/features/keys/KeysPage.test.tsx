import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { KeysPage } from './KeysPage';

const apiMock = vi.hoisted(() => {
  class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { authorizedApps: vi.fn(), revokeAuthorizedApp: vi.fn(), ApiError };
});

vi.mock('../../lib/api', () => ({
  api: apiMock,
  ApiError: apiMock.ApiError,
}));

interface AuthorizedApp {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  scope: string;
  resource: string;
  tokenPrefix: string;
  expiresAt: string;
  createdAt: string;
}

function app(over: Partial<AuthorizedApp> = {}): AuthorizedApp {
  return {
    clientId: 'c1',
    clientName: 'opencode-desktop',
    redirectUris: ['https://app.example/callback'],
    scope: 'mcp',
    resource: 'https://devhub.example/mcp',
    tokenPrefix: 'dh_abc123',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    createdAt: '2026-08-01T10:00:00.000Z',
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <KeysPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KeysPage (Connected MCP)', () => {
  it('shows the loading state while authorized apps load', async () => {
    apiMock.authorizedApps.mockImplementation(() => new Promise(() => {}));
    renderPage();

    expect(await screen.findByText('Loading connected apps...')).not.toBeNull();
  });

  it('lists connected apps with name, prefix, scope and count', async () => {
    apiMock.authorizedApps.mockResolvedValue({
      apps: [app(), app({ clientId: 'c2', clientName: 'claude-code', tokenPrefix: 'dh_xyz789' })],
      total: 2,
    });

    renderPage();

    expect(await screen.findByText('opencode-desktop')).not.toBeNull();
    expect(screen.getByText('claude-code')).not.toBeNull();
    expect(screen.getByText('dh_abc123')).not.toBeNull();
    expect(screen.getByText('2 connected apps')).not.toBeNull();
  });

  it('shows the empty state with a link to the OAuth guide when no apps exist', async () => {
    apiMock.authorizedApps.mockResolvedValue({ apps: [], total: 0 });

    renderPage();

    expect(await screen.findByText('No connected apps')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'OAuth Guide' }).getAttribute('href')).toBe(
      '/docs/mcp',
    );
  });

  it('shows an error when loading authorized apps fails', async () => {
    apiMock.authorizedApps.mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByText('Failed to load data')).not.toBeNull();
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('revokes an app through the confirmation and removes it from the list', async () => {
    apiMock.authorizedApps.mockResolvedValue({ apps: [app()], total: 1 });
    apiMock.revokeAuthorizedApp.mockResolvedValue({ ok: true, revoked: 1 });

    renderPage();
    await screen.findByText('opencode-desktop');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(window.confirm).toHaveBeenCalledWith('Revoke this app? Token will stop working.');
    await waitFor(() => expect(apiMock.revokeAuthorizedApp).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('opencode-desktop')).toBeNull());
  });

  it('keeps the app when the confirmation is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    apiMock.authorizedApps.mockResolvedValue({ apps: [app()], total: 1 });

    renderPage();
    await screen.findByText('opencode-desktop');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(apiMock.revokeAuthorizedApp).not.toHaveBeenCalled();
    expect(screen.getByText('opencode-desktop')).not.toBeNull();
  });

  it('does not render the removed API-keys UI', async () => {
    apiMock.authorizedApps.mockResolvedValue({ apps: [app()], total: 1 });

    renderPage();
    await screen.findByText('opencode-desktop');

    expect(screen.queryByText('No API keys yet')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });
});
