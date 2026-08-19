import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeysPage } from './KeysPage';
import type { McpKey } from '../../lib/types';

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
  return { listKeys: vi.fn(), createKey: vi.fn(), revokeKey: vi.fn(), revealKey: vi.fn(), ApiError };
});

vi.mock('../../lib/api', () => ({
  api: apiMock,
  ApiError: apiMock.ApiError,
}));

function key(over: Partial<McpKey> = {}): McpKey {
  return {
    id: 'k1',
    name: 'opencode-desktop',
    prefix: 'devhub_A',
    createdAt: '2026-08-01T10:00:00.000Z',
    lastUsedAt: null,
    revokedAt: null,
    revealable: true,
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
});

describe('KeysPage', () => {
  it('lists keys with name, prefix, status and metadata', async () => {
    apiMock.listKeys.mockResolvedValue([
      key(),
      key({ id: 'k2', name: '', prefix: 'devhub_B', revokedAt: '2026-08-10T10:00:00.000Z' }),
    ]);

    renderPage();

    expect(await screen.findByText('opencode-desktop')).not.toBeNull();
    expect(screen.getByText('devhub_A…')).not.toBeNull();
    expect(screen.getByLabelText('Active key')).not.toBeNull();
    expect(screen.getByText('Revoked')).not.toBeNull();
    expect(screen.getAllByText(/Never/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 of 10 active/i)).not.toBeNull();
  });

  it('reveals and copies the full key to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    apiMock.listKeys.mockResolvedValue([key()]);
    apiMock.revealKey.mockResolvedValue('devhub_AFakeFullKey');

    renderPage();
    await screen.findByText('opencode-desktop');

    fireEvent.click(screen.getByRole('button', { name: 'Copy key devhub_A' }));
    await waitFor(() => expect(apiMock.revealKey).toHaveBeenCalledWith('k1'));
    expect(writeText).toHaveBeenCalledWith('devhub_AFakeFullKey');
  });

  it('copies only the prefix for legacy keys that cannot be revealed', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    apiMock.listKeys.mockResolvedValue([key({ revealable: false })]);

    renderPage();
    await screen.findByText('opencode-desktop');

    fireEvent.click(screen.getByRole('button', { name: 'Copy key prefix devhub_A' }));
    expect(apiMock.revealKey).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('devhub_A');
  });

  it('shows the empty state with a link to the MCP guide', async () => {
    apiMock.listKeys.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('No API keys yet')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Read the MCP guide' }).getAttribute('href')).toBe('/docs/mcp');
  });

  it('renders the using-your-keys guide with a runnable curl snippet', async () => {
    apiMock.listKeys.mockResolvedValue([key()]);

    renderPage();
    await screen.findByText('opencode-desktop');

    expect(screen.getByRole('heading', { name: 'Using your keys' })).not.toBeNull();
    // Banner + curl snippet sama-sama memuat header Authorization
    expect(screen.getAllByText(/Authorization: Bearer \$DEVHUB_MCP_KEY/).length).toBeGreaterThan(0);
    expect(screen.getByText(/curl -X POST/)).not.toBeNull();
    expect(screen.getByRole('link', { name: /MCP integration guide/ }).getAttribute('href')).toBe('/docs/mcp');
  });

  it('revokes a key through the confirmation modal', async () => {
    apiMock.listKeys.mockResolvedValue([key()]);
    apiMock.revokeKey.mockResolvedValue({ ok: true });

    renderPage();
    await screen.findByText('opencode-desktop');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/will stop working immediately/)).not.toBeNull();

    fireEvent.click(dialog.getByRole('button', { name: 'Revoke' }));
    fireEvent.click(await dialog.findByRole('button', { name: 'Confirm revoke' }));

    await waitFor(() => expect(apiMock.revokeKey).toHaveBeenCalledWith('k1'));
    expect(screen.getByText('Revoked')).not.toBeNull();
  });
});