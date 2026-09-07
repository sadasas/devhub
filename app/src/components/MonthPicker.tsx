import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAppLocale } from '../i18n';

export interface MonthPickerProps {
  id: string;
  /** Elemen jangkar (label bulan) untuk posisi panel. */
  anchorEl: HTMLElement | null;
  /** Bulan yang sedang tampil di kalender. */
  viewYear: number;
  viewMonth: number;
  onPick: (year: number, month: number) => void;
  onClose: () => void;
}

const PANEL_WIDTH = 264;

function shortMonthNames(): string[] {
  const fmt = new Intl.DateTimeFormat(getAppLocale(), { month: 'short', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(Date.UTC(2026, m, 1))));
}

export function MonthPicker({ id, anchorEl, viewYear, viewMonth, onPick, onClose }: MonthPickerProps) {
  const { t } = useTranslation('tracker');
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [year, setYear] = useState(viewYear);
  const [focusMonth, setFocusMonth] = useState(viewMonth);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const monthNames = useMemo(shortMonthNames, []);

  useLayoutEffect(() => {
    const compute = () => {
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(PANEL_WIDTH, Math.max(vw - 16, 0));
      const left = Math.min(Math.max(rect.left, 8), Math.max(vw - width - 8, 8));
      const panelHeight = panelRef.current?.offsetHeight ?? 320;
      const spaceBelow = vh - rect.bottom;
      const top = spaceBelow >= panelHeight + 8 ? rect.bottom + 4 : Math.max(8, rect.top - panelHeight - 4);
      setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [anchorEl]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !(anchorEl?.contains(e.target as Node))) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose, anchorEl]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-month="${focusMonth}"]`)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveFocus = (delta: number) => {
    setFocusMonth((prev) => {
      let m = prev + delta;
      let y = year;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      while (m > 11) {
        m -= 12;
        y += 1;
      }
      if (y !== year) setYear(y);
      return m;
    });
  };

  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-month="${focusMonth}"]`)?.focus();
  }, [focusMonth, year]);

  const pick = (m: number) => onPick(year, m);

  const goThisMonth = () => onPick(thisYear, thisMonth);

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={t('board.cal.monthPicker.dialogLabel')}
      className="dp-panel mp-panel"
      style={pos ? { top: pos.top, left: pos.left, width: Math.min(PANEL_WIDTH, Math.max(window.innerWidth - 16, 0)) } : undefined}
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
          moveFocus(3);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveFocus(-3);
        }
      }}
    >
      <div className="dp-head">
        <button type="button" className="dp-nav" aria-label={t('board.cal.monthPicker.prevYear')} onClick={() => setYear((y) => y - 1)}>
          <CaretLeft size={14} aria-hidden="true" />
        </button>
        <span className="dp-title">{year}</span>
        <button type="button" className="dp-nav" aria-label={t('board.cal.monthPicker.nextYear')} onClick={() => setYear((y) => y + 1)}>
          <CaretRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="mp-grid" role="rowgroup">
        {monthNames.map((name, m) => {
          const selected = year === viewYear && m === viewMonth;
          const isThis = year === thisYear && m === thisMonth;
          return (
            <button
              key={name}
              type="button"
              data-month={m}
              tabIndex={m === focusMonth ? 0 : -1}
              className={`mp-month${selected ? ' selected' : ''}${isThis ? ' this' : ''}`}
              aria-pressed={selected}
              aria-label={`${name} ${year}`}
              onFocus={() => setFocusMonth(m)}
              onClick={() => pick(m)}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="dp-foot">
        <button type="button" className="dp-btn" onClick={goThisMonth}>
          {t('board.cal.monthPicker.thisMonth')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
