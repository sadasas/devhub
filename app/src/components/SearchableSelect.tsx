import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { FE_LIMITS } from '../lib/limits';

export interface SearchableOption {
  value: string;
  label: string;
  hint?: string;
  /** Ikon opsional di depan label opsi (mis. Avatar anggota). */
  icon?: ReactNode;
}

interface SearchableSelectProps {
  id: string;
  label?: string;
  /** Accessible name for the trigger when no visible label is desired (e.g. grid cells). */
  ariaLabel?: string;
  /** ID of an external visible label (aria-labelledby wins over aria-label). */
  labelledBy?: string;
  value: string | null | undefined;
  options: SearchableOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /**
   * Text shown on the trigger when there is no value (e.g. the property
   * label: "Assignee"). Falls back to emptyLabel. The clear-row inside the
   * listbox keeps using emptyLabel.
   */
  triggerEmptyLabel?: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
  /** Buka dropdown langsung saat mount (dipakai klik-to-edit TaskModal). */
  defaultOpen?: boolean;
  /**
   * Tampilkan kolom pencarian di dalam dropdown. `false` untuk opsi
   * sedikit (mis. category/status TechModal) — panel langsung fokus,
   * navigasi keyboard tetap jalan.
   */
  searchable?: boolean;
}

export function SearchableSelect({
  id,
  label,
  ariaLabel,
  labelledBy,
  value,
  options,
  placeholder,
  allowEmpty = true,
  emptyLabel,
  triggerEmptyLabel,
  disabled = false,
  onChange,
  defaultOpen = false,
  searchable = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const resolvedEmptyLabel = emptyLabel ?? t('select.empty');
  const resolvedPlaceholder = placeholder ?? t('select.placeholder');

  const selected = options.find((o) => o.value === value);
  // Accessible name source: explicit ariaLabel wins (icon-row pattern),
  // then a non-empty visible label, then the generic fallback.
  const nameSource = (ariaLabel ?? label) || t('select.options');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  const rows = useMemo(() => {
    const base = filtered as { value: string | null; label: string; hint?: string; icon?: ReactNode }[];
    if (allowEmpty && !query.trim()) {
      return [{ value: null, label: resolvedEmptyLabel }, ...base];
    }
    return base;
  }, [allowEmpty, resolvedEmptyLabel, filtered, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => {
        if (searchable) inputRef.current?.focus();
        else panelRef.current?.focus();
      });
    }
  }, [open, searchable]);

  useEffect(() => {
    setIndex(0);
  }, [filtered.length, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!containerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const compute = () => {
      const trigger = containerRef.current?.querySelector('.ss-trigger') as HTMLElement | null;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(rect.width, 240), Math.max(vw - 16, 0));
      const left = Math.min(Math.max(rect.left, 8), Math.max(vw - width - 8, 8));
      const panelHeight = panelRef.current?.offsetHeight ?? 220;
      const spaceBelow = vh - rect.bottom;
      const top = spaceBelow >= panelHeight + 8 ? rect.bottom + 4 : Math.max(8, rect.top - panelHeight - 4);
      setPos((p) => (p && p.top === top && p.left === left && p.width === width ? p : { top, left, width }));
    };
    compute();
    const onScroll = () => compute();
    const onResize = () => compute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const display = selected?.label ?? triggerEmptyLabel ?? (allowEmpty ? resolvedEmptyLabel : resolvedPlaceholder);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const select = (v: string | null) => {
    onChange(v);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div className="ss-wrap" ref={containerRef}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="ss-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={!selected && !allowEmpty ? 'ss-trigger-text ss-trigger-placeholder' : 'ss-trigger-text'}>
          {display}
        </span>
        <CaretDown size={12} className="ss-trigger-icon" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="ss-panel"
            tabIndex={searchable ? undefined : -1}
            style={pos ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Home') {
              e.preventDefault();
              setIndex(0);
            } else if (e.key === 'End') {
              e.preventDefault();
              setIndex(Math.max(rows.length - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const row = rows[index];
              if (row) select(row.value);
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            } else if (e.key === 'Tab') {
              setOpen(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }
          }}
        >
          {searchable && (
          <input
            ref={inputRef}
            className="ss-input"
            value={query}
            maxLength={FE_LIMITS.FILTER}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('select.search')}
            aria-label={t('select.searchLabel', { what: nameSource })}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-listbox`}
            aria-activedescendant={rows[index] ? `${id}-option-${rows[index].value ?? 'empty'}` : undefined}
          />
          )}
          <div className="ss-list" id={`${id}-listbox`} role="listbox" aria-label={nameSource}>
            {rows.length === 0 && <div className="ss-empty" role="status" aria-live="polite">{t('select.noMatches', { query })}</div>}
            <div aria-live="polite" className="sr-only">{t('select.resultsCount', { count: rows.length, defaultValue: `${rows.length} options` })}</div>
            {rows.map((row, i) => {
              const isActive = i === index;
              const isSelected = row.value === value || (row.value === null && value == null);
              const key = row.value ?? 'empty';
              return (
                <button
                  key={key}
                  id={`${id}-option-${key}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={isActive ? 'ss-option ss-option-active' : 'ss-option'}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => select(row.value)}
                >
                  {row.icon ? <span className="ss-option-icon" aria-hidden="true">{row.icon}</span> : null}
                  <span className="ss-option-label">{row.label}</span>
                  {row.hint && <span className="ss-hint">{row.hint}</span>}
                </button>
              );
            })}
</div>
          </div>,
          document.body,
        )}
    </div>
  );
}