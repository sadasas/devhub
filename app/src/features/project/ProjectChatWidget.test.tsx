import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectChatWidget } from './ProjectChatWidget';

const chatApi = vi.hoisted(() => ({
  getUnreadCount: vi.fn(),
  setMessagesRead: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: chatApi,
  ApiError: class ApiError extends Error {},
}));

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@test.dev', displayName: 'Ana', bio: '', createdAt: '' },
  }),
}));

const chatPanelProps = vi.hoisted(() => ({ current: {} as Record<string, string> }));

vi.mock('../teams/ChatPanel', () => ({
  ChatPanel: (props: Record<string, string>) => {
    chatPanelProps.current = props;
    return <div data-testid="chat-panel" />;
  },
}));

function renderWidget() {
  return render(<ProjectChatWidget teamId="t1" teamName="Team A" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  chatApi.getUnreadCount.mockReset().mockResolvedValue(0);
  chatApi.setMessagesRead.mockReset().mockResolvedValue({ ok: true });
  chatPanelProps.current = {};
});

describe('ProjectChatWidget', () => {
  it('renders the launcher and shows the unread badge', async () => {
    chatApi.getUnreadCount.mockResolvedValue(3);
    renderWidget();
    const launcher = await screen.findByRole('button', { name: /Open team chat/ });
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => {
      expect(launcher.textContent).toContain('3');
    });
    expect(chatApi.getUnreadCount).toHaveBeenCalledWith('t1');
  });

  it('opens the drawer on click, marks messages read, and hides the badge', async () => {
    chatApi.getUnreadCount.mockResolvedValue(2);
    renderWidget();
    const launcher = await screen.findByRole('button', { name: /Open team chat/ });
    fireEvent.click(launcher);
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Team chat' }).getAttribute('aria-modal')).toBe('false');
    expect(chatApi.setMessagesRead).toHaveBeenCalledWith('t1', expect.any(String));
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
  });

  it('passes the team and user props to ChatPanel', async () => {
    renderWidget();
    fireEvent.click(await screen.findByRole('button', { name: /Open team chat/ }));
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    expect(chatPanelProps.current).toMatchObject({
      teamId: 't1',
      userId: 'u1',
      userDisplayName: 'Ana',
    });
  });

  it('closes the drawer with Escape and restores focus to the launcher', async () => {
    renderWidget();
    const launcher = await screen.findByRole('button', { name: /Open team chat/ });
    fireEvent.click(launcher);
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('chat-panel')).toBeNull();
    });
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(launcher);
  });

  it('does not close the drawer with Escape while typing in the composer', async () => {
    renderWidget();
    fireEvent.click(await screen.findByRole('button', { name: /Open team chat/ }));
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('chat-panel')).toBeTruthy();
    textarea.remove();
  });
});