import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { CaretDown, SortAscending, SortDescending } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { SortDir } from '../lib/sort';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

export interface ApiSortSectionValue {
  key: string;
  dir: SortDir;
}

export interface ApiSortSection {
  label: string;
  options: { value: string; label: string }[];
  value: ApiSortSectionValue | null;
  onChange: (v: ApiSortSectionValue | null) => void;
}

interface ApiSortControlProps {
  collections: ApiSortSection;
  endpoints: ApiSortSection;
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
 * Satu trigger Sort untuk dua target (collections + endpoints).
 * Tiap seksi commit langsung tanpa menutup menu agar kedua target bisa
 * diatur sekali buka; tutup via trigger/outside/Escape (desktop) atau
 * Terapkan (sheet mobile). Pola visual meniru SortControl.
 */
export function ApiSortControl({ collections, endpoints, label }: ApiSortControlProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const isMobile = useIsMobileSheet();
  const title = t('sort.trigger');
  const activeCount = (collections.value ? 1 : 0) + (endpoints.value ? 1 : 0);

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

  const trigger = (
    <button
      type="button"
      className="btn btn-ghost btn-sm sort-control-trigger"
      aria-haspopup={isMobile ? 'dialog' : 'menu'}
      aria-expanded={open}
      aria-label={activeCount > 0 ? `${title} · ${activeCount}` : title}
      onClick={toggleMenu}
    >
      <SortAscending size={16} aria-hidden="true" />
      <span className="sort-trigger-text" aria-hidden="true">
        {title}
      </span>
      {activeCount > 0 && (
        <span className="tab-count" aria-hidden="true">
          {activeCount}
        </span>
      )}
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
          title={title}
          onClose={closeSheet}
          hideHeader
          footer={
            <Button variant="primary" onClick={closeSheet}>
              {t('sort.apply')}
            </Button>
          }
        >
          <MobileSection section={collections} />
          <hr className="sheet-divider" />
          <MobileSection section={endpoints} />
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
        <div className="sort-menu" role="menu" aria-label={title} ref={menuRef} onKeyDown={onMenuKeyDown}>
          <DesktopSection section={collections} />
          <hr className="sort-menu-divider" />
          <DesktopSection section={endpoints} />
        </div>
      )}
    </div>
  );
}

function dirButtons(
  activeDir: SortDir | null,
  selectDir: (dir: SortDir) => void,
  t: (key: string) => string,
  size: number,
  rowClass: string,
  activeClass: string,
) {
  return (['asc', 'desc'] as const).map((dir) => (
    <button
      key={dir}
      type="button"
      className={`${rowClass} ${activeDir === dir ? activeClass : ''}`}
      role="menuitemradio"
      aria-checked={activeDir === dir}
      onClick={() => selectDir(dir)}
    >
      {dir === 'asc' ? (
        <SortAscending size={size} aria-hidden="true" />
      ) : (
        <SortDescending size={size} aria-hidden="true" />
      )}
      {dir === 'asc' ? t('sort.ascending') : t('sort.descending')}
    </button>
  ));
}

function DesktopSection({ section }: { section: ApiSortSection }) {
  const { t } = useTranslation();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingDir, setPendingDir] = useState<SortDir | null>(null);
  const { options, value, onChange } = section;
  const activeDir: SortDir | null =
    pendingDir ?? (pendingKey != null && pendingKey !== value?.key ? null : (value?.dir ?? null));

  const selectKey = (key: string) => {
    if (key === pendingKey) {
      onChange({ key, dir: value?.dir ?? pendingDir ?? 'asc' });
    } else {
      setPendingKey(key);
    }
  };

  const selectDir = (dir: SortDir) => {
    const key = pendingKey ?? value?.key ?? null;
    if (key) onChange({ key, dir });
    else setPendingDir(dir);
  };

  return (
    <>
      <p className="sort-menu-section-label">{section.label}</p>
      {value && (
        <button
          type="button"
          className="sort-menu-row"
          role="menuitem"
          onClick={() => {
            onChange(null);
            setPendingKey(null);
            setPendingDir(null);
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
                {dirButtons(activeDir, selectDir, t, 13, 'sort-menu-dir-row seg-btn', 'sort-menu-dir-active seg-btn-active')}
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function MobileSection({ section }: { section: ApiSortSection }) {
  const { t } = useTranslation();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingDir, setPendingDir] = useState<SortDir | null>(null);
  const { options, value, onChange } = section;

  const commit = (key: string | null, dir: SortDir) => {
    if (key) onChange({ key, dir });
    else onChange(null);
  };

  return (
    <div className="sheet-section">
      <p className="sheet-section-label">{section.label}</p>
      <div className="sheet-radio-list" role="radiogroup" aria-label={section.label}>
        {value && (
          <button
            type="button"
            className={`sheet-radio-row${pendingKey === null ? ' sheet-radio-row-active' : ''}`}
            role="radio"
            aria-checked={pendingKey === null}
            onClick={() => {
              setPendingKey(null);
              commit(null, pendingDir ?? 'asc');
            }}
          >
            <span className="sheet-radio-dot" aria-hidden="true" />
            {t('sort.none')}
          </button>
        )}
        {options.map((o) => {
          const checked = (pendingKey ?? value?.key) === o.value;
          return (
            <Fragment key={o.value}>
              <button
                type="button"
                className={`sheet-radio-row${checked ? ' sheet-radio-row-active' : ''}`}
                role="radio"
                aria-checked={checked}
                onClick={() => {
                  setPendingKey(o.value);
                  commit(o.value, pendingDir ?? value?.dir ?? 'asc');
                }}
              >
                <span className="sheet-radio-dot" aria-hidden="true" />
                {o.label}
              </button>
              {checked && (
                <div className="seg-control" role="radiogroup" aria-label={t('sort.direction')}>
                  {(['asc', 'desc'] as const).map((dir) => {
                    const dirChecked = (pendingDir ?? value?.dir) === dir;
                    return (
                      <button
                        key={dir}
                        type="button"
                        className={`seg-btn${dirChecked ? ' seg-btn-active' : ''}`}
                        role="radio"
                        aria-checked={dirChecked}
                        onClick={() => {
                          setPendingDir(dir);
                          const key = pendingKey ?? value?.key ?? o.value;
                          commit(key, dir);
                        }}
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
  );
}
