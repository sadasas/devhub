import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretDown, SortAscending, SortDescending } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { SortDir } from '../lib/sort';

interface SortOption {
  value: string;
  label: string;
}

export interface SortControlValue {
  key: string;
  dir: SortDir;
}

interface SortControlProps {
  options: SortOption[];
  value: SortControlValue | null;
  onChange: (v: SortControlValue | null) => void;
  allowNone?: boolean;
  label?: string;
}

export function SortControl({ options, value, onChange, allowNone = true, label }: SortControlProps) {
  const [open, setOpen] = useState(false);
  // Arah tertunda saat belum ada key aktif — memungkinkan pilih arah + key dalam satu bukaan.
  const [pendingDir, setPendingDir] = useState<SortDir>('asc');
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const activeLabel = value ? (options.find((o) => o.value === value.key)?.label ?? value.key) : t('sort.trigger');
  const activeDir = value?.dir ?? pendingDir;

  const toggleMenu = useCallback(() => {
    setOpen((v) => {
      if (!v) setPendingDir(value?.dir ?? 'asc');
      return !v;
    });
  }, [value?.dir]);

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

  const selectKey = (key: string) => {
    onChange({ key, dir: value?.dir ?? pendingDir });
    setOpen(false);
  };

  const selectDir = (dir: SortDir) => {
    if (value) {
      onChange({ ...value, dir });
      setOpen(false);
    } else {
      // Belum ada key — cukup tandai, menu tetap buka untuk pilih key.
      setPendingDir(dir);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!menuRef.current) return;
    const items = [...menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"],[role="menuitemradio"]')];
    if (items.length === 0) return;
    const idx = items.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = (idx + dir + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <div
      className="sort-control"
      ref={wrapRef}
      role={label ? 'group' : undefined}
      aria-label={label ?? undefined}
    >
      {label && (
        <span className="sort-control-label" aria-hidden="true">
          {label}
        </span>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm sort-control-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        {value && value.dir === 'desc' ? (
          <SortDescending size={13} aria-hidden="true" />
        ) : (
          <SortAscending size={13} aria-hidden="true" />
        )}
        {activeLabel}
        <CaretDown size={10} aria-hidden="true" />
      </button>
      {open && (
        <div className="sort-menu" role="menu" aria-label={t('sort.menu')} ref={menuRef} onKeyDown={onMenuKeyDown}>
          {value && allowNone && (
            <button
              type="button"
              className="sort-menu-row"
              role="menuitem"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {t('sort.none')}
            </button>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`sort-menu-row ${value?.key === o.value ? 'sort-menu-row-active' : ''}`}
              role="menuitemradio"
              aria-checked={value?.key === o.value}
              onClick={() => selectKey(o.value)}
            >
              {o.label}
            </button>
          ))}
          <div className="sort-menu-dir" role="group" aria-label={t('sort.direction')}>
            {(['asc', 'desc'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                className={`sort-menu-dir-row ${activeDir === dir ? 'sort-menu-dir-active' : ''}`}
                role="menuitemradio"
                aria-checked={activeDir === dir}
                onClick={() => selectDir(dir)}
              >
                  {dir === 'asc' ? (
                    <SortAscending size={13} aria-hidden="true" />
                  ) : (
                    <SortDescending size={13} aria-hidden="true" />
                  )}
                  {dir === 'asc' ? t('sort.ascending') : t('sort.descending')}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}