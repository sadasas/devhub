import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, CalendarBlank, Check, GitBranch, Plus } from
'@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { addDaysIso, inMonth, isoOf, monthName, parseIso, visibleMonthMatrix, weekDays } from '../../lib/calendar';
import { dueBucket, dueLabel, dueTone, taskDueChip, todayIso } from '../../lib/due-dates';
import { subRangeOutsideParent } from '../../lib/start-dates';
import { TASK_PRIORITY, TASK_PRIORITY_ORDER, TASK_STATUS } from '../../lib/labels';
import { TaskPriorityIcon, TaskStatusIcon } from '../../lib/task-icons';
import { formatDate } from '../../lib/utils';
import { getAppLocale } from '../../i18n';

import type { Task } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { registerDrop } from '../../lib/drop-registry';
import { useTouchDrag } from '../../hooks/useTouchDrag';
import { Avatar } from '../../components/Avatar';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { MonthPicker } from '../../components/MonthPicker';
import { Tooltip } from '../../components/Tooltip';
import { GCalSyncedMark } from '../integrations/GCalSyncedMark';
import { TaskCard } from './TaskCard';

interface MemberInfo {
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
}

interface DueCalendarProps {
  onOpenTask?: (taskId: string) => void;
  onQuickCreate?: (dueDate: string) => void;
  taskFilter?: (t: Task) => boolean;
  onTouchDrop?: (taskId: string, dropKey: string | null) => void;
  /** Controlled from the board toolbar; defaults to false when omitted. */
  hideCompleted?: boolean;
  /** Optional external task source (e.g. public view). When provided, it replaces state?.tasks. */
  tasks?: Task[];
  /** Read-only mode: hides quick-create + drag/drop + move dialog. Chips still call onOpenTask when provided. */
  readOnly?: boolean;
  members?: Record<string, MemberInfo>;
  unreadIds?: ReadonlySet<string>;
}

/**
 * Safe wrapper around useProject(): returns null outside ProjectProvider
 * (e.g. public view with `tasks` prop) instead of throwing.
 * BoardPage path (inside provider) keeps existing behaviour.
 */
function useProjectSafe(): { state: { tasks: Task[] } | null; canEdit: boolean; dispatch?: (a: any) => void; projectId?: string } | null {
  try {
    return useProject() as unknown as { state: { tasks: Task[] } | null; canEdit: boolean; dispatch: (a: any) => void };
  } catch {
    return null;
  }
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalTaskChipProps {
  task: Task;
  date?: string;
  segmentStart?: string;
  span?: number;
  members?: Record<string, MemberInfo>;
  onOpenTask?: (taskId: string) => void;
  onTouchDrop?: (taskId: string, dropKey: string | null) => void;
  onDragOffset?: (offset: number, start: string | null) => void;
  onMove?: (taskId: string) => void;
  /** Dilaporkan saat drag HTML5 mulai/selesai — grid memakainya untuk ghost slot drop. */
  onDragState?: (taskId: string | null) => void;
  style?: React.CSSProperties;
  classNameExtra?: string;
  readOnly?: boolean;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  todo: <TaskStatusIcon status="todo" size={14} />,
  inProgress: <TaskStatusIcon status="inProgress" size={14} />,
  review: <TaskStatusIcon status="review" size={14} />,
  done: <TaskStatusIcon status="done" size={14} />,
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [query]);
  return matches;
}

