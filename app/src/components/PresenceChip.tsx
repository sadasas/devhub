import { useEffect, useRef, useState } from 'react';
import { CaretDown, Users } from '@phosphor-icons/react';
import { useProject } from '../state/project-context';

const LISTBOX_ID = 'presence-listbox';

export function PresenceChip() {
  const { presence } = useProject();
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

  if (presence.length === 0) return null;

  return (
    <span className="presence-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="badge badge-info presence-chip"
        data-testid="presence-chip"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={LISTBOX_ID}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="badge-dot" aria-hidden="true" />
        <Users size={11} aria-hidden="true" />
        {presence.length} online
        <CaretDown size={10} aria-hidden="true" />
      </button>
      {open && (
        <div className="presence-popover" id={LISTBOX_ID} role="listbox" aria-label="Online users">
          {presence.map((u) => (
            <div key={u.userId} className="presence-popover-user">
              <div className="presence-popover-item" role="option">
                <span className="badge-dot" aria-hidden="true" />
                {u.name || 'User'}
                {u.activity ? (
                  <span className="presence-status" title={u.activity}>
                    {u.activity}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}