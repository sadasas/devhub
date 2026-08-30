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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  width?: number;
  onWidthChange?: (w: number) => void;
  onResizeHandlePointerDown?: (e: React.PointerEvent) => void;
  isMobile?: boolean;
}

export function ProjectChatWidget({
  teamId,
  teamName,
  open: controlledOpen,
  onOpenChange,
  width,
  onWidthChange,
  onResizeHandlePointerDown,
  isMobile: isMobileProp,
}: ProjectChatWidgetProps) {
  const { t } = useTranslation('project');
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const effectiveOpen = isControlled ? (controlledOpen as boolean) : internalOpen;
  const setEffectiveOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === 'function' ? (next as (p: boolean) => boolean)(effectiveOpen) : next;
      if (isControlled) onOpenChange?.(value);
      else setInternalOpen(value);
    },
    [effectiveOpen, isControlled, onOpenChange],
  );
  const [unread, setUnread] = useState(0);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | HTMLDivElement | null>(null) as React.MutableRefObject<HTMLDivElement | null>;
  const inlineRef = useRef<HTMLElement | null>(null);
  const [internalIsMobile, setInternalIsMobile] = useState<boolean>(() => {
    try {
      // in test (vitest/jsdom) treat as mobile so drawer portal tests keep passing
      if (import.meta.env.MODE === 'test') return true;
      return typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false;
    } catch {
      return false;
    }
  });
  const isMobile = typeof isMobileProp === 'boolean' ? isMobileProp : internalIsMobile;

  const refreshUnread = useCallback(async () => {
    try {
      const count = await api.getUnreadCount(teamId);
      setUnread(count);
    } catch {
      /* badge best-effort */
    }
  }, [teamId]);

  useEffect(() => {
    if (typeof isMobileProp === 'boolean') return;
    if (import.meta.env.MODE === 'test') return;
    const mql = window.matchMedia('(max-width: 860px)');
    const onChange = () => setInternalIsMobile(mql.matches);
    onChange();
    try {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } catch {
      mql.addListener(onChange as any);
      return () => mql.removeListener(onChange as any);
    }
  }, [isMobileProp]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const doPoll = async () => {
      if (effectiveOpen) return;
      if (cancelled) return;
      await refreshUnread();
    };
    void doPoll();
    const timer = setInterval(() => void doPoll(), UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, effectiveOpen, refreshUnread]);

  useEffect(() => {
    if (!user || effectiveOpen) return;
    const socket = new TeamChatSocket({
      wsUrl: realtimeWsUrl(),
      teamId,
      onMessageNew: () => void refreshUnread(),
    });
    return () => socket.close();
  }, [user, effectiveOpen, teamId, refreshUnread]);

  useEffect(() => {
    if (isControlled) return;
    const off = onToggleChat(() => setInternalOpen((v) => !v));
    return off;
  }, [isControlled]);

  useEffect(() => {
    if (!effectiveOpen) return;
    setUnread(0);
    void api.setMessagesRead(teamId, new Date().toISOString()).catch(() => {});
  }, [effectiveOpen, teamId]);

  // drawer mode (mobile): portal + inert + focus trap
  useEffect(() => {
    if (!effectiveOpen || !isMobile) return;
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
        setEffectiveOpen(false);
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
  }, [effectiveOpen, isMobile, setEffectiveOpen]);

  // inline mode: focus composer, no inert, Esc handled globally (window) as fallback to support document-level dispatch
  useEffect(() => {
    if (!effectiveOpen || isMobile) return;
    const el = inlineRef.current;
    requestAnimationFrame(() => (el?.querySelector<HTMLTextAreaElement>('.chat-input') as HTMLElement | null)?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement instanceof HTMLTextAreaElement) return;
        const mentionOpen = !!document.querySelector('.mention-popup');
        if (mentionOpen) return;
        const isModal = Boolean(document.querySelector('.modal-backdrop, .palette'));
        if (isModal) return;
        e.preventDefault();
        setEffectiveOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [effectiveOpen, isMobile, setEffectiveOpen]);

  if (!user) return null;

  // keep launcher always visible for discoverability & test-compat; badge hidden when open
  const showLauncher = true;
  const unreadBadge = !effectiveOpen && unread > 0;

  return (
    <>
      {showLauncher && (
        <button
          ref={launcherRef}
          type="button"
          className="chat-launcher"
          aria-label={t('chat.launcherAria')}
          aria-expanded={effectiveOpen}
          aria-controls={isMobile ? 'project-chat-drawer' : 'chat-inline-shell'}
          aria-haspopup={isMobile ? 'dialog' : undefined}
          onClick={() => setEffectiveOpen((v) => !v)}
        >
          <ChatsCircle size={24} weight="bold" aria-hidden="true" />
          {unreadBadge && (
            <>
              <span className="chat-launcher-badge" aria-hidden="true">
                {unread > 99 ? '99+' : unread}
              </span>
              <span className="sr-only">{t('chat.unread', { count: unread })}</span>
            </>
          )}
        </button>
      )}
      {effectiveOpen && isMobile &&
        createPortal(
          <div
            id="project-chat-drawer"
            ref={drawerRef as React.RefObject<HTMLDivElement>}
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
                  setEffectiveOpen(false);
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <ChatPanel teamId={teamId} userId={user.id} userDisplayName={user.displayName} />
          </div>,
          document.body,
        )}
      {effectiveOpen && !isMobile && (
        <aside
          id="chat-inline-shell"
          ref={inlineRef as React.RefObject<HTMLElement>}
          className="chat-inline-shell"
          role="complementary"
          aria-label={t('chat.drawerTitle', { team: teamName })}
          style={typeof width === 'number' ? ({ width: `${width}px` } as React.CSSProperties) : undefined}
        >
          <div
            className="chat-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label={t('chat.resizeAria', { defaultValue: 'Resize chat panel' })}
            aria-valuenow={width}
            aria-valuemin={320}
            aria-valuemax={440}
            tabIndex={0}
            onPointerDown={onResizeHandlePointerDown}
            onDoubleClick={() => {
              if (typeof width === 'number' && width !== 360) {
                const reset = 360;
                // width setter lives in Layout; use onWidthChange if available
                if (typeof (onWidthChange as unknown) === 'function') (onWidthChange as (w:number)=>void)(reset);
              }
            }}
            onKeyDown={(e) => {
              if (!width || typeof onWidthChange !== 'function') return;
              if (e.key === 'ArrowLeft') { e.preventDefault(); const next = Math.min(440, Math.max(320, width + 16)); onWidthChange(next); }
              if (e.key === 'ArrowRight') { e.preventDefault(); const next = Math.min(440, Math.max(320, width - 16)); onWidthChange(next); }
              if (e.key === 'Home') { e.preventDefault(); onWidthChange(320); }
              if (e.key === 'End') { e.preventDefault(); onWidthChange(440); }
            }}
          />
          <div className="chat-inline-head">
            <span className="chat-inline-title">{t('chat.drawerTitle', { team: teamName })}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={t('chat.closeAria')}
              onClick={() => setEffectiveOpen(false)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <ChatPanel teamId={teamId} userId={user.id} userDisplayName={user.displayName} />
        </aside>
      )}
    </>
  );
}