function formatDayAriaLabel(isoDate: string): string {
  try {
    return parseIso(isoDate).toLocaleDateString(getAppLocale(), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return isoDate;
  }
}

function CalTaskChip({ task, date, segmentStart, span, members, onOpenTask, onTouchDrop, onDragOffset, onMove, onDragState, style, classNameExtra, readOnly = false }: CalTaskChipProps) {
  const { t } = useTranslation('tracker');
  const project = useProjectSafe();
  const canEdit = !readOnly && (project?.canEdit ?? false);
  const canMove = canEdit && !!onMove;
  const ref = useRef<HTMLButtonElement>(null);
  // Tooltip ditutup paksa saat drag (browser tak menembakkan mouseleave
  // selama drag HTML5 + tombol memegang fokus) via disabled + blur.
  const [dragging, setDragging] = useState(false);
  const handleTouchDrop = useCallback(
    (dropKey: string | null) => onTouchDrop?.(task.id, dropKey),
    [task.id, onTouchDrop],
  );
  useTouchDrag(ref, { enabled: canEdit && !!onTouchDrop, onDrop: handleTouchDrop });
  const assignee = task.assigneeId ? members?.[task.assigneeId] : undefined;
  const assigneeName = assignee ? (assignee.displayName || assignee.email) : undefined;
  const parentTitle = task.parentTaskId
    ? (project?.state?.tasks.find((tt) => tt.id === task.parentTaskId)?.title ?? null)
    : null;
  const baseLabel = date ? `${task.title} · ${dueLabel(date, todayIso())}` : task.title;
  const subLabel = parentTitle ? `${baseLabel} · ${t('board.cal.subtaskOf', { defaultValue: 'subtask of {{parent}}', parent: parentTitle })}` : baseLabel;
  const fullLabel = assigneeName ? `${subLabel} · ${assigneeName}` : subLabel;
  const ariaLabel = canMove ? `${fullLabel}. Press M to move date, Enter to open.` : fullLabel;
  const rawTone = task.status === 'done' ? taskDueChip(task).tone : date ? dueTone(dueBucket(date, todayIso())) : 'neutral';
  const tone = rawTone as 'danger' | 'warn' | 'success' | 'neutral';
  const isDone = task.status === 'done';
  const isMultiDay = !!task.startDate && !!task.dueDate && task.startDate !== task.dueDate;
  const dueDateIso = date ?? task.dueDate ?? undefined;
  const dueText = isMultiDay
    ? `${formatDate(task.startDate)} → ${formatDate(task.dueDate)}`
    : (dueDateIso ? dueLabel(dueDateIso, todayIso()) : '');
  return (
    <Tooltip
      side="top"
      title={task.title}
      icon={STATUS_ICON[task.status]}
      disabled={dragging}
      description={
        <span className="task-activity-tip-rows">
          {dueText !== '' && (
            <span className="task-activity-tip-row">
              <CalendarBlank size={12} aria-hidden="true" />
              {dueText}
            </span>
          )}
          <span className="task-activity-tip-row">
            {STATUS_ICON[task.status]}
            {TASK_STATUS[task.status].label}
          </span>
          <span className="task-activity-tip-row">
            <TaskPriorityIcon priority={task.priority} size={12} />
            {TASK_PRIORITY[task.priority].label}
          </span>
          {assigneeName && task.assigneeId && (
            <span className="task-activity-tip-row">
              <Avatar src={assignee?.avatarUrl ?? null} name={assigneeName} email={assignee?.email} id={task.assigneeId} size={14} alt="" />
              {assigneeName}
            </span>
          )}
          {parentTitle && (
            <span className="task-activity-tip-row">
              <GitBranch size={12} aria-hidden="true" />
              {t('board.cal.subtaskOf', { defaultValue: 'subtask of {{parent}}', parent: parentTitle })}
            </span>
          )}
        </span>
      }
    >
    <button
      ref={ref}
      type="button"
      className={`due-cal-task due-cal-task-${tone}${isDone ? ' due-cal-task-done' : ''}${dragging ? ' dragging' : ''} ${classNameExtra ?? ''}`}
      draggable={canEdit}
      aria-label={ariaLabel}
      aria-keyshortcuts={canMove ? 'm Enter' : 'Enter'}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onOpenTask?.(task.id);
      }}
      onKeyDown={(e) => {
        if (canMove && (e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          onMove!(task.id);
        }
      }}
      onDragStart={(e) => {
        if (!canEdit) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        setDragging(true);
        e.currentTarget.blur();
        onDragState?.(task.id);
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        if (onDragOffset) {
          if (segmentStart && span && span > 1) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const colWidth = rect.width / span;
            // Guard colWidth 0 (elemen tersembunyi/jsdom tanpa layout) agar
            // tak menghasilkan NaN yang meruntuhkan addDaysIso.
            const x = (e.clientX || 0) - rect.left;
            const offsetInSegment = colWidth > 0 ? Math.max(0, Math.min(span - 1, Math.floor(x / colWidth))) : 0;
            const grabDate = addDaysIso(segmentStart, offsetInSegment);
            onDragOffset(0, grabDate);
          } else if (segmentStart) {
            onDragOffset(0, segmentStart);
          } else {
            onDragOffset(0, task.startDate ?? task.dueDate ?? null);
          }
        }
      }}
      onDragEnd={() => { setDragging(false); onDragState?.(null); }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, opacity: 0.9 }}>
        {parentTitle && <GitBranch size={12} weight="bold" style={{ marginRight: 2 }} />}
        {STATUS_ICON[task.status]}
      </span>
      <span className="due-cal-task-title">{task.title}</span>
      <GCalSyncedMark taskId={task.id} projectId={project?.projectId} />
      {assigneeName && task.assigneeId && (
        <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>
          <Avatar src={assignee?.avatarUrl ?? null} name={assigneeName} email={assignee?.email} id={task.assigneeId} size={16} alt="" />
        </span>
      )}
    </button>
    </Tooltip>
  );
}

