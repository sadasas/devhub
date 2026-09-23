import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { CaretDown, SortAscending, SortDescending } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { SortDir } from '../lib/sort';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

interface SortOption {
  value: string;
  label: string;
}

export interface SortControlValue {
  key: string;
  dir: SortDir;
}

export interface SortControlFilter {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}

interface SortControlProps {
  options: SortOption[];
  value: SortControlValue | null;
  onChange: (v: SortControlValue | null) => void;
  allowNone?: boolean;
  label?: string;
  /** Toggle filter di dalam panel (mobile sheet + dropdown desktop).
      Dipakai BoardPage: "Hanya task saya" + "Sembunyikan selesai". */
  filters?: SortControlFilter[];
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

export function SortControl({
  options,
  value,
  onChange,
  allowNone = true,
  label,
  filters = [],
}: SortControlProps) {
  const [open, setOpen] = useState(false);
  // Arah tertunda saat belum ada key aktif — memungkinkan pilih arah + key dalam satu bukaan.
  // null = belum disentuh user di bukaan ini (kedua segmen netral, tanpa highlight palsu).
  const [pendingDir, setPendingDir] = useState<SortDir | null>(null);
  // Key tertunda khusus bottom sheet mobile (commit via Terapkan).
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const isMobile = useIsMobileSheet();
  const activeLabel = value ? (options.find((o) => o.value === value.key)?.label ?? value.key) : t('sort.trigger');
  // Arah hanya disorot bila benar-benar aktif (value) atau baru dipilih (pending).
  // Key pending yang beda dari value mulai netral — highlight value lama tidak bocor.
  // Bukaan segar tanpa sort = grup arah tidak dirender sama sekali (progressive disclosure).
  const activeDir: SortDir | null =
    pendingDir ?? (pendingKey != null && pendingKey !== value?.key ? null : (value?.dir ?? null));
  // Tanpa opsi sort (mis. mode kalender) panel hanya berisi filter.
  const showSort = options.length > 0;

  const toggleMenu = useCallback(() => {
    setOpen((v) => {
      if (!v) {
        setPendingDir(value?.dir ?? null);
        setPendingKey(value?.key ?? null);
      }
      return !v;
    });
  }, [value?.dir, value?.key]);

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

  const selectKey = (key: string) => {
    if (key === pendingKey) {
      // Klik ulang key yang sedang pending (atau key aktif) → terapkan + tutup.
      onChange({ key, dir: value?.dir ?? pendingDir ?? 'asc' });
      setOpen(false);
    } else {
      // Pilihan baru → tandai pending, menu tetap buka untuk pilih arah.
      setPendingKey(key);
    }
  };

  const selectDir = (dir: SortDir) => {
    const key = pendingKey ?? value?.key ?? null;
    if (key) {
      onChange({ key, dir });
      setOpen(false);
    } else {
      // Tak terjangkau (grup arah hanya tampil bila ada key) — pengaman saja.
      setPendingDir(dir);
    }
  };

  const applySheet = () => {
    if (pendingKey) onChange({ key: pendingKey, dir: pendingDir ?? 'asc' });
    else onChange(null);
    setOpen(false);
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

  // Tanpa opsi DAN tanpa filter, trigger tak berguna — sembunyikan total.
  // (Setelah semua hook agar urutan hook stabil.)
  if (!showSort && filters.length === 0) return null;

  const trigger = (
    <button
      type="button"
      className="btn btn-ghost btn-sm sort-control-trigger"
      aria-haspopup={isMobile ? 'dialog' : 'menu'}
      aria-expanded={open}
      aria-label={value ? activeLabel : t('sort.trigger')}
      onClick={toggleMenu}
    >
      {value && value.dir === 'desc' ? (
        <SortDescending size={16} aria-hidden="true" />
      ) : (
        <SortAscending size={16} aria-hidden="true" />
      )}
      <span className="sort-trigger-text" aria-hidden="true">
        {activeLabel}
      </span>
      <CaretDown size={10} aria-hidden="true" className="sort-trigger-chev" />
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
        <BottomSheet
          open={open}
          title={showSort ? t('sort.menu') : t('sort.filter')}
          onClose={closeSheet}
          hideHeader
          footer={
            <Button variant="primary" onClick={applySheet}>
              {t('sort.apply')}
            </Button>
          }
        >
          {showSort && (
            <>
              <div className="sheet-section">
                <p className="sheet-section-label">{t('sort.sortBy')}</p>
                <div className="sheet-radio-list" role="radiogroup" aria-label={t('sort.sortBy')}>
                  {value && allowNone && (
                    <button
                      type="button"
                      className={`sheet-radio-row${pendingKey === null ? ' sheet-radio-row-active' : ''}`}
                      role="radio"
                      aria-checked={pendingKey === null}
                      onClick={() => setPendingKey(null)}
                    >
                      <span className="sheet-radio-dot" aria-hidden="true" />
                      {t('sort.none')}
                    </button>
                  )}
                  {options.map((o) => {
                    const checked = pendingKey === o.value;
                    return (
                      <Fragment key={o.value}>
                        <button
                          type="button"
                          className={`sheet-radio-row${checked ? ' sheet-radio-row-active' : ''}`}
                          role="radio"
                          aria-checked={checked}
                          onClick={() => setPendingKey(o.value)}
                        >
                          <span className="sheet-radio-dot" aria-hidden="true" />
                          {o.label}
                        </button>
                        {checked && (
                          <div
                            className="seg-control"
                            role="radiogroup"
                            aria-label={t('sort.direction')}
                          >
                            {(['asc', 'desc'] as const).map((dir) => {
                              const dirChecked = pendingDir === dir;
                              return (
                                <button
                                  key={dir}
                                  type="button"
                                  className={`seg-btn${dirChecked ? ' seg-btn-active' : ''}`}
                                  role="radio"
                                  aria-checked={dirChecked}
                                  onClick={() => setPendingDir(dir)}
                                >
                                  {dir === 'asc' ? (
                                    <SortAscending size={14} aria-hidden="true" />
                                  ) : (
                                    <SortDescending size={14} aria-hidden="true" />
                                  )}
                                  {dir === 'asc' ? t('sort.ascending') : t('sort.descending')}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          {filters.length > 0 && (
            <>
              <hr className="sheet-divider" />
              <div className="sheet-section">
                <p className="sheet-section-label">{t('sort.filter')}</p>
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
            </>
          )}
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
        <div className="sort-menu" role="menu" aria-label={t('sort.menu')} ref={menuRef} onKeyDown={onMenuKeyDown}>
          {showSort && (
            <>
              <p className="sort-menu-section-label">{t('sort.sortBy')}</p>
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
              {options.map((o) => {
                const isActive = o.value === (pendingKey ?? value?.key);
                return (
                  <Fragment key={o.value}>
                    <button
                      type="button"
                      className={`sort-menu-row ${isActive ? 'sort-menu-row-active' : ''}`}
                      role="menuitemradio"
                      aria-checked={isActive}
                      onClick={() => selectKey(o.value)}
                    >
                      {o.label}
                    </button>
                    {isActive && (value || pendingKey) && (
                      <div className="sort-menu-dir" role="group" aria-label={t('sort.direction')}>
                        {(['asc', 'desc'] as const).map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            className={`sort-menu-dir-row seg-btn ${activeDir === dir ? 'sort-menu-dir-active seg-btn-active' : ''}`}
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
                    )}
                  </Fragment>
                );
              })}
            </>
          )}
          {filters.length > 0 && (
            <>
              {showSort && <hr className="sort-menu-divider" />}
              <p className="sort-menu-section-label">{t('sort.filter')}</p>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
