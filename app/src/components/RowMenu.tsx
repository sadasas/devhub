import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DotsThreeVertical } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export interface RowMenuAction {
  key: string;
  label: ReactNode;
  icon: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

interface RowMenuProps {
  /** aria-label + title tombol ⋮ — unik per row, mis. "More actions for X" */
  triggerLabel: string;
  /** aria-label panel menu */
  menuLabel: string;
  /** id DOM unik untuk aria-controls */
  menuId: string;
  actions: RowMenuAction[];
}

/**
 * Kebab ⋮ + popup panel per row (mode narrow/mobile). Pola yang sama dengan
 * More-menu ProjectTabNav: portal more-dropdown + posisi terukur (flip ke
 * atas bila tidak muat + clamp viewport) + tutup via outside-tap / Escape
 * (fokus kembali ke trigger) + navigasi ArrowUp/Down/Home/End.
 */
export function RowMenu({ triggerLabel, menuLabel, menuId, actions }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && triggerRef.current?.contains(t)) return;
      if (menuRef.current && t && menuRef.current.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
      const width = Math.min(208, Math.max(vw - 16, 0));
      const left = Math.min(Math.max(rect.right - width, 8), Math.max(vw - width - 8, 8));
      const panelHeight = menuRef.current?.offsetHeight ?? 130;
      const spaceBelow = vh - rect.bottom;
      const top =
        spaceBelow >= panelHeight + 8 ? rect.bottom + 4 : Math.max(8, rect.top - panelHeight - 4);
      setPos((p) => (p && p.top === top && p.left === left && p.width === width ? p : { top, left, width }));
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open ]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-sm btn-icon row-kebab"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <DotsThreeVertical size={16} weight="bold" aria-hidden="true" />
      </button>
      {open && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={menuLabel}
            className="more-dropdown"
            style={pos ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
              e.preventDefault();
              const items = Array.from(
                menuRef.current?.querySelectorAll<HTMLButtonElement>('.more-item') ?? [],
              );
              if (items.length === 0) return;
              const current = document.activeElement as HTMLElement | null;
              const at = items.findIndex((el) => el === current);
              if (e.key === 'Home') {
                items[0]?.focus();
                return;
              }
              if (e.key === 'End') {
                items[items.length - 1]?.focus();
                return;
              }
              const dir = e.key === 'ArrowDown' ? 1 : -1;
              const nextIndex =
                at === -1 ? (dir === 1 ? 0 : items.length - 1) : (at + dir + items.length) % items.length;
              items[nextIndex]?.focus();
            }}
          >
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                className={`more-item${a.danger ? ' text-danger' : ''}`}
                onClick={(e) => {
                  // Portal React bubble lewat tree React (bukan DOM): tanpa ini
                  // klik item ikut memicu onClick induk kartu (mis. WhiteboardCard
                  // onOpen) sehingga navigasi pindah dan aksi menu tak terlihat.
                  e.stopPropagation();
                  a.onSelect();
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <span className="more-item-icon" aria-hidden="true">{a.icon}</span>
                <span className="more-item-label">{a.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
