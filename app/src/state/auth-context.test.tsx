import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

vi.mock('../lib/api', () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock('../lib/idb-provider', () => ({
  isNetworkError: vi.fn((err: unknown) => (err as { status?: number } | null)?.status === 0),
}));

const { getMetaMock, putMetaMock } = vi.hoisted(() => ({
  getMetaMock: vi.fn(),
  putMetaMock: vi.fn(),
}));

vi.mock('../lib/idb', () => ({
  getMeta: getMetaMock,
  putMeta: putMetaMock,
}));

import { api } from '../lib/api';

const USER = { id: 'u1', email: 'a@b.c', displayName: 'A', bio: '', role: 'user' as const, createdAt: '2026-01-01T00:00:00.000Z' };

function Probe() {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
    </div>
  );
}

describe('auth-context offline bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('boots from the cached user when /me fails with a network error', async () => {
    vi.mocked(api.me).mockRejectedValue({ status: 0 });
    getMetaMock.mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await screen.findByText(USER.email);
    expect(screen.getByTestId('user').textContent).toBe(USER.email);
    expect(getMetaMock).toHaveBeenCalledWith('user');
  });

  it('does not boot from cache when /me returns a real 401', async () => {
    vi.mocked(api.me).mockRejectedValue({ status: 401 });
    getMetaMock.mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await screen.findByText('none');
    expect(getMetaMock).not.toHaveBeenCalled();
  });

  it('caches the user after a successful /me call', async () => {
    vi.mocked(api.me).mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await screen.findByText(USER.email);
    expect(putMetaMock).toHaveBeenCalledWith('user', USER);
  });
});