const MAX_VISIBLE = 3;
const MAX_VISIBLE_MOBILE = 2;

export function DueCalendar({ onOpenTask, onQuickCreate, taskFilter, onTouchDrop, hideCompleted = false, tasks: tasksProp, readOnly = false, members, unreadIds }: DueCalendarProps) {
  const project = useProjectSafe();
  const state = project?.state ?? null;
  const dispatch = project?.dispatch;
  const canEdit = !readOnly && (project?.canEdit ?? false);
  // External `tasks` (public view) wins; fallback to provider state for BoardPage.
  const allTasks: Task[] = tasksProp ?? state?.tasks ?? [];
  const canQuickCreate = !readOnly && !!onQuickCreate;
  const isMobileCal = useMediaQuery('(max-width: 640px)');
  // Mobile samakan mode lain: tanpa drag & drop (tap kartu buka TaskModal).
  const effectiveTouchDrop = readOnly || isMobileCal ? undefined : onTouchDrop;
  const [anchor, setAnchor] = useState(todayIso());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const monthLabelRef = useRef<HTMLButtonElement>(null);
  const [weekMode, setWeekMode] = useState(false);

  const [focused, setFocused] = useState<string | null>(null);
  // C6/H3-mobile: 2 chips per cell on ≤640px, 3 on desktop. Coarse pointers
  // get an explicit + button instead of whole-cell tap-to-create.
  // (isMobileCal/isCoarse dideklarasi di atas dekat effectiveTouchDrop.)
  // P2 mini grid: tap selects a date, task list renders below the grid.
  const [mobileSelected, setMobileSelected] = useState<string | null>(null);
  const maxVisible = isMobileCal ? MAX_VISIBLE_MOBILE : MAX_VISIBLE;
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [stripCollapsed, setStripCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("due-cal-strip-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("due-cal-strip-collapsed", stripCollapsed ? "1" : "0"); } catch {}
  }, [stripCollapsed]);
  const dragGrabDateRef = useRef<string | null>(null);
  // Highlight drop: id task yang sedang di-drag (ref, dibaca dragover) +
  // tanggal cell hover (state, memicu render). Dibersihkan saat drop/leave/dragEnd.
  const dragTaskIdRef = useRef<string | null>(null);
  const [ghostDate, setGhostDate] = useState<string | null>(null);
  // Flag render agar grid tahu drag aktif (untuk kelas is-dragging).
  const [dragActive, setDragActive] = useState(false);
  const handleChipDragState = useCallback((taskId: string | null) => {
    dragTaskIdRef.current = taskId;
    setDragActive(taskId !== null);
    if (taskId === null) setGhostDate(null);
  }, []);
  // Rentang highlight: cermin moveToDate agar preview == hasil drop
  // (durasi dipertahankan, offset grab diperhitungkan). String ISO YYYY-MM-DD
  // aman dibanding leksikografis.
  const ghostTask =
    dragTaskIdRef.current !== null ? allTasks.find((t) => t.id === dragTaskIdRef.current) : undefined;
  let ghostStart: string | null = null;
  let ghostEnd: string | null = null;
  if (ghostDate !== null) {
    if (ghostTask?.startDate && ghostTask?.dueDate) {
      const duration = Math.max(
        0,
        Math.round((parseIso(ghostTask.dueDate).getTime() - parseIso(ghostTask.startDate).getTime()) / 86400000),
      );
      const grab = dragGrabDateRef.current;
      const offset =
        grab !== null
          ? Math.max(0, Math.round((parseIso(grab).getTime() - parseIso(ghostTask.startDate).getTime()) / 86400000))
          : 0;
      ghostStart = addDaysIso(ghostDate, -offset);
      ghostEnd = addDaysIso(ghostStart, duration);
    } else {
      ghostStart = ghostEnd = ghostDate;
    }
  }
  const [moveTaskId, setMoveTaskId] = useState<string | null>(null);
  const [moveDateDraft, setMoveDateDraft] = useState<string>('');
  const [rangeBlocked, setRangeBlocked] = useState(false);
  const rangeTimer = useRef<number | undefined>(undefined);
  const flashRangeBlocked = useCallback(() => {
    setRangeBlocked(true);
    window.clearTimeout(rangeTimer.current);
    rangeTimer.current = window.setTimeout(() => setRangeBlocked(false), 4000);
  }, []);
  useEffect(() => () => window.clearTimeout(rangeTimer.current), []);
  const { t } = useTranslation('tracker');

  const anchorDate = parseIso(anchor);
  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth();
  const today = todayIso();

  const weeks = useMemo(() => visibleMonthMatrix(year, month), [year, month]);
  const flatCells = useMemo(() => (weekMode ? weekDays(anchor) : weeks.flat()), [weekMode, anchor, weeks]);
  const cells = flatCells;

  const unscheduled = useMemo(
    () =>
      allTasks
        .filter((t) => !t.dueDate && !(hideCompleted && t.status === 'done') && (!taskFilter || taskFilter(t)))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [allTasks, hideCompleted, taskFilter],
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
    const visibleEnd = weekMode ? weekDays(anchor)[6]! : weeks[weeks.length - 1]![6]!;
    for (const task of allTasks) {
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
  }, [allTasks, hideCompleted, taskFilter, weeks, weekMode, anchor, dateToPos]);

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
      const overflow = Math.max(0, totalLanes - maxVisible);
      result.set(row, { segments: segs as any, lanes: lanes as any, overflow } as any);
    }
    return result;
  }, [spanningSegments, maxVisible]);

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
        // if not expanded and would be >= maxVisible, skip (will be in +N)
        if (!isExpanded && wouldBeLane >= maxVisible) {
          // skip rendering this segment, it will be counted in more
          continue;
        }
        if (lane === lanes.length) lanes.push(seg.colStart + seg.span - 1);
        else lanes[lane] = seg.colStart + seg.span - 1;
        result.push({ ...seg, lane });
      }
    }
    return result;
  }, [spanningSegments, rowGroups, expandedRows, maxVisible]);

  // Row heights: daynum (28) + lanes (26 each) + footer slot (gap + 22px
  // text-button + bottom pad) agar tombol +N lagi / ciutkan muat di dalam cell.
  // C6 mobile: empty rows collapse to 72px; overlay tak dirender di mobile
  // sehingga formula footer hanya untuk desktop.
  const FOOTER_GAP = 6;
  const FOOTER_H = 22;
  const FOOTER_PAD = 8;
  const rowHeights = useMemo(() => {
    const emptyH = isMobileCal ? 72 : 112;
    const collapsedH = isMobileCal
      ? 28 + MAX_VISIBLE_MOBILE * 26 + 28
      : 28 + MAX_VISIBLE * 26 + FOOTER_GAP + FOOTER_H + FOOTER_PAD;
    const heights: number[] = [];
    const numRows = weekMode ? 1 : weeks.length;
    for (let r = 0; r < numRows; r++) {
      const group = rowGroups.get(r);
      if (!group) {
        heights.push(emptyH);
        continue;
      }
      const totalLanes = (group as any).lanes?.length ?? 0;
      const isRowExpanded = expandedRows.has(r) || Array.from(expandedCells).some(d => {
        const pos = dateToPos.get(d);
        return pos?.row === r;
      });
      const footerExtra = isMobileCal ? 28 : FOOTER_GAP + FOOTER_H + FOOTER_PAD;
      const needed = isRowExpanded ? Math.max(collapsedH, 28 + totalLanes * 26 + footerExtra) : collapsedH;
      heights.push(needed);
    }
    return heights;
  }, [rowGroups, expandedRows, expandedCells, weekMode, weeks.length, dateToPos, isMobileCal]);

  // P2 mini grid: tasks per visible date (incl. multi-day spans) for dots + list.
  // Sorted urgent-first via TASK_PRIORITY_ORDER agar warna prioritas konsisten.
  const mobileDateTasks = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const date of cells) map.set(date, []);
    for (const task of allTasks) {
      if (!task.dueDate) continue;
      if (hideCompleted && task.status === 'done') continue;
      if (taskFilter && !taskFilter(task)) continue;
      const rawStart = task.startDate && task.startDate <= task.dueDate ? task.startDate : task.dueDate;
      const rawEnd = task.dueDate;
      let cur = rawStart;
      let guard = 0;
      while (cur <= rawEnd && guard < 62) {
        const bucket = map.get(cur);
        if (bucket) bucket.push(task);
        // Berhenti saat keluar rentang visible (hindari loop panjang).
        if (cur >= rawEnd) break;
        cur = addDaysIso(cur, 1);
        guard += 1;
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const ra = TASK_PRIORITY_ORDER.indexOf(a.priority);
        const rb = TASK_PRIORITY_ORDER.indexOf(b.priority);
        if (rb !== ra) return rb - ra;
        return a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [allTasks, hideCompleted, taskFilter, cells]);

  const mobileSelectedDate = mobileSelected ?? focused ?? today;
  const mobileSelectedTasks: Task[] = mobileDateTasks.get(mobileSelectedDate) ?? [];

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
      if (readOnly || !canEdit || !dispatch) return;
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      if (date === null) {
        if (task.dueDate !== null) dispatch({ type: 'task/update', id: taskId, patch: { dueDate: null } });
        dragGrabDateRef.current = null;
        return;
      }
      // Subtask tidak boleh keluar rentang parent (tolak drop + pesan).
      const parent = task.parentTaskId ? allTasks.find((t) => t.id === task.parentTaskId) : undefined;
      const wouldViolate = (start: string | null | undefined, due: string | null | undefined) =>
        parent ? subRangeOutsideParent({ startDate: start ?? null, dueDate: due ?? null }, parent) !== null : false;
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
        if (wouldViolate(newStart, newDue)) {
          flashRangeBlocked();
          return;
        }
        if (task.dueDate !== newDue || task.startDate !== newStart) {
          dispatch({ type: 'task/update', id: taskId, patch: { dueDate: newDue, startDate: newStart } });
        }
      } else {
        dragGrabDateRef.current = null;
        if (wouldViolate(task.startDate, date)) {
          flashRangeBlocked();
          return;
        }
        if (task.dueDate !== date) dispatch({ type: 'task/update', id: taskId, patch: { dueDate: date } });
      }
    },
    [readOnly, canEdit, allTasks, dispatch, flashRangeBlocked],
  );

  const openMove = useCallback((taskId: string) => {
    if (readOnly || !canEdit) return;
    const t = allTasks.find((x) => x.id === taskId);
    setMoveTaskId(taskId);
    setMoveDateDraft(t?.dueDate ?? '');
  }, [readOnly, canEdit, allTasks]);

  const confirmMove = () => {
    if (!moveTaskId) return;
    const val = moveDateDraft.trim();
    if (val === '') moveToDate(moveTaskId, null);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) moveToDate(moveTaskId, val);
    setMoveTaskId(null);
  };

  useEffect(() => {
    if (readOnly || !canEdit) return;
    const unregisters = cells.map((date) =>
      registerDrop(`date:${date}`, (id) => moveToDate(id, date)),
    );
    unregisters.push(registerDrop('clear', (id) => moveToDate(id, null)));
    return () => {
      for (const unregister of unregisters) unregister();
    };
  }, [cells, moveToDate, readOnly, canEdit]);

  const onDrop = (date: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setGhostDate(null);
    setDragActive(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveToDate(id, date);
  };

  const onClearDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setGhostDate(null);
    setDragActive(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveToDate(id, null);
  };

  const cell = (date: string) => {
    const dimmed = !weekMode && !inMonth(date, year, month);
    const isToday = date === today;
    const dayLabel = formatDayAriaLabel(date);
    // readOnly: no quick-create at all (cell click only moves focus).
    // Tanpa tombol + per-cell di semua versi: desktop pakai klik cell,
    // mobile pakai tombol Task di bawah daftar.
    // Mobile tanpa drag & drop samakan mode lain (tap buka TaskModal).
    const canDrop = !readOnly && canEdit && !isMobileCal;
    // P2 mini grid: dots + selected state. Tap selects (list below), tidak quick-create.
    const miniTasks: Task[] = isMobileCal ? (mobileDateTasks.get(date) ?? []) : [];
    const isMiniSelected = isMobileCal && mobileSelectedDate === date;
    const isCellSelected = isMobileCal ? isMiniSelected : focused === date;
    const cellAriaLabel = isMobileCal
      ? `${dayLabel}, ${t('board.cal.daySummary', { count: miniTasks.length })}`
      : dayLabel;
    const handleMiniSelect = (): void => {
      setFocused(date);
      setMobileSelected(date);
    };
    return (
      <div
        key={date}
        role="gridcell"
        aria-label={cellAriaLabel}
        aria-selected={isCellSelected}
        aria-keyshortcuts="ArrowRight ArrowLeft ArrowDown ArrowUp PageDown PageUp Enter"
        className={`due-cal-cell${dimmed ? ' due-cal-dim' : ''}${isToday ? ' due-cal-today' : ''}${isMiniSelected ? ' due-cal-mini-selected' : ''}${!isMobileCal && ghostStart !== null && ghostEnd !== null && date >= ghostStart && date <= ghostEnd ? ' due-cal-cell--drop-active' : ''}`}
        data-date={date}
        {...(canDrop ? { 'data-drop-key': `date:${date}` } : {})}
        tabIndex={isCellSelected ? 0 : -1}
        onFocus={() => {
          setFocused(date);
          if (isMobileCal) setMobileSelected(date);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') moveFocus(1);
          else if (e.key === 'ArrowLeft') moveFocus(-1);
          else if (e.key === 'ArrowDown') moveFocus(7);
          else if (e.key === 'ArrowUp') moveFocus(-7);
          else if (e.key === 'PageDown') nav(1);
          else if (e.key === 'PageUp') nav(-1);
          else if (e.key === 'Enter') {
            if (isMobileCal) handleMiniSelect();
            else if (canQuickCreate) onQuickCreate?.(date);
          }
        }}
        onClick={isMobileCal ? handleMiniSelect : canQuickCreate ? () => onQuickCreate?.(date) : () => setFocused(date)}
        onDragOver={canDrop ? (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragTaskIdRef.current !== null && ghostDate !== date) setGhostDate(date);
        } : undefined}
        onDrop={canDrop ? onDrop(date) : undefined}
        onDragLeave={canDrop ? (e) => {
          // Hanya clear saat benar-benar keluar cell (bukan pindah antar child).
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setGhostDate(null);
        } : undefined}
      >
        <span className="due-cal-daynum">{date.slice(8)}</span>
        {isMobileCal && miniTasks.length > 0 && (
          <span className="due-cal-mini-dots" aria-hidden="true">
            {miniTasks.slice(0, 3).map((task) => (
              <span key={task.id} className={`due-cal-mini-dot due-cal-mini-dot-${task.priority}`} />
            ))}
            {miniTasks.length > 3 && (
              <span className="due-cal-mini-more">+{miniTasks.length - 3}</span>
            )}
          </span>
        )}
      </div>
    );
  };

  const gridRowTemplate = weekMode
    ? `28px ${rowHeights[0]}px`
    : `28px ${rowHeights.map((h) => `${h}px`).join(' ')}`;

  return (
    <div className={`due-cal${isMobileCal ? ' due-cal--mobile' : ''}`}>
      <div className="due-cal-toolbar">
        <div className="due-cal-nav">
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('board.cal.prevMonth')} onClick={() => nav(-1)}>
            <CaretLeft size={14} aria-hidden="true" />
          </button>
          <button
            ref={monthLabelRef}
            type="button"
            className="due-cal-month-name due-cal-month-trigger"
            aria-haspopup="dialog"
            aria-expanded={monthPickerOpen}
            aria-label={t('board.cal.monthPicker.pickMonth')}
            title={t('board.cal.monthPicker.pickMonth')}
            onClick={() => setMonthPickerOpen((v) => !v)}
          >
            {monthName(year, month)}
          </button>
          {monthPickerOpen && (
            <MonthPicker
              id="due-cal-month-picker"
              anchorEl={monthLabelRef.current}
              viewYear={year}
              viewMonth={month}
              onPick={(y, m) => {
                setAnchor(isoOf(new Date(Date.UTC(y, m, 1))));
                setMonthPickerOpen(false);
                monthLabelRef.current?.focus();
              }}
              onClose={() => {
                setMonthPickerOpen(false);
                monthLabelRef.current?.focus();
              }}
            />
          )}
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('board.cal.nextMonth')} onClick={() => nav(1)}>
            <CaretRight size={14} aria-hidden="true" />
          </button>
          {!isMobileCal && (
            <button type="button" className="btn btn-ghost btn-sm due-cal-today-btn" onClick={() => setAnchor(today)}>
              {t('board.cal.today')}
            </button>
          )}
        </div>
        {!isMobileCal && (
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
        )}
      </div>

      {rangeBlocked && (
        <div style={{ padding: '0 0 8px' }}>
          <InlineError>
            {t('board.cal.subRangeBlocked', { defaultValue: 'Subtask date is outside the parent range.' })}
          </InlineError>
        </div>
      )}

      <div className="due-cal-body">
        <div className={`due-cal-grid due-cal-${weekMode ? 'week' : 'month'}${dragActive ? ' is-dragging' : ''}`} role="grid" aria-label={t('board.cal.month')} style={{ position: 'relative', gridTemplateRows: gridRowTemplate }}>
          <div role="row" style={{ display: 'contents' }}>
            {WEEKDAY_LABELS.map((d, i) => (
              <div
                key={d}
                role="columnheader"
                aria-colindex={i + 1}
                {...({ scope: 'col' } as React.TdHTMLAttributes<HTMLDivElement>)}
                className="due-cal-head"
              >
                {t(`board.cal.weekday.${d.toLowerCase()}`)}
              </div>
            ))}
          </div>
          {weekMode ? (
            <div role="row" style={{ display: 'contents' }}>
              {cells.map(cell)}
            </div>
          ) : (
            weeks.map((_, r) => (
              <div key={r} role="row" style={{ display: 'contents' }}>
                {cells.slice(r * 7, r * 7 + 7).map((date) => cell(date))}
              </div>
            ))
          )}
        {!isMobileCal && (
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
              members={members}
              onOpenTask={onOpenTask}
              onTouchDrop={effectiveTouchDrop}
              onDragOffset={readOnly ? undefined : (_, grabDate) => { dragGrabDateRef.current = grabDate; }}
              onMove={readOnly ? undefined : openMove}
              onDragState={readOnly ? undefined : handleChipDragState}
              readOnly={readOnly}
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
          if (covering <= maxVisible) return null;
          const pos = dateToPos.get(date);
          if (!pos) return null;
          const row = pos.row;
          const col = pos.col;
          const isExpanded = expandedCells.has(date) || expandedRows.has(row);
          if (isExpanded) return null;
          const overflow = covering - maxVisible;
          const rowTop = rowHeights.slice(0, row).reduce((a,b)=>a+b+1,0);
          const top = rowTop + 28 + maxVisible * 26 + FOOTER_GAP; // slot footer di dalam cell
          const left = `calc(${col} * ((100% - 6px) / 7 + 1px) + 4px)`;
          const width = `calc((100% - 6px) / 7 - 8px)`;
          return (
            <button
              key={`more-${date}`}
              type="button"
              className="due-cal-more"
              data-drop-key={`date:${date}`}
              style={{
                position: 'absolute',
                top: `${top}px`,
                left,
                width,
                zIndex: 2,
                pointerEvents: 'auto',
              }}
              onDragOver={(e) => {
                // Backup bila pointer-events CSS lolos: teruskan ke cell date ini.
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                if (dragTaskIdRef.current !== null && ghostDate !== date) setGhostDate(date);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setGhostDate(null);
                setDragActive(false);
                const id = e.dataTransfer.getData('text/plain');
                if (id) moveToDate(id, date);
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
        {/* tombol ciutkan per baris: 1 tombol per row di kolom expanded paling kiri,
            selalu di slot footer dalam cell (tidak mepet tepi / keluar). */}
        {Array.from(expandedRows).map(row => {
          const group = rowGroups.get(row) as any;
          const total = group?.lanes.length ?? 0;
          const datesInRow = Array.from(expandedCells).filter(d => dateToPos.get(d)?.row === row);
          const anchorDate = datesInRow.sort()[0] ?? cells[row * 7] ?? '';
          const anchorPos = dateToPos.get(anchorDate);
          const col = anchorPos?.col ?? 0;
          const top = rowHeights.slice(0, row).reduce((a,b)=>a+b+1,0) + 28 + total * 26 + FOOTER_GAP;
          const left = `calc(${col} * ((100% - 6px) / 7 + 1px) + 4px)`;
          const width = `calc((100% - 6px) / 7 - 8px)`;
          return (
            <button
              key={`less-row-${row}`}
              type="button"
              className="due-cal-more"
              data-drop-key={anchorDate ? `date:${anchorDate}` : undefined}
              style={{
                position: 'absolute',
                top: `${top}px`,
                left,
                width,
                zIndex: 2,
                pointerEvents: 'auto',
              }}
              onDragOver={anchorDate ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                if (dragTaskIdRef.current !== null && ghostDate !== anchorDate) setGhostDate(anchorDate);
              } : undefined}
              onDrop={anchorDate ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                setGhostDate(null);
                setDragActive(false);
                const id = e.dataTransfer.getData('text/plain');
                if (id) moveToDate(id, anchorDate);
              } : undefined}
              onClick={(e) => {
                e.stopPropagation();
                // Collapse seluruh baris: buang semua expandedCells di row ini.
                setExpandedCells(s => {
                  const n = new Set(s);
                  for (const d of datesInRow) n.delete(d);
                  return n;
                });
                setExpandedRows(s => {
                  const n = new Set(s);
                  n.delete(row);
                  return n;
                });
              }}
            >
              ciutkan
            </button>
          );
        })}
          </div>
        </div>
        )}
        </div>

        {isMobileCal && (
          <section
            className="due-cal-mini-list"
            aria-label={`${formatDayAriaLabel(mobileSelectedDate)} — ${t('board.cal.daySummary', { count: mobileSelectedTasks.length })}`}
          >
            <div className="due-cal-mini-list-head">
              <span className="due-cal-mini-list-title">{formatDayAriaLabel(mobileSelectedDate)}</span>
              <span className="due-cal-mini-list-count tabular">
                {t('board.cal.daySummary', { count: mobileSelectedTasks.length })}
              </span>
            </div>
            {mobileSelectedTasks.length === 0 ? (
              <p className="due-cal-mini-empty">{t('board.cal.emptyTitle')}</p>
            ) : project ? (
              <ul className="due-cal-mini-cards">
                {mobileSelectedTasks.map((task) => (
                  <li key={task.id}>
                    <TaskCard
                      task={task}
                      onOpen={(id) => onOpenTask?.(id)}
                      members={members}
                      showStatus
                      showMilestone
                      unread={unreadIds?.has(task.id)}
                      onTouchDrop={undefined}
                      dragEnabled={false}
                      density="full"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="due-cal-mini-cards">
                {mobileSelectedTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className={`due-cal-mini-card due-cal-mini-card-${task.priority}`}
                      onClick={() => onOpenTask?.(task.id)}
                      aria-label={`${task.title} — ${dueLabel(task.dueDate, today)}`}
                      style={task.parentTaskId ? { paddingLeft: 16, borderLeft: '1px solid var(--border-hairline)' } : undefined}
                    >
                      {task.parentTaskId && <GitBranch size={11} aria-hidden="true" style={{ flexShrink: 0 }} />}
                      <span className="due-cal-mini-card-title">{task.title}</span>
                      {task.dueDate && (
                        <span className="due-cal-mini-card-meta tabular">{dueLabel(task.dueDate, today)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canQuickCreate && (
              <Button
                variant="primary"
                size="md"
                className="kanban-add-btn due-cal-mini-add"
                leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
                onClick={() => onQuickCreate?.(mobileSelectedDate)}
              >
                {t('board.cal.addTaskShort', { defaultValue: 'Task' })}
              </Button>
            )}
          </section>
        )}

      <aside
        id="due-cal-strip"
        className={`due-cal-strip ${stripCollapsed ? 'is-collapsed' : ''}`}
        {...(!readOnly && canEdit && !isMobileCal ? { 'data-drop-key': 'clear' } : {})}
        onDragOver={!readOnly && canEdit && !isMobileCal ? (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        } : undefined}
        onDrop={!readOnly && canEdit && !isMobileCal ? onClearDrop : undefined}
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
        {!stripCollapsed && unscheduled.length === 0 && (
          <span className="due-cal-strip-empty">
            {isMobileCal ? t('board.cal.emptyTitle') : t('board.cal.stripEmpty')}
          </span>
        )}
        {!stripCollapsed && isMobileCal && project && unscheduled.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={(id) => onOpenTask?.(id)}
            members={members}
            showStatus
            showMilestone
            unread={unreadIds?.has(task.id)}
            onTouchDrop={undefined}
            dragEnabled={false}
            density="full"
          />
        ))}
        {!stripCollapsed && (!isMobileCal || !project) && unscheduled.map((t) => (
          <CalTaskChip key={t.id} task={t} members={members} onOpenTask={onOpenTask} onTouchDrop={effectiveTouchDrop} onDragOffset={readOnly || isMobileCal ? undefined : (_, grabDate) => { dragGrabDateRef.current = grabDate; }} onMove={readOnly || isMobileCal ? undefined : openMove} onDragState={readOnly || isMobileCal ? undefined : handleChipDragState} readOnly={readOnly || isMobileCal} />
        ))}
      </aside>
      </div>
      {!readOnly && (
      <Modal
        open={moveTaskId !== null}
        title={t('board.cal.moveTitle', { defaultValue: 'Move task' })}
        onClose={() => setMoveTaskId(null)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setMoveTaskId(null)}>{t('common:action.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button variant="primary" size="md" leftIcon={<Check size={14} weight="bold" aria-hidden="true" />} onClick={confirmMove}>{t('common:action.save', { defaultValue: 'Save' })}</Button>
          </>
        }
      >
        <Input
          id="move-date-input"
          label={t('board.cal.moveLabel', { defaultValue: 'Due date (YYYY-MM-DD, empty to clear)' })}
          type="date"
          value={moveDateDraft}
          onChange={(e) => setMoveDateDraft(e.target.value)}
          helper={t('board.cal.moveHint', { defaultValue: 'Leave empty to move to No date. Press M on a chip to open this dialog.' })}
        />
      </Modal>
      )}
    </div>
  );
}
