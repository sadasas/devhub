import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../state/project-context';
import { useAuth } from '../state/auth-context';
import { avatarColor, initialsOf } from '../lib/avatar';

const POPOVER_ID = 'presence-listbox';
const STACK_MAX = 3;
const POPOVER_WIDTH = 240;

interface PopoverPos {
  left: number;
  top: number;
  maxHeight: number;
}

function computePos(anchor: DOMRect): PopoverPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(POPOVER_WIDTH, vw - 16);
  const left = Math.max(8, Math.min(anchor.right - width, vw - 8 - width));
  const top = anchor.bottom + 6;
  return { left, top, maxHeight: Math.max(160, vh - top - 8) };
}

export function PresenceChip() {
  const { presence } = useProject();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const openAt = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setPos(computePos(rect));
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const reposition = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) setPos(computePos(rect));
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const users = useMemo(() => {
    const seen = new Set<string>();
    const unique = presence.filter((u) => {
      if (seen.has(u.userId)) return false;
      seen.add(u.userId);
      return true;
    });
    if (!user) return unique;
    return [
      ...unique.filter((u) => u.userId === user.id),
      ...unique.filter((u) => u.userId !== user.id),
    ];
  }, [presence, user]);

  if (presence.length === 0) return null;

  return (
    <span className="presence-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="badge badge-info presence-chip"
        data-testid="presence-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={POPOVER_ID}
        onClick={() => (open ? setOpen(false) : openAt())}
      >
        <span className="presence-avatars" aria-hidden="true">
          {users.slice(0, STACK_MAX).map((u) => (
            <span
              key={u.userId}
              className="presence-avatar"
              style={{ backgroundColor: avatarColor(u.userId) }}
            >
              {initialsOf(u.name)}
            </span>
          ))}
        </span>
        {t('presence.chip', { count: users.length })}
        <CaretDown size={10} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="presence-popover"
            id={POPOVER_ID}
            role="dialog"
            aria-label={t('presence.dialog')}
            style={
              pos
                ? {
                    position: 'fixed',
                    top: pos.top,
                    left: pos.left,
                    right: 'auto',
                    width: Math.min(POPOVER_WIDTH, window.innerWidth - 16),
                    maxHeight: pos.maxHeight,
                  }
                : undefined
            }
          >
            <div className="presence-popover-header">{t('presence.header', { count: users.length })}</div>
            {users.map((u) => (
              <div key={u.userId} className="presence-popover-row">
                <span className="presence-popover-avatar" aria-hidden="true">
                  <span
                    className="presence-popover-avatar-bg"
                    style={{ backgroundColor: avatarColor(u.userId) }}
                  >
                    {initialsOf(u.name)}
                  </span>
                  <span className="presence-popover-dot" aria-hidden="true" />
                </span>
                <span className="presence-popover-meta">
                  <span className="presence-popover-name">
                    {u.name || t('presence.fallbackName')}
                    {user && u.userId === user.id ? (
                      <span className="presence-you">{t('presence.you')}</span>
                    ) : null}
                  </span>
                  {u.activity ? (
                    <span className="presence-status" title={u.activity}>
                      {u.activity}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}