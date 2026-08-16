import { useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { useProject } from '../state/project-context';
import { useAuth } from '../state/auth-context';
import { avatarColor, initialsOf } from '../lib/avatar';

const POPOVER_ID = 'presence-listbox';
const STACK_MAX = 3;

export function PresenceChip() {
  const { presence } = useProject();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
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
        onClick={() => setOpen((v) => !v)}
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
        {users.length} online
        <CaretDown size={10} aria-hidden="true" />
      </button>
      {open && (
        <div className="presence-popover" id={POPOVER_ID} role="dialog" aria-label="Online users">
          <div className="presence-popover-header">Online · {users.length}</div>
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
                  {u.name || 'User'}
                  {user && u.userId === user.id ? (
                    <span className="presence-you">(you)</span>
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
        </div>
      )}
    </span>
  );
}