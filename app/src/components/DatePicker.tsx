import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAppLocale } from '../i18n';
import { addDaysIso, inMonth, mondayOf, monthMatrix, monthName, parseIso, weekDays } from '../lib/calendar';
import { formatDate } from '../lib/utils';

export interface DatePickerProps {
  id: string;
  mode: 'single' | 'range';
  /** ISO YYYY-MM-DD atau null. */
  start: string | null;
  /** Hanya mode range. */
  end: string | null;
  onApply: (start: string | null, end: string | null) => void;
  onClose: () => void;
  /**
   * Elemen jangkar eksternal untuk posisi panel. Dipakai saat DatePicker
   * dirender di dalam popup yang sudah terposisi (mis. propbar NewTaskModal).
   */
  anchorEl?: HTMLElement | null;
  /** Batas pilih (mis. rentang parent untuk subtask) — hari di luar disabled. */
  minDate?: string | null;
  maxDate?: string | null;
}

const SINGLE_WIDTH = 300;
const RANGE_WIDTH = 600;

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function weekdayHeaders(): string[] {
  const fmt = new Intl.DateTimeFormat(getAppLocale(), { weekday: 'short' });
  return weekDays(mondayOf(todayIso())).map((iso) => fmt.format(parseIso(iso)));
}

function MonthPanel({
  year,
  month,
  headers,
  today,
  focusIso,
  isSelected,
  isInRange,
  isDisabled,
  onFocusDay,
  onPick,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  year: number;
  month: number;
  headers: string[];
  today: string;
  focusIso: string;
  isSelected: (iso: string) => boolean;
  isInRange: (iso: string) => boolean;
  isDisabled?: (iso: string) => boolean;
  onFocusDay: (iso: string) => void;
  onPick: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  return (
    <div className="dp-month">
      <div className="dp-head">
        <button type="button" className="dp-nav" aria-label={prevLabel} onClick={onPrev}>
          <CaretLeft size={14} aria-hidden="true" />
        </button>
        <span className="dp-title">{monthName(year, month)}</span>
        <button type="button" className="dp-nav" aria-label={nextLabel} onClick={onNext}>
          <CaretRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="dp-grid" role="rowgroup">
        {headers.map((h) => (
          <span key={h} className="dp-dow" aria-hidden="true">
            {h}
          </span>
        ))}
        {weeks.flat().map((iso) => {
          const outside = !inMonth(iso, year, month);
          const disabled = isDisabled?.(iso) ?? false;
          const cls = [
            'dp-day',
            outside ? 'outside' : '',
            iso === today ? 'today' : '',
            isSelected(iso) ? 'selected' : '',
            isInRange(iso) ? 'inrange' : '',
            disabled ? 'disabled' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={iso}
              type="button"
              data-day={iso}
              tabIndex={iso === focusIso && !disabled ? 0 : -1}
              className={cls}
              aria-label={iso}
              aria-pressed={isSelected(iso)}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              onFocus={() => onFocusDay(iso)}
              onClick={() => onPick(iso)}
            >
              {parseIso(iso).getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ id, mode, start, end, onApply, onClose, anchorEl, minDate, maxDate }: DatePickerProps) {
  const { t } = useTranslation('tracker');
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [paintTick, setPaintTick] = useState(0);
  const panelWidth = mode === 'range' ? RANGE_WIDTH : SINGLE_WIDTH;

  const base = start ?? end ?? todayIso();
  const baseDate = parseIso(base);
  // Basis window bulan: panel kiri. Panel kanan range = basis + 1.
  const [viewYear, setViewYear] = useState(baseDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(baseDate.getUTCMonth());
  const [pending, setPending] = useState<{ start: string | null; end: string | null }>({ start, end });
  const [focusIso, setFocusIso] = useState<string>(start ?? end ?? todayIso());

  const headers = useMemo(weekdayHeaders, []);
  const today = useMemo(todayIso, []);
  const second = useMemo(() => {
    const d = new Date(Date.UTC(viewYear, viewMonth + 1, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }, [viewYear, viewMonth]);

  useLayoutEffect(() => {
    const compute = () => {
      const anchor: HTMLElement | null = anchorEl ?? anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(panelWidth, Math.max(vw - 16, 0));
      const left = Math.min(Math.max(rect.left, 8), Math.max(vw - width - 8, 8));
      const panelHeight = panelRef.current?.offsetHeight ?? 380;
      const spaceBelow = vh - rect.bottom;
      const rawTop = spaceBelow >= panelHeight + 8 ? rect.bottom + 4 : Math.max(8, rect.top - panelHeight - 4);
      const fitHeight = Math.min(panelHeight, Math.max(vh - 16, 0));
      const top = Math.min(rawTop, Math.max(8, vh - fitHeight - 8));
      setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorEl, panelWidth, paintTick]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPaintTick(1));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusIso}"]`)?.focus();
  }, [focusIso]);

  const moveMonth = (dir: number) => {
    const d = new Date(Date.UTC(viewYear, viewMonth + dir, 1));
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth());
  };

  const moveFocus = (delta: number) => {
    const next = addDaysIso(focusIso, delta);
    setFocusIso(next);
    const d = parseIso(next);
    const baseIdx = viewYear * 12 + viewMonth;
    const nextIdx = d.getUTCFullYear() * 12 + d.getUTCMonth();
    const lastIdx = mode === 'range' ? baseIdx + 1 : baseIdx;
    if (nextIdx < baseIdx || nextIdx > lastIdx) {
      const shift = nextIdx < baseIdx ? nextIdx - baseIdx : nextIdx - lastIdx;
      const s = new Date(Date.UTC(viewYear, viewMonth + shift, 1));
      setViewYear(s.getUTCFullYear());
      setViewMonth(s.getUTCMonth());
    }
  };

  const pick = (iso: string) => {
    if (mode === 'single') {
      setPending({ start: iso, end: null });
      return;
    }
    const p = pending;
    if (!p.start || (p.start && p.end)) {
      setPending({ start: iso, end: null });
    } else if (iso === p.start) {
      setPending({ start: null, end: null });
    } else if (iso < p.start) {
      setPending({ start: iso, end: p.start });
      onApply(iso, p.start);
    } else {
      setPending({ start: p.start, end: iso });
      onApply(p.start, iso);
    }
  };

  const applyToday = () => {
    if (mode === 'single') {
      setPending({ start: today, end: null });
    } else {
      setPending({ start: today, end: null });
    }
  };

  const isSelected = (iso: string) =>
    mode === 'single' ? iso === pending.start : iso === pending.start || (pending.end != null && iso === pending.end);
  const isInRange = (iso: string) =>
    mode === 'range' && pending.start != null && pending.end != null && iso > pending.start && iso < pending.end;
  const isDisabled = (iso: string) =>
    (minDate != null && iso < minDate) || (maxDate != null && iso > maxDate);

  const monthProps = {
    headers,
    today,
    focusIso,
    isSelected,
    isInRange,
    isDisabled,
    onFocusDay: setFocusIso,
    onPick: pick,
    onPrev: () => moveMonth(-1),
    onNext: () => moveMonth(1),
    prevLabel: t('board.datePicker.prevMonth'),
    nextLabel: t('board.datePicker.nextMonth'),
  };

  return (
    <>
      {!anchorEl && <span ref={anchorRef} className="dp-anchor" aria-hidden="true" />}
      {createPortal(
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={t('board.datePicker.dialogLabel')}
          className={`dp-panel${mode === 'range' ? ' dp-range-mode' : ''}`}
          style={pos ? { top: pos.top, left: pos.left, width: Math.min(panelWidth, Math.max(window.innerWidth - 16, 0)) } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onClose();
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              moveFocus(1);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              moveFocus(-1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              moveFocus(7);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              moveFocus(-7);
            }
          }}
        >
          {mode === 'single' && (
            <div className="dp-top">
              <span className="dp-field">{pending.start ? formatDate(pending.start) : t('board.datePicker.startLabel')}</span>
              <button type="button" className="dp-btn" onClick={applyToday}>
                {t('board.datePicker.today')}
              </button>
            </div>
          )}
          <div className="dp-months">
            <MonthPanel year={viewYear} month={viewMonth} {...monthProps} />
            {mode === 'range' && <MonthPanel year={second.year} month={second.month} {...monthProps} />}
          </div>
          <div className="dp-foot">
            {mode === 'single' ? (
              <span className="dp-actions">
                <button type="button" className="dp-btn" onClick={onClose}>
                  {t('board.datePicker.cancel')}
                </button>
                <button
                  type="button"
                  className="dp-btn dp-btn-primary"
                  onClick={() => onApply(pending.start, null)}
                >
                  {t('board.datePicker.apply')}
                </button>
              </span>
            ) : (
              <>
                <button type="button" className="dp-btn" onClick={applyToday}>
                  {t('board.datePicker.today')}
                </button>
                <span className="dp-range">
                  <span className="dp-field">{pending.start ? formatDate(pending.start) : t('board.datePicker.startLabel')}</span>
                  <span className="dp-sep" aria-hidden="true">
                    –
                  </span>
                  <span className="dp-field">{pending.end ? formatDate(pending.end) : t('board.datePicker.endLabel')}</span>
                </span>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
