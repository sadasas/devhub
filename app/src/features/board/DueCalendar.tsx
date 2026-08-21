import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarBlank, CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import { addDaysIso, inMonth, isoOf, monthMatrix, monthName, parseIso, weekDays } from '../../lib/calendar';
import { dueBucket, dueLabel, dueTone, todayIso } from '../../lib/due-dates';
import { TASK_PRIORITY, TASK_STATUS } from '../../lib/labels';
import { startLabel } from '../../lib/start-dates';
import { formatDate, shortId } from '../../lib/utils';
import type { Task } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { registerDrop } from '../../lib/drop-registry';
import { useTouchDrag } from '../../hooks/useTouchDrag';

interface DueCalendarProps {
  onOpenTask: (taskId: string) => void;
  onQuickCreate: (dueDate: string) => void;
  taskFilter?: (t: Task) => boolean;
  onTouchDrop?: (taskId: string, dropKey: string | null) => void;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MAX_CHIPS_PER_CELL = 3;

const STATUS_ORDER: Task['status'][] = ['todo', 'inProgress', 'review', 'done'];

const dayHeader = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

interface CalTaskChipProps {
  task: Task;
  date?: string;
  onOpenTask: (taskId: string) => void;
  onTouchDrop?: (taskId: string, dropKey: string | null) => void;
}

function CalTaskChip({ task, date, onOpenTask, onTouchDrop }: CalTaskChipProps) {
  const { canEdit } = useProject();
  const ref = useRef<HTMLButtonElement>(null);
  const handleTouchDrop = useCallback(
    (dropKey: string | null) => onTouchDrop?.(task.id, dropKey),
    [task.id, onTouchDrop],
  );
  useTouchDrag(ref, { enabled: canEdit && !!onTouchDrop, onDrop: handleTouchDrop });
  const title = date ? `${task.title} · ${dueLabel(date, todayIso())}` : undefined;
  const dotTone = date ? dueTone(dueBucket(date, todayIso())) : 'neutral';
  return (
    <button
      ref={ref}
      type="button"
      className="due-cal-task"
      draggable={canEdit}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onOpenTask(task.id);
      }}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <span className={`due-cal-dot due-cal-dot-${dotTone}`} aria-hidden="true" />
      <span className="due-cal-task-title">{task.title}</span>
    </button>
  );
}

