import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeysPage } from './KeysPage';
import type { McpKey, McpKeyList } from '../../lib/types';

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
    revealable: true,
    ...over,
  };
}

function listResponse(keys: McpKey[], total = keys.length): McpKeyList {
  return { keys, total, page: 1, perPage: 5 };
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
  it('lists active keys with name, prefix and metadata', async () => {
    apiMock.listKeys.mockResolvedValue(
      listResponse([key({ id: 'k1' }), key({ id: 'k2', name: '', prefix: 'devhub_B' })]),
    );

    renderPage();

    expect(await screen.findByText('opencode-desktop')).not.toBeNull();
    expect(screen.getByText('devhub_A…')).not.toBeNull();
    expect(screen.getAllByLabelText('Active key')).toHaveLength(2);
    expect(screen.getAllByText(/Never/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 of 10 active keys/i)).not.toBeNull();
  });

  it('does not render a revoked badge or permanent usage guide', async () => {
    apiMock.listKeys.mockResolvedValue(listResponse([key()]));

    renderPage();
    await screen.findByText('opencode-desktop');

    expect(screen.queryByText('Revoked')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Using your keys' })).toBeNull();
    // User returning hanya melihat satu baris link tenang ke MCP guide
    expect(screen.getByRole('link', { name: 'MCP integration guide' }).getAttribute('href')).toBe(
      '/docs/mcp',
    );
  });

  it('does not show the quickstart guide in the empty state', async () => {
    apiMock.listKeys.mockResolvedValue(listResponse([]));

    renderPage();

    expect(await screen.findByText('No API keys yet')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Using your keys' })).toBeNull();
    expect(screen.queryByText(/curl -X POST/)).toBeNull();
    expect(screen.queryByText(/Authorization: Bearer \$DEVHUB_MCP_KEY/)).toBeNull();
    expect(screen.getByRole('link', { name: /Read the MCP guide/ }).getAttribute('href')).toBe('/docs/mcp');
  });

  it('paginates with GitHub-style Previous/Next controls', async () => {
    const firstPage = [1, 2, 3, 4, 5].map((i) => key({ id: `k${i}`, name: `key-${i}` }));
    const secondPage = [6, 7].map((i) => key({ id: `k${i}`, name: `key-${i}` }));
    apiMock.listKeys.mockImplementation(async (opts?: { page?: number }) => {
      if ((opts?.page ?? 1) === 1) return { keys: firstPage, total: 7, page: 1, perPage: 5 };
      return { keys: secondPage, total: 7, page: 2, perPage: 5 };
    });

    renderPage();

    expect(await screen.findByText('key-5')).not.toBeNull();
    const pager = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(pager).getByText(/Page 1 of 2/)).not.toBeNull();
    const next = within(pager).getByRole('button', { name: 'Next' }) as HTMLButtonElement;
    const prev = within(pager).getByRole('button', { name: 'Previous' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    fireEvent.click(next);
    expect(await screen.findByText('key-6')).not.toBeNull();
    expect(screen.queryByText('key-1')).toBeNull();
    expect(apiMock.listKeys).toHaveBeenLastCalledWith({ page: 2 });
    expect((within(pager).getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reveals and copies the full key to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    apiMock.listKeys.mockResolvedValue(listResponse([key()]));
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
    apiMock.listKeys.mockResolvedValue(listResponse([key({ revealable: false })]));

    renderPage();
    await screen.findByText('opencode-desktop');

    fireEvent.click(screen.getByRole('button', { name: 'Copy key prefix devhub_A' }));
    expect(apiMock.revealKey).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('devhub_A');
  });

  it('shows the empty state with a link to the MCP guide when no keys exist', async () => {
    apiMock.listKeys.mockResolvedValue(listResponse([]));

    renderPage();

    expect(await screen.findByText('No API keys yet')).not.toBeNull();
  });

  it('revokes a key through the confirmation modal and removes it from the list', async () => {
    apiMock.listKeys.mockResolvedValue(listResponse([key()]));
    apiMock.revokeKey.mockResolvedValue({ ok: true });

    renderPage();
    await screen.findByText('opencode-desktop');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/will stop working immediately/)).not.toBeNull();
    expect(dialog.getByText(/disappear from this list/)).not.toBeNull();

    fireEvent.click(dialog.getByRole('button', { name: 'Revoke' }));
    fireEvent.click(await dialog.findByRole('button', { name: 'Confirm revoke' }));

    await waitFor(() => expect(apiMock.revokeKey).toHaveBeenCalledWith('k1'));
    // Pola GitHub: key revoked langsung hilang dari daftar
    await waitFor(() => expect(screen.queryByText('opencode-desktop')).toBeNull());
    expect(await screen.findByText('No API keys yet')).not.toBeNull();
  });
});
