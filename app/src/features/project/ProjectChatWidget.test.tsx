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
  delete document.body.dataset.erdCanvas;
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
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
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

  it('R1: launcher stays in DOM when ERD canvas flag is set, hidden via CSS (test-compat)', async () => {
    document.body.dataset.erdCanvas = 'open';
    try {
      renderWidget();
      const launcher = await screen.findByRole('button', { name: /Open team chat/ });
      // Element MUST stay mounted — hiding is CSS-only (display:none).
      expect(launcher.classList.contains('chat-launcher')).toBe(true);
      expect(document.body.matches('[data-erd-canvas="open"]')).toBe(true);
      // jsdom CSS assertion mirroring global.css rule.
      const style = document.createElement('style');
      style.textContent = 'body[data-erd-canvas="open"] .chat-launcher { display: none; }';
      document.head.appendChild(style);
      expect(getComputedStyle(launcher).display).toBe('none');
      style.remove();
    } finally {
      delete document.body.dataset.erdCanvas;
    }
  });
});