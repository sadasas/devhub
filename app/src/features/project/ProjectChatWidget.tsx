import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChatsCircle, X } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { useAuth } from '../../state/auth-context';
import { ChatPanel } from '../teams/ChatPanel';

const UNREAD_POLL_MS = 30_000;

interface ProjectChatWidgetProps {
  teamId: string;
  teamName: string;
}

export function ProjectChatWidget({ teamId, teamName }: ProjectChatWidgetProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!user || open) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const count = await api.getUnreadCount(teamId);
        if (!cancelled) setUnread(count);
      } catch {
        /* badge is best-effort */
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, open, teamId]);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    void api.setMessagesRead(teamId, new Date().toISOString()).catch(() => {});
  }, [open, teamId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.activeElement instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setOpen(false);
      launcherRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!user) return null;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="chat-launcher"
        aria-label="Open team chat"
        aria-expanded={open}
        aria-controls="project-chat-drawer"
        onClick={() => setOpen((v) => !v)}
      >
        <ChatsCircle size={24} weight="bold" aria-hidden="true" />
        {!open && unread > 0 && (
          <>
            <span className="chat-launcher-badge" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
            <span className="sr-only">{unread} unread messages</span>
          </>
        )}
      </button>
      {open &&
        createPortal(
          <div
            id="project-chat-drawer"
            className="chat-drawer"
            role="dialog"
            aria-label="Team chat"
            aria-modal="false"
          >
            <div className="chat-drawer-head">
              <span className="chat-drawer-title">{teamName} — Team chat</span>
              <button
                type="button"
                className="btn-icon"
                aria-label="Close chat"
                onClick={() => {
                  setOpen(false);
                  launcherRef.current?.focus();
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <ChatPanel teamId={teamId} userId={user.id} userDisplayName={user.displayName} />
          </div>,
          document.body,
        )}
    </>
  );
}