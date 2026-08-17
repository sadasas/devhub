import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import { addDaysIso, inMonth, isoOf, monthMatrix, monthName, parseIso, weekDays } from '../../lib/calendar';
import { dueBucket, dueLabel, dueTone, todayIso } from '../../lib/due-dates';
import { TASK_STATUS } from '../../lib/labels';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';

interface DueCalendarProps {
  onOpenTask: (taskId: string) => void;
  onQuickCreate: (dueDate: string) => void;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MAX_CHIPS_PER_CELL = 3;

const dayHeader = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export function DueCalendar({ onOpenTask, onQuickCreate }: DueCalendarProps) {
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
    const map = new Map<string, { id: string; title: string; status: string }[]>();
    for (const t of state?.tasks ?? []) {
      if (!t.dueDate) continue;
      if (hideCompleted && t.status === 'done') continue;
      const list = map.get(t.dueDate) ?? [];
      list.push({ id: t.id, title: t.title, status: t.status });
      map.set(t.dueDate, list);
    }
    return map;
  }, [state, hideCompleted]);

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
        .filter((t) => !t.dueDate && !(hideCompleted && t.status === 'done'))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [state, hideCompleted],
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

  const onDrop = (date: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const id = e.dataTransfer.getData('text/plain');
    const task = state?.tasks.find((t) => t.id === id);
    if (task && task.dueDate !== date) {
      dispatch({ type: 'task/update', id, patch: { dueDate: date } });
    }
  };

  const onClearDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const id = e.dataTransfer.getData('text/plain');
    const task = state?.tasks.find((t) => t.id === id);
    if (task && task.dueDate !== null) {
      dispatch({ type: 'task/update', id, patch: { dueDate: null } });
    }
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
          <button
            key={t.id}
            type="button"
            className="due-cal-task"
            draggable={canEdit}
            title={`${t.title} · ${dueLabel(date, today)}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenTask(t.id);
            }}
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData('text/plain', t.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
          >
            <span className={`due-cal-dot due-cal-dot-${dueTone(dueBucket(date, today))}`} aria-hidden="true" />
            <span className="due-cal-task-title">{t.title}</span>
          </button>
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
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={onClearDrop}
      >
        <span className="due-cal-strip-label">No date</span>
        {unscheduled.length === 0 && <span className="due-cal-strip-empty">Drop tasks here to clear their due date</span>}
        {unscheduled.map((t) => (
          <button
            key={t.id}
            type="button"
            className="due-cal-task"
            draggable={canEdit}
            onClick={() => onOpenTask(t.id)}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', t.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
          >
            <span className="due-cal-dot due-cal-dot-neutral" aria-hidden="true" />
            <span className="due-cal-task-title">{t.title}</span>
          </button>
        ))}
      </div>

      <Modal
        open={dayPopup !== null}
        title={dayPopup ? dayHeader.format(parseIso(dayPopup)) : ''}
        onClose={() => setDayPopup(null)}
        width="sm"
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
        {dayPopup && (tasksByDay.get(dayPopup)?.length ? (
          <div className="data-list">
            {tasksByDay
              .get(dayPopup)!
              .slice()
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="data-row"
                  onClick={() => {
                    onOpenTask(t.id);
                    setDayPopup(null);
                  }}
                >
                  <span className="data-row-main">
                    <span className="data-row-title">{t.title}</span>
                    <Badge tone={TASK_STATUS[t.status as keyof typeof TASK_STATUS].tone}>
                      {TASK_STATUS[t.status as keyof typeof TASK_STATUS].label}
                    </Badge>
                  </span>
                </button>
              ))}
          </div>
        ) : (
          <p className="modal-copy modal-copy-muted">No tasks due on this day.</p>
        ))}
      </Modal>
    </div>
  );
}