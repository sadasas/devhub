import { MagnifyingGlass, X } from '@phosphor-icons/react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

export interface FilterSegment {
  value: string;
  label: string;
}

interface FilterBarProps {
  /** Search kompak (label sr-only). Omit bila tab tanpa search (Payments). */
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchLabel?: string;
  searchPlaceholder?: string;
  /** Segmented ≤3 opsi. >3 otomatis jadi dropdown (select). */
  segments?: FilterSegment[];
  selectedSegment?: string;
  onSegmentChange?: (v: string | null) => void;
  segmentsAriaLabel?: string;
  /** Dropdown explicit (dipakai bila opsi >3 di masa depan). */
  selectValue?: string;
  onSelectChange?: (v: string | null) => void;
  selectOptions?: FilterSegment[];
  selectAriaLabel?: string;
  /** Count mono + hint */
  countText?: string;
  hintText?: string;
}

/** FilterBar (Fase 1): search compact + segmented ≤3 / dropdown + count mono + hint. */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  segments,
  selectedSegment = '',
  onSegmentChange,
  segmentsAriaLabel,
  selectValue,
  onSelectChange,
  selectOptions,
  selectAriaLabel,
  countText,
  hintText,
}: FilterBarProps) {
  const { t } = useTranslation();

  const showSearch = onSearchChange !== undefined;
  const useDropdown = segments !== undefined && segments.length > 3;
  const useSegmented = segments !== undefined && segments.length > 0 && segments.length <= 3;

  // APG radiogroup: panah pindah opsi + fokus (roving tabindex sudah ada di bawah)
  function onSegKeyDown(e: KeyboardEvent<HTMLSpanElement>): void {
    if (!segments || !onSegmentChange) return;
    const btns = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % btns.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = btns.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = segments[next];
    if (!target) return;
    onSegmentChange(target.value || null);
    const nextIndex = next;
    const container = e.currentTarget;
    window.requestAnimationFrame(() => {
      if (!container.isConnected) return;
      container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
    });
  }

  return (
    <div className="filter-bar">
      {showSearch && (
        <div className="filter-bar-search">
          <label className="sr-only" htmlFor="filter-bar-search-input">
            {searchLabel ?? 'Search'}
          </label>
          <div className="input-slot-wrap">
            <input
              id="filter-bar-search-input"
              className="input"
              type="search"
              value={searchValue ?? ''}
              placeholder={searchPlaceholder ?? ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
            <span className="input-slot" aria-hidden="true">
              {searchValue ? (
                <button
                  type="button"
                  className="key-copy-btn"
                  aria-label={t('action.clear')}
                  onClick={() => onSearchChange?.('')}
                  tabIndex={-1}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              ) : (
                <MagnifyingGlass size={14} aria-hidden="true" />
              )}
            </span>
          </div>
        </div>
      )}

      {useSegmented && onSegmentChange && (
        <span className="filter-bar-seg" role="radiogroup" aria-label={segmentsAriaLabel ?? 'Filter'} onKeyDown={onSegKeyDown}>
          {segments!.map((s) => {
            const active = (selectedSegment ?? '') === s.value;
            return (
              <button
                key={s.value || '__all'}
                type="button"
                role="radio"
                aria-checked={active}
                className={`sub-tab ${active ? 'sub-tab-active' : ''}`}
                tabIndex={active ? 0 : -1}
                onClick={() => onSegmentChange(s.value || null)}
              >
                {s.label}
              </button>
            );
          })}
        </span>
      )}

      {useDropdown && onSegmentChange && (
        <select
          className="select filter-bar-select"
          aria-label={segmentsAriaLabel ?? 'Filter'}
          value={selectedSegment ?? ''}
          onChange={(e) => onSegmentChange(e.target.value || null)}
        >
          {segments!.map((s) => (
            <option key={s.value || '__all'} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {selectOptions && onSelectChange && (
        <select
          className="select filter-bar-select"
          aria-label={selectAriaLabel ?? 'Filter'}
          value={selectValue ?? ''}
          onChange={(e) => onSelectChange(e.target.value || null)}
        >
          {selectOptions.map((s) => (
            <option key={s.value || '__all'} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {countText ? <span className="filter-bar-count tabular">{countText}</span> : null}
      {hintText ? <span className="filter-bar-hint">{hintText}</span> : null}
    </div>
  );
}
