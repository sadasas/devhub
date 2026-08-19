import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import type { User } from '../../lib/types';

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
  return {
    listKeys: vi.fn(),
    changePassword: vi.fn(),
    updateProfile: vi.fn(),
    ApiError,
  };
});

vi.mock('../../lib/api', () => ({
  api: apiMock,
  ApiError: apiMock.ApiError,
}));

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../state/auth-context', () => authMock);

const teamsMock = vi.hoisted(() => ({ useTeams: vi.fn() }));
vi.mock('../../state/teams-context', () => teamsMock);

const projectsMock = vi.hoisted(() => ({ useProjects: vi.fn() }));
vi.mock('../../state/projects-context', () => projectsMock);

const user: User = {
  id: 'u1',
  email: 'you@devhub.dev',
  displayName: 'Ada Lovelace',
  bio: 'Analytical Engine enthusiast.',
  createdAt: '2026-08-01T10:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.useAuth.mockReturnValue({ user, setUser: vi.fn() });
  teamsMock.useTeams.mockReturnValue({ teams: [] });
  projectsMock.useProjects.mockReturnValue({ projects: [] });
  apiMock.listKeys.mockResolvedValue([]);
  apiMock.changePassword.mockResolvedValue(undefined);
});

describe('ProfilePage', () => {
  it('renders identity: name, email, bio and joined date', async () => {
    renderPage();

    expect(screen.getByText('Ada Lovelace')).not.toBeNull();
    expect(screen.getAllByText('you@devhub.dev').length).toBeGreaterThan(0);
    expect(screen.getByText('Analytical Engine enthusiast.')).not.toBeNull();
    expect(screen.getByText(/Joined/i)).not.toBeNull();
    expect(await screen.findByText('Teams')).not.toBeNull();
  });

  it('shows account statistics: teams, projects and active API keys', async () => {
    teamsMock.useTeams.mockReturnValue({ teams: [{ id: 't1' }, { id: 't2' }] });
    projectsMock.useProjects.mockReturnValue({ projects: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] });
    apiMock.listKeys.mockResolvedValue([
      { id: 'k1', name: 'a', prefix: 'devhub_A', createdAt: '', lastUsedAt: null, revokedAt: null, revealable: true },
      { id: 'k2', name: 'b', prefix: 'devhub_B', createdAt: '', lastUsedAt: null, revokedAt: '2026-08-10T00:00:00.000Z', revealable: true },
    ]);

    renderPage();

    expect(await screen.findByText('3')).not.toBeNull();
    expect(screen.getByText('2')).not.toBeNull();
    expect(screen.getByText('1')).not.toBeNull();
    expect(screen.getByText('Active API keys')).not.toBeNull();
  });

  it('shows a placeholder for the API key count when loading fails', async () => {
    apiMock.listKeys.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(await screen.findByText('—')).not.toBeNull();
  });

  it('opens the edit modal from the empty bio affordance', () => {
    authMock.useAuth.mockReturnValue({
      user: { ...user, bio: '' },
      setUser: vi.fn(),
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /add a bio/i }));
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getAllByText('Edit profile').length).toBeGreaterThan(0);
  });

  it('saves edited profile via the modal', async () => {
    const setUser = vi.fn();
    authMock.useAuth.mockReturnValue({ user, setUser });
    apiMock.updateProfile.mockResolvedValue({ ...user, displayName: 'New Name' });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'New Name' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(apiMock.updateProfile).toHaveBeenCalledWith({
        displayName: 'New Name',
        bio: 'Analytical Engine enthusiast.',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(setUser).toHaveBeenCalledWith({ ...user, displayName: 'New Name' });
  });

  it('rejects password change when confirmation does not match', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'old-pass' } });
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'new-pass-1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'new-pass-2' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(screen.getByText('New password and confirmation do not match.')).not.toBeNull();
    expect(apiMock.changePassword).not.toHaveBeenCalled();
  });

  it('reports success after changing the password', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'old-pass' } });
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'new-pass-1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'new-pass-1' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/Password updated/i)).not.toBeNull();
    expect(apiMock.changePassword).toHaveBeenCalledWith('old-pass', 'new-pass-1');
  });

  it('shows the account ID in monospace and links to related pages', () => {
    renderPage();

    expect(screen.getByText('u1')).not.toBeNull();
    expect(screen.getByRole('link', { name: /API keys/i })).not.toBeNull();
    expect(screen.getByRole('link', { name: /MCP guide/i })).not.toBeNull();
  });
});