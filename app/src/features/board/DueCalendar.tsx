import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, Circle, Clock, Eye, CheckCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { addDaysIso, inMonth, isoOf, monthMatrix, monthName, parseIso, weekDays } from '../../lib/calendar';
import { dueBucket, dueLabel, dueTone, taskDueChip, todayIso } from '../../lib/due-dates';

import type { Task } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { registerDrop } from '../../lib/drop-registry';
import { useTouchDrag } from '../../hooks/useTouchDrag';

interface DueCalendarProps {
  onOpenTask: (taskId: string) => void;
  onQuickCreate: (dueDate: string) => void;
  taskFilter?: (t: Task) => boolean;
  onTouchDrop?: (taskId: string, dropKey: string | null) => void;
  mineOnly?: boolean;
  onToggleMine?: (v: boolean) => void;
  showMineFilter?: boolean;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalTaskChipProps {
  task: Task;
  date?: string;
  segmentStart?: string;
  span?: number;
  onOpenTask: (taskId: string) => void;
  onTouchDrop?: (taskId: string, dropKey: string | null) => void;
  onDragOffset?: (offset: number, start: string | null) => void;
  style?: React.CSSProperties;
  classNameExtra?: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  todo: <Circle size={14} weight="bold" aria-hidden="true" />,
  inProgress: <Clock size={14} weight="bold" aria-hidden="true" />,
  review: <Eye size={14} weight="bold" aria-hidden="true" />,
  done: <CheckCircle size={14} weight="fill" aria-hidden="true" />,
};

function CalTaskChip({ task, date, segmentStart, span, onOpenTask, onTouchDrop, onDragOffset, style, classNameExtra }: CalTaskChipProps) {
  const { canEdit } = useProject();
  const ref = useRef<HTMLButtonElement>(null);
  const handleTouchDrop = useCallback(
    (dropKey: string | null) => onTouchDrop?.(task.id, dropKey),
    [task.id, onTouchDrop],
  );
  useTouchDrag(ref, { enabled: canEdit && !!onTouchDrop, onDrop: handleTouchDrop });
  const title = date ? `${task.title} \u00b7 ${dueLabel(date, todayIso())}` : undefined;
  const rawTone = task.status === 'done' ? taskDueChip(task).tone : date ? dueTone(dueBucket(date, todayIso())) : 'neutral';
  const tone = rawTone as 'danger' | 'warn' | 'success' | 'neutral';
  const isDone = task.status === 'done';
  return (
    <button
      ref={ref}
      type="button"
      className={`due-cal-task due-cal-task-${tone}${isDone ? ' due-cal-task-done' : ''} ${classNameExtra ?? ''}`}
      draggable={canEdit}
      title={title}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onOpenTask(task.id);
      }}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        if (onDragOffset) {
          if (segmentStart && span && span > 1) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const colWidth = rect.width / span;
            const offsetInSegment = Math.max(0, Math.min(span - 1, Math.floor(x / colWidth)));
            const grabDate = addDaysIso(segmentStart, offsetInSegment);
            onDragOffset(0, grabDate);
          } else if (segmentStart) {
            onDragOffset(0, segmentStart);
          } else {
            onDragOffset(0, task.startDate ?? task.dueDate ?? null);
          }
        }
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, opacity: 0.9 }}>
        {STATUS_ICON[task.status]}
      </span>
      <span className="due-cal-task-title">{task.title}</span>
    </button>
  );
}

const MAX_VISIBLE = 3;