export function DueCalendar({ onOpenTask, onQuickCreate, taskFilter, onTouchDrop }: DueCalendarProps) {
  const { state, canEdit, dispatch } = useProject();
  const [anchor, setAnchor] = useState(todayIso());
  const [weekMode, setWeekMode] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [dayPopup, setDayPopup] = useState<string | null>(null);

  const anchorDate = parseIso(anchor);
  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth();
  const today = todayIso();

  const cells = useMemo(() => (weekMode ? weekDays(anchor) : monthMatrix(year, month).flat()), [weekMode, anchor, year, month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of state?.tasks ?? []) {
      if (!t.dueDate) continue;
      if (hideCompleted && t.status === 'done') continue;
      if (taskFilter && !taskFilter(t)) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [state, hideCompleted, taskFilter]);

  const milestonesByDay = useMemo(() => {
    const map = new Map<string, { id: string; name: string; version: string | null }[]>();
    for (const m of state?.milestones ?? []) {
      if (!m.targetDate) continue;
      const list = map.get(m.targetDate) ?? [];
      list.push({ id: m.id, name: m.name, version: m.version ?? null });
      map.set(m.targetDate, list);
    }
    return map;
  }, [state]);

  const unscheduled = useMemo(
    () =>
      (state?.tasks ?? [])
        .filter((t) => !t.dueDate && !(hideCompleted && t.status === 'done') && (!taskFilter || taskFilter(t)))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [state, hideCompleted, taskFilter],
  );

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
      if (task && task.dueDate !== date) {
        dispatch({ type: 'task/update', id: taskId, patch: { dueDate: date } });
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
    const tasks = tasksByDay.get(date) ?? [];
    const milestones = milestonesByDay.get(date) ?? [];
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
          else if (e.key === 'Enter') setDayPopup(date);
        }}
        onClick={() => setDayPopup(date)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={onDrop(date)}
      >
        <span className="due-cal-daynum">{date.slice(8)}</span>
        {milestones.length > 0 && (
          <span className="due-cal-milestones">
            {milestones.map((m) => (
              <span
                key={m.id}
                className="due-cal-milestone"
                title={`${m.name}${m.version ? ` ${m.version}` : ''}`}
              >
                ◆
              </span>
            ))}
          </span>
        )}
        {tasks.slice(0, MAX_CHIPS_PER_CELL).map((t) => (
          <CalTaskChip key={t.id} task={t} date={date} onOpenTask={onOpenTask} onTouchDrop={onTouchDrop} />
        ))}
        {tasks.length > MAX_CHIPS_PER_CELL && (
          <button
            type="button"
            className="due-cal-more"
            title={`${tasks.length} tasks due — open day list`}
            onClick={(e) => {
              e.stopPropagation();
              setDayPopup(date);
            }}
          >
            +{tasks.length - MAX_CHIPS_PER_CELL} more
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="due-cal">
      <div className="due-cal-toolbar">
        <div className="due-cal-nav">
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Previous month" onClick={() => nav(-1)}>
            <CaretLeft size={14} aria-hidden="true" />
          </button>
          <span className="due-cal-month-name">{monthName(year, month)}</span>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Next month" onClick={() => nav(1)}>
            <CaretRight size={14} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAnchor(today)}>
            Today
          </button>
        </div>
        <div className="sub-tabs" role="tablist" aria-label="Calendar view">
          <button
            type="button"
            role="tab"
            className={`sub-tab ${!weekMode ? 'sub-tab-active' : ''}`}
            aria-selected={!weekMode}
            onClick={() => setWeekMode(false)}
          >
            Month
          </button>
          <button
            type="button"
            role="tab"
            className={`sub-tab ${weekMode ? 'sub-tab-active' : ''}`}
            aria-selected={weekMode}
            onClick={() => setWeekMode(true)}
          >
            Week
          </button>
        </div>
        <label className="due-cal-hide">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />
          Hide completed
        </label>
      </div>

      <div className={`due-cal-grid due-cal-${weekMode ? 'week' : 'month'}`}>
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="due-cal-head">
            {d}
          </div>
        ))}
        {cells.map(cell)}
      </div>

      <div
        className="due-cal-strip"
        data-drop-key="clear"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={onClearDrop}
      >
        <span className="due-cal-strip-label">No date</span>
        {unscheduled.length === 0 && <span className="due-cal-strip-empty">Drop tasks here to clear their due date</span>}
        {unscheduled.map((t) => (
          <CalTaskChip key={t.id} task={t} onOpenTask={onOpenTask} onTouchDrop={onTouchDrop} />
        ))}
      </div>

      <Modal
        open={dayPopup !== null}
        title={dayPopup ? dayHeader.format(parseIso(dayPopup)) : ''}
        onClose={() => setDayPopup(null)}
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDayPopup(null)}>
              Close
            </Button>
            {canEdit && dayPopup && (
              <Button
                variant="primary"
                leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />}
                onClick={() => {
                  onQuickCreate(dayPopup);
                  setDayPopup(null);
                }}
              >
                Add task
              </Button>
            )}
          </>
        }
      >
        {dayPopup &&
          (() => {
            const dayTasks = (tasksByDay.get(dayPopup) ?? []).slice().sort((a, b) => {
              const order = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
              if (order !== 0) return order;
              return a.title.localeCompare(b.title);
            });
            const dayMilestones = milestonesByDay.get(dayPopup) ?? [];
            const done = dayTasks.filter((t) => t.status === 'done').length;
            const milestoneChips =
              dayMilestones.length > 0 ? (
                <div className="detail-chips mb-12">
                  {dayMilestones.map((m) => (
                    <span
                      key={m.id}
                      className="task-label"
                      title={`${m.name}${m.version ? ` ${m.version}` : ''}`}
                    >
                      ◆ {m.name}
                    </span>
                  ))}
                </div>
              ) : null;
            if (dayTasks.length === 0) {
              return (
                <>
                  {milestoneChips}
                  <EmptyState
                    icon={<CalendarBlank size={22} />}
                    title="No tasks due"
                    description="Tasks dropped on this day appear here."
                  />
                </>
              );
            }
            return (
              <>
                <h4 className="detail-subtitle">
                  {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
                  {done > 0 ? ` · ${done} done` : ''}
                </h4>
                {milestoneChips}
                <div className="due-day-list">
                  {dayTasks.map((t) => {
                    const milestone = t.milestoneId
                      ? (state?.milestones.find((m) => m.id === t.milestoneId) ?? null)
                      : null;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="due-day-row"
                        onClick={() => {
                          onOpenTask(t.id);
                          setDayPopup(null);
                        }}
                      >
                        <span className="due-day-row-main">
                          <span className="due-day-row-title">
                            <Badge tone={TASK_PRIORITY[t.priority].tone}>
                              {TASK_PRIORITY[t.priority].label}
                            </Badge>
                            <span className="row-title-text">{t.title}</span>
                          </span>
                          <span className="due-day-row-meta">
                            {t.startDate && (
                              <span className="task-start" title={formatDate(t.startDate)}>
                                {startLabel(t.startDate)}
                              </span>
                            )}
                            {milestone && <span className="task-label">{milestone.name}</span>}
                            {t.estimate != null && <span className="tabular">{t.estimate}h</span>}
                            <span className="due-day-row-id">#{shortId(t.id)}</span>
                          </span>
                        </span>
                        <span className="due-day-row-side">
                          <Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
      </Modal>
    </div>
  );
}