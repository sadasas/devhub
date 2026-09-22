import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectChatWidget } from './ProjectChatWidget';
import { toggleChat } from '../../lib/chat-events';

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
    user: { id: 'u1', email: 'ana@gmail.com', displayName: 'Ana', bio: '', createdAt: '' },
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
  delete document.body.dataset.erdCanvas;
  document.getElementById('topbar-chat-btn')?.remove();
});

describe('ProjectChatWidget', () => {
  it('does not render a floating launcher (FAB removed — open via topbar)', () => {
    renderWidget();
    expect(document.querySelector('.chat-launcher')).toBeNull();
    expect(screen.queryByRole('button', { name: /Open team chat|Close chat/ })).toBeNull();
  });

  it('opens the drawer via toggleChat event and marks messages read', async () => {
    renderWidget();
    toggleChat();
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(chatApi.setMessagesRead).toHaveBeenCalledWith('t1', expect.any(String));
  });

  it('passes the team and user props to ChatPanel', async () => {
    renderWidget();
    toggleChat();
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    expect(chatPanelProps.current).toMatchObject({
      teamId: 't1',
      userId: 'u1',
      userDisplayName: 'Ana',
    });
  });

  it('closes the drawer with Escape and restores focus to the topbar button', async () => {
    const topbarBtn = document.createElement('button');
    topbarBtn.id = 'topbar-chat-btn';
    topbarBtn.textContent = 'Chat';
    document.body.appendChild(topbarBtn);
    renderWidget();
    toggleChat();
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('chat-panel')).toBeNull();
    });
    expect(document.activeElement).toBe(topbarBtn);
    topbarBtn.remove();
  });

  it('does not close the drawer with Escape while typing in the composer', async () => {
    renderWidget();
    toggleChat();
    expect(await screen.findByTestId('chat-panel')).toBeTruthy();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('chat-panel')).toBeTruthy();
    textarea.remove();
  });

  it('R1: drawer hidden via CSS when ERD canvas flag is set (launcher gone)', async () => {
    document.body.dataset.erdCanvas = 'open';
    try {
      renderWidget();
      // FAB removed — no launcher element should exist to hide.
      expect(document.querySelector('.chat-launcher')).toBeNull();
      expect(document.body.matches('[data-erd-canvas="open"]')).toBe(true);
      toggleChat();
      const drawer = await screen.findByRole('dialog');
      expect(drawer.classList.contains('chat-drawer')).toBe(true);
      // jsdom CSS assertion mirroring global.css rule.
      const style = document.createElement('style');
      style.textContent = 'body[data-erd-canvas="open"] .chat-drawer { display: none; }';
      document.head.appendChild(style);
      expect(getComputedStyle(drawer).display).toBe('none');
      style.remove();
    } finally {
      delete document.body.dataset.erdCanvas;
    }
  });
});