export function DueCalendar({ onOpenTask, onQuickCreate, taskFilter, onTouchDrop, mineOnly, onToggleMine, showMineFilter }: DueCalendarProps) {
  const { state, canEdit, dispatch } = useProject();
  const [anchor, setAnchor] = useState(todayIso());
  const [weekMode, setWeekMode] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [stripCollapsed, setStripCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("due-cal-strip-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("due-cal-strip-collapsed", stripCollapsed ? "1" : "0"); } catch {}
  }, [stripCollapsed]);
  const dragGrabDateRef = useRef<string | null>(null);
  const { t } = useTranslation('tracker');

  const anchorDate = parseIso(anchor);
  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth();
  const today = todayIso();

  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const flatCells = useMemo(() => (weekMode ? weekDays(anchor) : weeks.flat()), [weekMode, anchor, weeks]);
  const cells = flatCells;

  const unscheduled = useMemo(
    () =>
      (state?.tasks ?? [])
        .filter((t) => !t.dueDate && !(hideCompleted && t.status === 'done') && (!taskFilter || taskFilter(t)))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [state, hideCompleted, taskFilter],
  );

  const dateToPos = useMemo(() => {
    const map = new Map<string, { row: number; col: number }>();
    if (weekMode) {
      const w = weekDays(anchor);
      w.forEach((d, i) => map.set(d, { row: 0, col: i }));
    } else {
      weeks.forEach((week, r) => {
        week.forEach((d, c) => map.set(d, { row: r, col: c }));
      });
    }
    return map;
  }, [weeks, weekMode, anchor]);

  const spanningSegments = useMemo(() => {
    const segments: Array<{ task: Task; row: number; colStart: number; span: number; startDate: string; endDate: string }> = [];
    const visibleStart = weekMode ? weekDays(anchor)[0]! : weeks[0]![0]!;
    const visibleEnd = weekMode ? weekDays(anchor)[6]! : weeks[5]![6]!;
    for (const task of state?.tasks ?? []) {
      if (!task.dueDate) continue;
      if (hideCompleted && task.status === 'done') continue;
      if (taskFilter && !taskFilter(task)) continue;
      const rawStart = task.startDate && task.startDate <= task.dueDate ? task.startDate : task.dueDate;
      const rawEnd = task.dueDate;
      const start = rawStart < visibleStart ? visibleStart : rawStart;
      const end = rawEnd > visibleEnd ? visibleEnd : rawEnd;
      if (start > end) continue;
      let cur = start;
      while (cur <= end) {
        const pos = dateToPos.get(cur);
        if (!pos) break;
        const row = pos.row;
        const rowEndDate = weekMode ? weekDays(anchor)[6]! : weeks[row]![6]!;
        const segEnd = end <= rowEndDate ? end : rowEndDate;
        const endPos = dateToPos.get(segEnd);
        if (!endPos) break;
        const colStart = pos.col;
        const colEnd = endPos.col;
        const span = colEnd - colStart + 1;
        segments.push({ task, row, colStart, span, startDate: cur, endDate: segEnd });
        if (segEnd === end) break;
        cur = addDaysIso(segEnd, 1);
      }
    }
    segments.sort((a, b) => a.row - b.row || a.colStart - b.colStart || a.task.title.localeCompare(b.task.title));
    return segments;
  }, [state, hideCompleted, taskFilter, weeks, weekMode, anchor, dateToPos]);

  // Group by row and compute lanes and overflow
  const rowGroups = useMemo(() => {
    const byRow = new Map<number, typeof spanningSegments>();
    for (const s of spanningSegments) {
      const arr = byRow.get(s.row) ?? [];
      arr.push(s);
      byRow.set(s.row, arr);
    }
    const result = new Map<number, { segments: typeof spanningSegments; lanes: number[][]; overflow: number }>();
    for (const [row, segs] of byRow) {
      // sort for lane packing already sorted
      const lanes: number[] = [];
      const segLanes = new Map<string, number>();
      for (const seg of segs) {
        let lane = 0;
        for (let i = 0; i < lanes.length; i++) {
          if (seg.colStart > lanes[i]!) {
            lane = i;
            break;
          }
          if (i === lanes.length - 1) lane = lanes.length;
        }
        if (lane === lanes.length) lanes.push(seg.colStart + seg.span - 1);
        else lanes[lane] = seg.colStart + seg.span - 1;
        segLanes.set(`${seg.task.id}-${seg.colStart}`, lane);
      }
      // For max visible, we need per-row max lanes needed
      const totalLanes = lanes.length;
      const overflow = Math.max(0, totalLanes - MAX_VISIBLE);
      result.set(row, { segments: segs as any, lanes: lanes as any, overflow } as any);
    }
    return result;
  }, [spanningSegments]);

  const segmentsWithLane = useMemo(() => {
    const result: Array<(typeof spanningSegments)[number] & { lane: number }> = [];
    for (const [row, group] of rowGroups) {
      const isExpanded = expandedRows.has(row);
      // recompute lanes with cap
      const segs = group.segments as typeof spanningSegments;
      const lanes: number[] = [];
      for (const seg of segs) {
        let lane = 0;
        for (let i = 0; i < lanes.length; i++) {
          if (seg.colStart > lanes[i]!) {
            lane = i;
            break;
          }
          if (i === lanes.length - 1) lane = lanes.length;
        }
        const wouldBeLane = lane === lanes.length ? lanes.length : lane;
        // if not expanded and would be >= MAX_VISIBLE, skip (will be in +N)
        if (!isExpanded && wouldBeLane >= MAX_VISIBLE) {
          // skip rendering this segment, it will be counted in more
          continue;
        }
        if (lane === lanes.length) lanes.push(seg.colStart + seg.span - 1);
        else lanes[lane] = seg.colStart + seg.span - 1;
        result.push({ ...seg, lane });
      }
    }
    return result;
  }, [spanningSegments, rowGroups, expandedRows]);

  // Row heights: if expanded, height follows max lanes, else 112
  const rowHeights = useMemo(() => {
    const heights: number[] = [];
    const numRows = weekMode ? 1 : 6;
    for (let r = 0; r < numRows; r++) {
      const group = rowGroups.get(r);
      if (!group) {
        heights.push(112);
        continue;
      }
      const totalLanes = (group as any).lanes?.length ?? 0;
      const isRowExpanded = expandedRows.has(r) || Array.from(expandedCells).some(d => {
        const pos = dateToPos.get(d);
        return pos?.row === r;
      });
      const needed = isRowExpanded ? Math.max(140, 28 + totalLanes * 26 + 28) : 140;
      heights.push(needed);
    }
    return heights;
  }, [rowGroups, expandedRows, expandedCells, weekMode, dateToPos]);

  const nav = (dir: number) => {
    if (weekMode) {
      setAnchor(addDaysIso(anchor, dir * 7));
    } else {
      const d = new Date(Date.UTC(year, month + dir, 1));
      setAnchor(isoOf(d));
    }
  };

  const moveFocus = (dir: 1 | -1 | 7 | -7) => {
    const base = focused ?? today;
    setFocused(addDaysIso(base, dir));
  };

  const moveToDate = useCallback(
    (taskId: string, date: string | null) => {
      if (!canEdit) return;
      const task = state?.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (date === null) {
        if (task.dueDate !== null) dispatch({ type: 'task/update', id: taskId, patch: { dueDate: null } });
        dragGrabDateRef.current = null;
        return;
      }
      if (task.startDate && task.dueDate && task.startDate !== task.dueDate) {
        const oldStart = task.startDate;
        const oldDue = task.dueDate!;
        const duration = Math.round((parseIso(oldDue).getTime() - parseIso(oldStart).getTime()) / 86400000);
        const grabDate = dragGrabDateRef.current;
        let offset = 0;
        if (grabDate) {
          offset = Math.round((parseIso(grabDate).getTime() - parseIso(oldStart).getTime()) / 86400000);
        }
        const newStart = addDaysIso(date, -offset);
        const newDue = addDaysIso(newStart, duration);
        dragGrabDateRef.current = null;
        if (task.dueDate !== newDue || task.startDate !== newStart) {
          dispatch({ type: 'task/update', id: taskId, patch: { dueDate: newDue, startDate: newStart } });
        }
      } else {
        dragGrabDateRef.current = null;
        if (task.dueDate !== date) dispatch({ type: 'task/update', id: taskId, patch: { dueDate: date } });
      }
    },
    [canEdit, state, dispatch],
  );

  useEffect(() => {
    const unregisters = cells.map((date) =>
      registerDrop(`date:${date}`, (id) => moveToDate(id, date)),
    );
    unregisters.push(registerDrop('clear', (id) => moveToDate(id, null)));
    return () => {
      for (const unregister of unregisters) unregister();
    };
  }, [cells, moveToDate]);

  const onDrop = (date: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveToDate(id, date);
  };

  const onClearDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveToDate(id, null);
  };

  const cell = (date: string) => {
    const dimmed = !weekMode && !inMonth(date, year, month);
    const isToday = date === today;
    return (
      <div
        key={date}
        className={`due-cal-cell${dimmed ? ' due-cal-dim' : ''}${isToday ? ' due-cal-today' : ''}`}
        data-date={date}
        data-drop-key={`date:${date}`}
        tabIndex={focused === date ? 0 : -1}
        onFocus={() => setFocused(date)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') moveFocus(1);
          else if (e.key === 'ArrowLeft') moveFocus(-1);
          else if (e.key === 'ArrowDown') moveFocus(7);
          else if (e.key === 'ArrowUp') moveFocus(-7);
          else if (e.key === 'PageDown') nav(1);
          else if (e.key === 'PageUp') nav(-1);
          else if (e.key === 'Enter') onQuickCreate(date);
        }}
        onClick={() => onQuickCreate(date)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={onDrop(date)}
      >
        <span className="due-cal-daynum">{date.slice(8)}</span>
      </div>
    );
  };

  const gridRowTemplate = weekMode
    ? `28px ${rowHeights[0]}px`
    : `28px ${rowHeights.map((h) => `${h}px`).join(' ')}`;

  return (
    <div className="due-cal">
      <div className="due-cal-toolbar">
        <div className="due-cal-nav">
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('board.cal.prevMonth')} onClick={() => nav(-1)}>
            <CaretLeft size={14} aria-hidden="true" />
          </button>
          <span className="due-cal-month-name">{monthName(year, month)}</span>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('board.cal.nextMonth')} onClick={() => nav(1)}>
            <CaretRight size={14} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAnchor(today)}>
            {t('board.cal.today')}
          </button>
        </div>
        <div className="sub-tabs" role="tablist" aria-label={t('board.cal.viewLabel')}>
          <button
            type="button"
            role="tab"
            className={`sub-tab ${!weekMode ? 'sub-tab-active' : ''}`}
            aria-selected={!weekMode}
            onClick={() => setWeekMode(false)}
          >
            {t('board.cal.month')}
          </button>
          <button
            type="button"
            role="tab"
            className={`sub-tab ${weekMode ? 'sub-tab-active' : ''}`}
            aria-selected={weekMode}
            onClick={() => setWeekMode(true)}
          >
            {t('board.cal.week')}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {showMineFilter && onToggleMine && (
            <label className="due-cal-hide">
              <input
                type="checkbox"
                checked={!!mineOnly}
                onChange={(e) => onToggleMine(e.target.checked)}
              />
              {t('board.onlyMyTasks')}
            </label>
          )}
          <label className="due-cal-hide">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            {t('board.cal.hideCompleted')}
          </label>
        </div>
      </div>

      <div className="due-cal-body">
        <div className={`due-cal-grid due-cal-${weekMode ? 'week' : 'month'}`} style={{ position: 'relative', gridTemplateRows: gridRowTemplate }}>
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="due-cal-head">
              {t(`board.cal.weekday.${d.toLowerCase()}`)}
            </div>
          ))}
          {cells.map(cell)}
        <div className="due-cal-spans-container" style={{ position: 'absolute', top: '28px', left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {segmentsWithLane.map(({ task, row, colStart, span, lane, startDate }) => {
          const top = rowHeights.slice(0, row).reduce((a, b) => a + b + 1, 0) + 28 + lane * 26;
          const left = `calc(${colStart} * ((100% - 6px) / 7 + 1px) + 4px)`;
          const width = `calc(${span} * ((100% - 6px) / 7) + ${(span - 1) * 1}px - 8px)`;
          const segmentStart = startDate ?? task.startDate ?? task.dueDate ?? null;
          return (
            <CalTaskChip
              key={`${task.id}-${row}-${colStart}`}
              task={task}
              date={task.dueDate ?? undefined}
              segmentStart={segmentStart ?? undefined}
              span={span}
              onOpenTask={onOpenTask}
              onTouchDrop={onTouchDrop}
              onDragOffset={(_, grabDate) => { dragGrabDateRef.current = grabDate; }}
              classNameExtra="due-cal-span"
              style={{
                position: 'absolute',
                top: `${top}px`,
                left,
                width,
                zIndex: 2,
                margin: 0,
                pointerEvents: 'auto',
              }}
            />
          );
        })}
        {/* lihat yang lain per cell - di dalam cell */}
        {cells.map(date => {
          const covering = spanningSegments.filter(s => date >= s.startDate && date <= s.endDate).length;
          if (covering <= MAX_VISIBLE) return null;
          const pos = dateToPos.get(date);
          if (!pos) return null;
          const row = pos.row;
          const col = pos.col;
          const isExpanded = expandedCells.has(date) || expandedRows.has(row);
          if (isExpanded) return null;
          const overflow = covering - MAX_VISIBLE;
          const rowTop = rowHeights.slice(0, row).reduce((a,b)=>a+b+1,0);
          const top = rowTop + 28 + MAX_VISIBLE * 26; // lane 3 di dalam cell
          const left = `calc(${col} * ((100% - 6px) / 7 + 1px) + 4px)`;
          const width = `calc((100% - 6px) / 7 - 8px)`;
          return (
            <button
              key={`more-${date}`}
              type="button"
              className="due-cal-more"
              style={{
                position: 'absolute',
                top: `${top}px`,
                left,
                width,
                zIndex: 2,
                pointerEvents: 'auto',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCells(s => {
                  const n = new Set(s);
                  n.add(date);
                  return n;
                });
                setExpandedRows(s => {
                  const n = new Set(s);
                  n.add(row);
                  return n;
                });
              }}
            >
              +{overflow} lagi
            </button>
          );
        })}
        {/* tombol ciutkan per cell */}
        {Array.from(expandedCells).map(date => {
          const pos = dateToPos.get(date);
          if (!pos) return null;
          const row = pos.row;
          const col = pos.col;
          const group = rowGroups.get(row) as any;
          const total = group?.lanes.length ?? 0;
          const top = rowHeights.slice(0, row).reduce((a,b)=>a+b+1,0) + 28 + total * 26 + 4;
          const left = `calc(${col} * ((100% - 6px) / 7 + 1px) + 4px)`;
          const width = `calc((100% - 6px) / 7 - 8px)`;
          return (
            <button
              key={`less-${date}`}
              type="button"
              className="due-cal-more"
              style={{
                position: 'absolute',
                top: `${top}px`,
                left,
                width,
                zIndex: 2,
                pointerEvents: 'auto',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCells(s => {
                  const n = new Set(s);
                  n.delete(date);
                  return n;
                });
                // check if any other cell in same row still expanded, if not, collapse row
                const stillExpandedInRow = Array.from(expandedCells).some(d => d !== date && dateToPos.get(d)?.row === row);
                if (!stillExpandedInRow) {
                  setExpandedRows(s => {
                    const n = new Set(s);
                    n.delete(row);
                    return n;
                  });
                }
              }}
            >
              ciutkan
            </button>
          );
        })}
          </div>
        </div>
        </div>

      <aside
        id="due-cal-strip"
        className={`due-cal-strip ${stripCollapsed ? 'is-collapsed' : ''}`}
        data-drop-key="clear"
        role={stripCollapsed ? 'button' : undefined}
        tabIndex={stripCollapsed ? 0 : undefined}
        aria-label={stripCollapsed ? t('board.cal.expandUnscheduled') : undefined}
        onClick={stripCollapsed ? () => setStripCollapsed(false) : undefined}
        onKeyDown={stripCollapsed ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStripCollapsed(false); } } : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={onClearDrop}
      >
        <div className="due-cal-strip-head">
          {stripCollapsed ? (
            <button
              type="button"
              className="due-cal-strip-label is-collapsed-label"
              aria-label={t('board.cal.expandUnscheduled')}
              onClick={(e) => { e.stopPropagation(); setStripCollapsed(false); }}
            >
              {t('board.cal.noDate')} ({unscheduled.length})
            </button>
          ) : (
            <span className="due-cal-strip-label">{t('board.cal.noDate')} ({unscheduled.length})</span>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon due-cal-strip-toggle"
            aria-expanded={!stripCollapsed}
            aria-controls="due-cal-strip"
            aria-label={stripCollapsed ? t('board.cal.expandUnscheduled') : t('board.cal.collapseUnscheduled')}
            onClick={(e) => { e.stopPropagation(); setStripCollapsed(v => !v); }}
          >
            {stripCollapsed ? <CaretRight size={14} /> : <CaretLeft size={14} />}
          </button>
        </div>
        {!stripCollapsed && unscheduled.length === 0 && <span className="due-cal-strip-empty">{t('board.cal.stripEmpty')}</span>}
        {!stripCollapsed && unscheduled.map((t) => (
          <CalTaskChip key={t.id} task={t} onOpenTask={onOpenTask} onTouchDrop={onTouchDrop} onDragOffset={(_, grabDate) => { dragGrabDateRef.current = grabDate; }} />
        ))}
      </aside>
      </div>
    </div>
  );
}
