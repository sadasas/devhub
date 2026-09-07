import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiError } from '../../lib/api';
import type { Team } from '../../lib/types';
import { TeamPage } from './TeamPage';

const teamsApi = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listTeamInvitations: vi.fn(),
  setMemberRole: vi.fn(),
  declineInvitation: vi.fn(),
  removeMember: vi.fn(),
}));

const teamsCtx = vi.hoisted(() => ({
  deleteTeam: vi.fn(),
  renameTeam: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: teamsApi,
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status = 400, code = '', message = '') {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({
    teams: [
      {
        id: 't1',
        name: 'Team A',
        role: mockRole,
        plan: 'free',
        planPackageName: 'Free',
        memberCount: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] satisfies Team[],
    refresh: teamsCtx.refresh,
    deleteTeam: teamsCtx.deleteTeam,
    renameTeam: teamsCtx.renameTeam,
  }),
}));

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@test.dev', displayName: 'Ana', bio: '', createdAt: '' },
  }),
}));

let mockRole: Team['role'] = 'owner';

function renderPage(entry = '/team/t1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/team/:teamId" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRole = 'owner';
  teamsApi.listMembers.mockResolvedValue([
    { id: 'u1', email: 'ana@test.dev', role: 'owner', joinedAt: '2026-01-01T00:00:00.000Z' },
  ]);
  teamsApi.listTeamInvitations.mockResolvedValue([]);
});

describe('TeamPage', () => {
  it('renders the team header and member list without chat tabs', async () => {
    renderPage();
    expect(await screen.findByText('Team A')).toBeTruthy();
    expect(screen.getByText('ana@test.dev')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Chat/ })).toBeNull();
    expect(screen.getByRole('tab', { name: /Members/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Usage/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Usage/ }).getAttribute('aria-selected')).toBe('false');
    expect(screen.queryByTestId('chat-panel')).toBeNull();
  });

  it('shows an empty state when the team has no members', async () => {
    teamsApi.listMembers.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No members yet')).toBeTruthy();
  });

  it('shows the delete error inside the dialog, not on the page', async () => {
    teamsCtx.deleteTeam.mockRejectedValueOnce(new ApiError(400, 'TEAM_HAS_PROJECTS', 'Team still has projects'));
    renderPage();
    expect(await screen.findByText('Team A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Delete team/ }));
    const dialog = screen.getByRole('dialog', { name: 'Delete team' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Team still has projects')).toBeTruthy();
    // Error lives inside the dialog; the page behind stays clean.
    expect(dialog.textContent).toContain('Team still has projects');
    expect(screen.queryByRole('tab', { name: /Members/ })?.parentElement?.textContent).not.toContain('Team still has projects');
  });

  it('clears the delete error when the dialog is closed and reopened', async () => {
    teamsCtx.deleteTeam.mockRejectedValueOnce(new ApiError(400, 'TEAM_HAS_PROJECTS', 'Team still has projects'));
    renderPage();
    expect(await screen.findByText('Team A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Delete team/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Team still has projects')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Team still has projects')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Delete team/ }));
    expect(screen.queryByText('Team still has projects')).toBeNull();
  });

  it('shows the leave error inside the leave dialog', async () => {
    mockRole = 'editor';
    teamsApi.removeMember.mockRejectedValueOnce(new ApiError(400, 'LEAVE_FAILED', 'Leave failed'));
    renderPage();
    expect(await screen.findByText('Team A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave team' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave team' });
    fireEvent.click(screen.getByRole('button', { name: 'Leave', exact: true }));
    expect(await screen.findByText('Leave failed')).toBeTruthy();
    expect(dialog.textContent).toContain('Leave failed');
  });

  it('shows the rename error inside the rename dialog', async () => {
    teamsCtx.renameTeam.mockRejectedValueOnce(new ApiError(400, 'NAME_TAKEN', 'Name taken'));
    renderPage();
    expect(await screen.findByText('Team A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Edit team/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name taken')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Edit team' }).textContent).toContain('Name taken');
  });

  it('shows the remove-member error inside the confirm dialog', async () => {
    teamsApi.listMembers.mockResolvedValue([
      { id: 'u1', email: 'ana@test.dev', role: 'owner', joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'u2', email: 'bob@test.dev', role: 'editor', joinedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    teamsApi.removeMember.mockRejectedValueOnce(new ApiError(400, 'CANNOT_REMOVE', 'Cannot remove owner'));
    renderPage();
    expect(await screen.findByText('bob@test.dev')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Remove member?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Cannot remove owner')).toBeTruthy();
    expect(dialog.textContent).toContain('Cannot remove owner');
  });
});