import { useCallback, useEffect, useRef, useState } from 'react';
import { FunnelSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from './BottomSheet';

export interface FilterControlFilter {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}

interface FilterControlProps {
  filters: FilterControlFilter[];
  label?: string;
}

function useIsMobileSheet(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}

/**
 * Trigger + panel filter terpisah dari SortControl.
 * Ikon FunnelSimple 16px (sort memakai SortAscending/Descending) + badge
 * jumlah filter aktif (hanya saat >0). Filter berlaku instan — tanpa Terapkan.
 */
export function FilterControl({ filters, label }: FilterControlProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const isMobile = useIsMobileSheet();
  const activeCount = filters.filter((f) => f.checked).length;
  const title = t('sort.filter');

  const toggleMenu = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const closeSheet = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || isMobile) return;
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
  }, [open, isMobile]);

  const trigger = (
    <button
      type="button"
      className="btn btn-ghost btn-sm sort-control-trigger filter-control-trigger"
      aria-haspopup={isMobile ? 'dialog' : 'menu'}
      aria-expanded={open}
      aria-label={activeCount > 0 ? `${title} · ${activeCount}` : title}
      onClick={toggleMenu}
    >
      <FunnelSimple size={16} aria-hidden="true" />
      <span className="sort-trigger-text" aria-hidden="true">
        {title}
      </span>
      {activeCount > 0 && (
        <span className="tab-count" aria-hidden="true">
          {activeCount}
        </span>
      )}
    </button>
  );

  if (isMobile) {
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
        {trigger}
        <BottomSheet open={open} title={title} onClose={closeSheet} hideHeader>
          <div className="sheet-section">
            <p className="sheet-section-label">{title}</p>
            {filters.map((f) => (
              <label key={f.id} className="sheet-check-row">
                <input
                  type="checkbox"
                  checked={f.checked}
                  onChange={(e) => f.onChange(e.target.checked)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </BottomSheet>
      </div>
    );
  }

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
      {trigger}
      {open && (
        <div className="sort-menu" role="menu" aria-label={title}>
          <p className="sort-menu-section-label">{title}</p>
          {filters.map((f) => (
            <label key={f.id} className="sort-menu-check">
              <input
                type="checkbox"
                checked={f.checked}
                onChange={(e) => f.onChange(e.target.checked)}
              />
              {f.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
