import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChatsCircle, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useAuth } from '../../state/auth-context';
import { ChatPanel } from '../teams/ChatPanel';
import { realtimeWsUrl, TeamChatSocket } from '../../lib/realtime-client';
import { onToggleChat } from '../../lib/chat-events';

const UNREAD_POLL_MS = 30_000;

interface ProjectChatWidgetProps {
  teamId: string;
  teamName: string;
}

export function ProjectChatWidget({ teamId, teamName }: ProjectChatWidgetProps) {
  const { t } = useTranslation('project');
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const count = await api.getUnreadCount(teamId);
      setUnread(count);
    } catch {
      /* badge best-effort */
    }
  }, [teamId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const doPoll = async () => {
      if (open) return;
      if (cancelled) return;
      await refreshUnread();
    };
    void doPoll();
    const timer = setInterval(() => void doPoll(), UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, open, refreshUnread]);

  useEffect(() => {
    if (!user || open) return;
    const socket = new TeamChatSocket({
      wsUrl: realtimeWsUrl(),
      teamId,
      onMessageNew: () => void refreshUnread(),
    });
    return () => socket.close();
  }, [user, open, teamId, refreshUnread]);

  useEffect(() => {
    const off = onToggleChat(() => setOpen((v) => !v));
    return off;
  }, []);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    void api.setMessagesRead(teamId, new Date().toISOString()).catch(() => {});
  }, [open, teamId]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const drawer = drawerRef.current;
    const focusable = drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    requestAnimationFrame(() => (drawer?.querySelector<HTMLTextAreaElement>('.chat-input') ?? first)?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement instanceof HTMLTextAreaElement) return;
        const mentionOpen = !!document.querySelector('.mention-popup');
        if (mentionOpen) return;
        e.preventDefault();
        setOpen(false);
        launcherRef.current?.focus();
        return;
      }
      if (e.key === 'Tab' && focusable && focusable.length > 0) {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (last as HTMLElement)?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          (first as HTMLElement)?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const main = document.getElementById('main-content');
    const prevInert = main?.getAttribute('inert');
    main?.setAttribute('inert', '');
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (prevInert === null) main?.removeAttribute('inert');
      else if (prevInert !== null) main?.setAttribute('inert', prevInert as string);
      launcherRef.current?.focus();
    };
  }, [open]);

  if (!user) return null;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="chat-launcher"
        aria-label={t('chat.launcherAria')}
        aria-expanded={open}
        aria-controls="project-chat-drawer"
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <ChatsCircle size={24} weight="bold" aria-hidden="true" />
        {!open && unread > 0 && (
          <>
            <span className="chat-launcher-badge" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
            <span className="sr-only">{t('chat.unread', { count: unread })}</span>
          </>
        )}
      </button>
      {open &&
        createPortal(
          <div
            id="project-chat-drawer"
            ref={drawerRef}
            className="chat-drawer"
            role="dialog"
            aria-labelledby="chat-drawer-title"
            aria-modal="true"
          >
            <div className="chat-drawer-head">
              <span id="chat-drawer-title" className="chat-drawer-title">{t('chat.drawerTitle', { team: teamName })}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                aria-label={t('chat.closeAria')}
                onClick={() => {
                  setOpen(false);
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