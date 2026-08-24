import { useEffect, useRef, useState } from 'react';
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
}

export function SortControl({ options, value, onChange, allowNone = true }: SortControlProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const activeLabel = value ? (options.find((o) => o.value === value.key)?.label ?? value.key) : t('sort.trigger');

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
    onChange({ key, dir: value?.dir ?? 'asc' });
    setOpen(false);
  };

  return (
    <div className="sort-control" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-ghost btn-sm sort-control-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
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
        <div className="sort-menu" role="menu" aria-label={t('sort.menu')}>
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
          {value && (
            <div className="sort-menu-dir" role="group" aria-label={t('sort.direction')}>
              {(['asc', 'desc'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className={`sort-menu-dir-row ${value.dir === dir ? 'sort-menu-dir-active' : ''}`}
                  role="menuitemradio"
                  aria-checked={value.dir === dir}
                  onClick={() => {
                    onChange({ ...value, dir });
                    setOpen(false);
                  }}
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
          )}
        </div>
      )}
    </div>
  );
}