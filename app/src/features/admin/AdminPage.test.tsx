import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiError, api } from '../../lib/api';
import type { AdminStats, AdminUser, User } from '../../lib/types';
import { AdminPage } from './AdminPage';

const ADMIN: User = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@test.dev',
  displayName: 'Admin',
  bio: '',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({ user: ADMIN }),
}));

function makeUser(over: Partial<AdminUser> = {}): AdminUser {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'member@test.dev',
    displayName: '',
    role: 'user',
    teamCount: 1,
    createdAt: '2026-02-01T00:00:00.000Z',
    lastActiveAt: null,
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminPage', () => {
  const STATS: AdminStats = {
    users: 2,
    teams: 2,
    projects: 3,
    activeKeys: 1,
    activity24h: 5,
    activity7d: 20,
  };

  it('renders platform stats and the users list for an admin', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({
      users: [makeUser()],
      total: 1,
    });

    renderPage();
    expect(await screen.findByText('member@test.dev')).toBeDefined();
    expect(screen.getByText('Users (2)')).toBeDefined();
    expect(screen.getByText('Active keys')).toBeDefined();
  });

  it('changes a user role and updates the row', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({
      users: [makeUser()],
      total: 1,
    });
    const setRole = vi
      .spyOn(api, 'setAdminUserRole')
      .mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', email: 'member@test.dev', role: 'admin' });

    renderPage();
    await screen.findByText('member@test.dev');

    const select = screen.getByLabelText('Role for member@test.dev') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'admin' } });

    await waitFor(() =>
      expect(setRole).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', 'admin'),
    );
    expect((screen.getByLabelText('Role for member@test.dev') as HTMLSelectElement).value).toBe('admin');
  });

  it('shows an error when a role change fails', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({
      users: [makeUser({ role: 'admin' })],
      total: 1,
    });
    vi.spyOn(api, 'setAdminUserRole').mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'You cannot demote yourself'),
    );

    renderPage();
    await screen.findByText('member@test.dev');
    fireEvent.change(screen.getByLabelText('Role for member@test.dev'), { target: { value: 'user' } });

    expect(await screen.findByText('You cannot demote yourself')).toBeDefined();
  });

  it('shows the empty state when no users match the search', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });

    renderPage();
    expect(await screen.findByText('No users found')).toBeDefined();
  });

  it('loads teams and activity lazily per tab', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    const listTeams = vi.spyOn(api, 'listAdminTeams').mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Team A',
        ownerEmail: 'admin@test.dev',
        memberCount: 2,
        projectCount: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const listActivity = vi.spyOn(api, 'listAdminActivity').mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        entity: 'tasks',
        entityId: '55555555-5555-4555-8555-555555555555',
        action: 'created',
        authorName: 'admin@test.dev',
        summary: 'created task "Demo"',
        projectId: '66666666-6666-4666-8666-666666666666',
        projectName: 'Project X',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ]);

    renderPage();
    expect(listTeams).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: /Teams/ }));
    expect(await screen.findByText('Team A')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /Activity/ }));
    expect(await screen.findByText('created task "Demo"')).toBeDefined();
    expect(listActivity).toHaveBeenCalledTimes(1);
  });

  it('shows an error with retry when the teams list fails to load', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    const listTeams = vi
      .spyOn(api, 'listAdminTeams')
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'))
      .mockResolvedValue([
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Team A',
          ownerEmail: 'admin@test.dev',
          memberCount: 2,
          projectCount: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]);

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Teams/ }));

    expect(await screen.findByText(/Cannot reach the server/)).toBeDefined();
    expect(screen.queryByText('No teams yet')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Team A')).toBeDefined();
    expect(listTeams).toHaveBeenCalledTimes(2);
  });

  it('shows an error with retry when the activity feed fails to load', async () => {
    vi.spyOn(api, 'adminStats').mockResolvedValue(STATS);
    vi.spyOn(api, 'listAdminUsers').mockResolvedValue({ users: [], total: 0 });
    const listActivity = vi
      .spyOn(api, 'listAdminActivity')
      .mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom'));

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Activity/ }));

    expect(await screen.findByText(/boom\. Please try again in a moment\./)).toBeDefined();
    expect(screen.queryByText('No recent activity')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(listActivity).toHaveBeenCalledTimes(1);
  });
});
