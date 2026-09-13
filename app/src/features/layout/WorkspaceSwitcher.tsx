import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown, Check, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { Team } from '../../lib/types';

// Storage key for the last active workspace. The removed TeamRail used
// RAIL_* keys (deleted with it) — this key is deliberately new so no
// stale rail value can leak into the switcher.
export const LAST_ACTIVE_TEAM_KEY = 'devhub:team:lastActive';

// Best-effort read: null when missing, blank, or unreadable (private
// mode), so callers fall back to teams[0].
export function readLastActiveTeamId(): string | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_TEAM_KEY);
    const value = raw?.trim() ?? '';
    return value ? value : null;
  } catch {
    return null;
  }
}

// Best-effort write: never throws (storage may be unavailable).
export function writeLastActiveTeamId(teamId: string): void {
  try {
    localStorage.setItem(LAST_ACTIVE_TEAM_KEY, teamId);
  } catch {
    // Persistence is a hint only — the route stays the source of truth.
  }
}

interface WorkspaceSwitcherProps {
  teams: Team[];
  activeTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onCreateTeam: () => void;
}

// Small compound switcher: trigger (active team icon + name + chevron)
// plus a body-portalled menu with the user's teams only (no "All teams"
// entry — locked decision) and a Create-team row. The menu is portalled
// because .sidebar(.region) clips with overflow:hidden.
export function WorkspaceSwitcher({
  teams,
  activeTeamId,
  onSelectTeam,
  onCreateTeam,
}: WorkspaceSwitcherProps) {
  const { t } = useTranslation('shell');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const activeTeam = teams.find((tm) => tm.id === activeTeamId) ?? null;

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const choose = (teamId: string) => {
    setOpen(false);
    if (teamId !== activeTeamId) onSelectTeam(teamId);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const create = () => {
    setOpen(false);
    onCreateTeam();
    // The create modal autofocuses its own input — no focus restore needed.
  };

  // Click-outside closes; Escape closes and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);

  // Anchor the portalled menu to the trigger rect, clamped to the
  // viewport; flip above the trigger when space below is tight.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const compute = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(rect.width, 200), Math.max(vw - 16, 0));
      const left = Math.min(Math.max(rect.left, 8), Math.max(vw - width - 8, 8));
      const height = menuRef.current?.offsetHeight ?? 240;
      const spaceBelow = vh - rect.bottom;
      const top =
        spaceBelow >= height + 8 ? rect.bottom + 4 : Math.max(8, rect.top - height - 4);
      setPos((prev) =>
        prev && prev.top === top && prev.left === left && prev.width === width
          ? prev
          : { top, left, width },
      );
    };
    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, teams.length]);

  // Move focus into the menu on open (selected option, else first).
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const selected = menuRef.current?.querySelector<HTMLElement>(
        '[role="option"][aria-selected="true"]',
      );
      const first = menuRef.current?.querySelector<HTMLElement>('[role="option"], .ws-create');
      (selected ?? first)?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open ]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = menuRef.current
        ? Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]'))
        : [];
      if (items.length === 0) return;
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const idx = items.findIndex((el) => el === document.activeElement);
      const next =
        idx === -1 ? (dir === 1 ? 0 : items.length - 1) : (idx + dir + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      const items = menuRef.current
        ? Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]'))
        : [];
      if (items.length === 0) return;
      e.preventDefault();
      (e.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
    } else if (e.key === 'Tab') {
      // Let focus leave naturally, but don't leave a stray open menu.
      setOpen(false);
    }
    // Enter activates the focused button natively; Escape is handled above.
  };

  const activeIcon = activeTeam?.icon?.trim() ? activeTeam.icon.trim() : null;
  const activeInitial = (activeTeam?.name ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="ws" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ws-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={
          activeTeam
            ? `${t('sidebar.switcher.label')}: ${activeTeam.name}`
            : t('sidebar.switcher.placeholder')
        }
        title={activeTeam?.name}
        onClick={() => setOpen((o) => !o)}
      >
        {activeIcon ? (
          <span className="ws-trigger-icon" aria-hidden="true">
            {activeIcon}
          </span>
        ) : (
          <span className="ws-avatar" aria-hidden="true">
            {activeInitial}
          </span>
        )}
        <span className="ws-trigger-name">
          {activeTeam?.name ?? t('sidebar.switcher.placeholder')}
        </span>
        <CaretDown size={14} className="ws-trigger-chevron" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-label={t('sidebar.switcher.menuLabel')}
            className="ws-menu"
            style={pos ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
            onKeyDown={onMenuKeyDown}
          >
            {teams.length === 0 ? (
              <p className="ws-empty">{t('sidebar.noTeamsYet')}</p>
            ) : (
              teams.map((tm) => {
                const selected = tm.id === activeTeamId;
                const icon = tm.icon?.trim() ? tm.icon.trim() : null;
                const initial = tm.name.trim().charAt(0).toUpperCase() || '?';
                return (
                  <button
                    key={tm.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? 'ws-option ws-option--active' : 'ws-option'}
                    title={tm.name}
                    onClick={() => choose(tm.id)}
                  >
                    {icon ? (
                      <span className="ws-option-icon" aria-hidden="true">
                        {icon}
                      </span>
                    ) : (
                      <span className="ws-avatar ws-avatar--sm" aria-hidden="true">
                        {initial}
                      </span>
                    )}
                    <span className="ws-option-label">{tm.name}</span>
                    {selected && (
                      <Check size={14} weight="bold" className="ws-option-check" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
            <div className="ws-divider" aria-hidden="true" />
            <button type="button" className="ws-option ws-create" onClick={create}>
              <Plus size={14} weight="bold" aria-hidden="true" />
              <span className="ws-option-label">{t('sidebar.createTeam')}</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
