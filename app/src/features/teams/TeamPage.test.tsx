import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Team } from '../../lib/types';
import { TeamPage } from './TeamPage';

const teamsApi = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listTeamInvitations: vi.fn(),
  getUnreadCount: vi.fn(),
  setMessagesRead: vi.fn(),
  setMemberRole: vi.fn(),
  declineInvitation: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: teamsApi,
  ApiError: class ApiError extends Error {},
}));

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({
    teams: [
      {
        id: 't1',
        name: 'Team A',
        role: 'owner',
        memberCount: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] satisfies Team[],
    refresh: vi.fn(),
    deleteTeam: vi.fn(),
    renameTeam: vi.fn(),
  }),
}));

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@test.dev', displayName: 'Ana', bio: '', createdAt: '' },
  }),
}));

vi.mock('./ChatPanel', () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}));

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
  teamsApi.listMembers.mockResolvedValue([]);
  teamsApi.listTeamInvitations.mockResolvedValue([]);
  teamsApi.getUnreadCount.mockResolvedValue(0);
  teamsApi.setMessagesRead.mockResolvedValue({ ok: true });
});

describe('TeamPage chat tab', () => {
  it('shows the members tab by default', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: /Members/ }).then((t) => t.getAttribute('aria-selected'))).toBe('true');
    expect(screen.queryByTestId('chat-panel')).toBeNull();
  });

  it('opens the chat tab from the ?tab=chat param and marks messages read', async () => {
    renderPage('/team/t1?tab=chat');
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Chat/ }).getAttribute('aria-selected')).toBe('true');
    expect(teamsApi.setMessagesRead).toHaveBeenCalledWith('t1', expect.any(String));
  });

  it('switches tabs and updates the url param', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Chat/ }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Chat/ }).getAttribute('aria-selected')).toBe('true');
    });
    expect(screen.getByTestId('chat-panel')).toBeTruthy();
  });

  it('shows the unread badge on the chat tab while on members', async () => {
    teamsApi.getUnreadCount.mockResolvedValue(3);
    renderPage();
    const chatTab = await screen.findByRole('tab', { name: /Chat/ });
    await waitFor(() => {
      expect(chatTab.textContent).toContain('3');
    });
  });
});
