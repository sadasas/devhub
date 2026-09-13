import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { DotsThree } from '@phosphor-icons/react';

export interface RowMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface RowMenuProps {
  /** aria-label untuk tombol ⋯ (wajib i18n, mis. t('admin.table.rowActions')) */
  label: string;
  items: RowMenuItem[];
  disabled?: boolean;
}

/** Row actions satu menu ⋯ (Fase 1).
 *  Icon-only hanya dengan tooltip (title) + aria-label — sesuai kontrak.
 */
export function RowMenu({ label, items, disabled = false }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // APG menu-button: panah/Home/End navigasi antar item, Tab menutup, Esc menutup + fokus balik
  function onPanelKeyDown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (items[idx + 1] ?? items[0])?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      (items[idx - 1] ?? items[items.length - 1])?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    // Fokus item aktif pertama saat dibuka (Enter/Esc/arrows siap)
    panelRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
    function onDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-ghost btn-sm btn-icon"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsThree size={16} weight="bold" aria-hidden="true" />
      </button>
      {open && (
        <div ref={panelRef} className="row-menu-panel" role="menu" aria-label={label} onKeyDown={onPanelKeyDown}>
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className={`row-menu-item${it.danger ? ' row-menu-item-danger' : ''}`}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.icon && (
                <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                  {it.icon}
                </span>
              )}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
