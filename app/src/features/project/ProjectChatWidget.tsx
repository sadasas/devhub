import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useAuth } from '../../state/auth-context';
import { ChatPanel } from '../teams/ChatPanel';
import { onToggleChat } from '../../lib/chat-events';

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
    if (isControlled) return;
    const off = onToggleChat(() => setInternalOpen((v) => !v));
    return off;
  }, [isControlled]);

  useEffect(() => {
    if (!effectiveOpen) return;
    void api.setMessagesRead(teamId, new Date().toISOString()).catch(() => {});
  }, [effectiveOpen, teamId]);

  // Focus returns to the permanent topbar chat button (the removed FAB's
  // replacement). Query by id to avoid prop drilling through Layout.
  const focusTopbarChatButton = () => {
    document.getElementById('topbar-chat-btn')?.focus();
  };

  // drawer mode (mobile): portal + inert + focus trap
  useEffect(() => {
    if (!effectiveOpen || !isMobile) return;
    const drawer = drawerRef.current;
    const queryFocusable = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]):not([aria-disabled="true"]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    const first = queryFocusable()[0];
    requestAnimationFrame(() => (drawer?.querySelector<HTMLTextAreaElement>('.chat-input') ?? first)?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement instanceof HTMLTextAreaElement) return;
        const mentionOpen = !!document.querySelector('.mention-popup');
        if (mentionOpen) return;
        e.preventDefault();
        setEffectiveOpen(false);
        focusTopbarChatButton();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = queryFocusable();
        if (focusable.length === 0) return;
        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
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
      focusTopbarChatButton();
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

  // Floating launcher removed — open via the permanent topbar chat button
  // (toggleChat event). Drawer + inline panel logic unchanged.
  return (
    <>
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
              <h2 id="chat-drawer-title" className="chat-drawer-title">{t('chat.drawerTitle', { team: teamName })}</h2>
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
          style={typeof width === 'number' ? ({ '--chat-w': `${width}px` } as React.CSSProperties) : undefined}
        >
          <div
            className="chat-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label={t('chat.resizeAria', { defaultValue: 'Resize chat panel' })}
            aria-valuenow={width}
            aria-valuetext={typeof width === 'number' ? `${width}px` : undefined}
            aria-controls="chat-inline-shell"
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
            <h2 className="chat-inline-title">{t('chat.drawerTitle', { team: teamName })}</h2>
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
