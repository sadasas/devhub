import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown } from '@phosphor-icons/react';

export interface SearchableOption {
  value: string;
  label: string;
  hint?: string;
}

interface SearchableSelectProps {
  id: string;
  label?: string;
  value: string | null | undefined;
  options: SearchableOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}

export function SearchableSelect({
  id,
  label,
  value,
  options,
  placeholder,
  allowEmpty = true,
  emptyLabel = 'None',
  disabled = false,
  onChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  const rows = useMemo(() => {
    const base = filtered as { value: string | null; label: string; hint?: string }[];
    if (allowEmpty && !query.trim()) {
      return [{ value: null, label: emptyLabel }, ...base];
    }
    return base;
  }, [allowEmpty, emptyLabel, filtered, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

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

  const display = selected?.label ?? (allowEmpty ? emptyLabel : placeholder ?? 'Select…');

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
        onClick={() => setOpen((o) => !o)}
      >
        <span className={!selected && !allowEmpty ? 'ss-trigger-text ss-trigger-placeholder' : 'ss-trigger-text'}>
          {display}
        </span>
        <CaretDown size={12} className="ss-trigger-icon" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="ss-panel"
            style={pos ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
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
          <input
            ref={inputRef}
            className="ss-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label={`Search ${label ?? 'options'}`}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-listbox`}
            aria-activedescendant={rows[index] ? `${id}-option-${rows[index].value ?? 'empty'}` : undefined}
          />
          <div className="ss-list" id={`${id}-listbox`} role="listbox" aria-label={label ?? 'Options'}>
            {rows.length === 0 && <div className="ss-empty">No matches for “{query}”</div>}
            {rows.map((row, i) => {
              const isActive = i === index;
              const key = row.value ?? 'empty';
              return (
                <button
                  key={key}
                  id={`${id}-option-${key}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={isActive ? 'ss-option ss-option-active' : 'ss-option'}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => select(row.value)}
                >
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