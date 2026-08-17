import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, SquaresFour, Flag, CalendarBlank } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router';
import type { Task, TaskStatus } from '../../lib/types';
import { isTaskCompletable } from '../../lib/utils';
import { dueBucket, dueColumnDate, type DueBucket } from '../../lib/due-dates';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { NewTaskModal } from './NewTaskModal';
import { DueCalendar } from './DueCalendar';
import { InlineError } from '../../components/InlineError';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'inProgress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

type BoardView = 'status' | 'milestone' | 'due';

const DUE_BUCKETS: { bucket: DueBucket; label: string }[] = [
  { bucket: 'overdue', label: 'Overdue' },
  { bucket: 'today', label: 'Today' },
  { bucket: 'tomorrow', label: 'Tomorrow' },
  { bucket: 'thisWeek', label: 'This Week' },
  { bucket: 'nextWeek', label: 'Next Week' },
  { bucket: 'later', label: 'Later' },
  { bucket: 'none', label: 'No Date' },
];

const milestoneOrder = (m: { status: string; targetDate?: string | null }): number =>
  m.status === 'planned' ? 0 : m.status === 'inProgress' ? 1 : 2;

interface NewTaskTarget {
  status?: TaskStatus;
  milestoneId?: string | null;
  dueDate?: string | null;
}

export function BoardPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { state, loading, error, dispatch, canEdit } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: BoardView =
    viewParam === 'milestone' ? 'milestone' : viewParam === 'due' ? 'due' : 'status';
  const calParam = searchParams.get('cal');
  const calMode = view === 'due' && calParam === '1';
  const setCal = (on: boolean) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (on) p.set('cal', '1');
        else p.delete('cal');
        return p;
      },
      { replace: true },
    );
  };
  const setView = (next: BoardView) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('view', next);
        return p;
      },
      { replace: true },
    );
  };
  const [overKey, setOverKey] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [newTaskAt, setNewTaskAt] = useState<NewTaskTarget | null>(null);
  const [doneBlockedMsg, setDoneBlockedMsg] = useState<string | null>(null);
  const doneBlockedTimer = useRef<number | undefined>(undefined);
  const openTask = useCallback((id: string) => setEditId(id), []);
  useEntityDeepLink('tasks', openTask);
  useNewParam(() => setNewTaskAt({}), '1', canEdit);

  useEffect(() => () => window.clearTimeout(doneBlockedTimer.current), []);

  const showDoneBlocked = (msg: string) => {
    setDoneBlockedMsg(msg);
    window.clearTimeout(doneBlockedTimer.current);
    doneBlockedTimer.current = window.setTimeout(() => setDoneBlockedMsg(null), 4000);
  };

  useEffect(() => {
    if (!canEdit || editId || newTaskAt || !state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.classList.contains('task-card')) return;
      const id = el.dataset.taskId;
      if (!id) return;
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (view === 'due') return;
      if (view === 'status') {
        const i = COLUMNS.findIndex((c) => c.status === task.status);
        const next = COLUMNS[(i + dir + COLUMNS.length) % COLUMNS.length]!.status;
        if (next === task.status) return;
        if (next === 'done' && !isTaskCompletable(task, state.testCases)) {
          showDoneBlocked(
            `"${task.title}" still has test cases that are not all passed. Finish them before moving to Done.`,
          );
          return;
        }
        dispatch({ type: 'task/update', id, patch: { status: next } });
      } else {
        const ordered: (string | null)[] = [...state.milestones]
          .sort((a, b) => {
            const order = milestoneOrder(a) - milestoneOrder(b);
            if (order !== 0) return order;
            return (a.targetDate ?? '9999-99-99').localeCompare(b.targetDate ?? '9999-99-99');
          })
          .map((m) => m.id);
        ordered.push(null);
        const i = ordered.indexOf(task.milestoneId ?? null);
        const next = ordered[(i + dir + ordered.length) % ordered.length] ?? null;
        if (next === task.milestoneId) return;
        dispatch({ type: 'task/update', id, patch: { milestoneId: next } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, editId, newTaskAt, view, state, dispatch]);

  if (loading) {
    return (
      <div className="kanban">
        {COLUMNS.map((col) => (
          <div key={col.status} className="kanban-col" aria-hidden="true">
            <div className="kanban-col-header">
              <span>{col.label}</span>
            </div>
            <div className="kanban-col-body">
              <Skeleton style={{ height: 84, width: '100%' }} />
              <Skeleton style={{ height: 84, width: '100%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <InlineError>
        {error}
      </InlineError>
    );
  }

  if (!state) return null;

  const milestoneColumns = [
    ...[...state.milestones].sort((a, b) => {
      const order = milestoneOrder(a) - milestoneOrder(b);
      if (order !== 0) return order;
      return (a.targetDate ?? '9999-99-99').localeCompare(b.targetDate ?? '9999-99-99');
    }),
    null,
  ];

  function handleDropStatus(status: TaskStatus, e: React.DragEvent) {
    const id = e.dataTransfer.getData('text/plain');
    const task = state?.tasks.find((t) => t.id === id);
    if (!task) {
      setOverKey(null);
      return;
    }
    if (status === 'done' && task.status !== 'done' && !isTaskCompletable(task, state!.testCases)) {
      showDoneBlocked(
        `"${task.title}" still has test cases that are not all passed. Finish them before moving to Done.`,
      );
      setOverKey(null);
      return;
    }
    if (task.status !== status) {
      dispatch({ type: 'task/update', id, patch: { status } });
    }
    setOverKey(null);
  }

  function handleDropMilestone(milestoneId: string | null, e: React.DragEvent) {
    const id = e.dataTransfer.getData('text/plain');
    const task = state?.tasks.find((t) => t.id === id);
    if (task && task.milestoneId !== milestoneId) {
      dispatch({ type: 'task/update', id, patch: { milestoneId } });
    }
    setOverKey(null);
  }

  function renderColumn(
    key: string,
    header: React.ReactNode,
    tasks: Task[],
    dropKey: string | null,
    onDrop: (e: React.DragEvent) => void,
    onAdd: () => void,
  ) {
    return (
      <div
        key={key}
        className="kanban-col"
        data-testid={`kanban-col-${key}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dropKey) setOverKey(dropKey);
        }}
        onDragLeave={() => setOverKey((cur) => (cur === dropKey ? null : cur))}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(e);
        }}
      >
        <div className="kanban-col-header">{header}</div>
        <div className={`kanban-col-body ${overKey === dropKey ? 'kanban-drop-active' : ''}`}>
          {tasks.length === 0 && <p className="kanban-col-empty">Drop tasks here</p>}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={openTask} showStatus={view === 'milestone'} showMilestone={view === 'status'} unread={unreadIds?.has(task.id)} />
          ))}
        </div>
        <div className="kanban-col-add">
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="kanban-add-btn"
              leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />}
              onClick={onAdd}
            >
              Add task
            </Button>
          )}
        </div>
      </div>
    );
  }

  const statusColumns = COLUMNS.map((col) =>
    renderColumn(
      col.status,
      <>
        <span className="kanban-col-label">{col.label}</span>
        <span className="kanban-col-count tabular">
          {state.tasks.filter((t) => t.status === col.status).length}
        </span>
      </>,
      state.tasks.filter((t) => t.status === col.status),
      col.status,
      (e) => handleDropStatus(col.status, e),
      () => setNewTaskAt({ status: col.status }),
    ),
  );

  const milestoneCols = milestoneColumns.map((m) => {
    const mId = m?.id ?? null;
    const tasks = state.tasks.filter((t) => t.milestoneId === mId);
    const done = tasks.filter((t) => t.status === 'done').length;
    const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    const key = mId ?? 'unassigned';
    return renderColumn(
      key,
      <>
        <div className="kanban-milestone-header">
          <span className="kanban-col-label">{m?.name ?? 'Unassigned'}</span>
          {m?.version && <span className="task-label">{m.version}</span>}
        </div>
        <span className="kanban-col-count tabular" title={`${done}/${tasks.length} done`}>
          {tasks.length} · {progress}%
        </span>
      </>,
      tasks,
      key,
      (e) => handleDropMilestone(mId, e),
      () => setNewTaskAt({ milestoneId: mId }),
    );
  });

  function handleDropDue(bucket: DueBucket, e: React.DragEvent) {
    const id = e.dataTransfer.getData('text/plain');
    const task = state?.tasks.find((t) => t.id === id);
    const dueDate = dueColumnDate(bucket);
    if (task && task.dueDate !== dueDate) {
      dispatch({ type: 'task/update', id, patch: { dueDate } });
    }
    setOverKey(null);
  }

  const dueCols = DUE_BUCKETS.map(({ bucket, label }) => {
    const tasks = state.tasks
      .filter((t) => dueBucket(t.dueDate) === bucket)
      .sort((a, b) => (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'));
    return renderColumn(
      bucket,
      <>
        <span className="kanban-col-label">{label}</span>
        <span className="kanban-col-count tabular">{tasks.length}</span>
      </>,
      tasks,
      bucket,
      (e) => handleDropDue(bucket, e),
      () => setNewTaskAt({ dueDate: dueColumnDate(bucket) }),
    );
  });

  return (
    <div>
      <div className="board-toolbar">
        <div className="sub-tabs" role="tablist" aria-label="Board view">
          <button
            type="button"
            role="tab"
            className={`sub-tab ${view === 'status' ? 'sub-tab-active' : ''}`}
            onClick={() => setView('status')}
            aria-selected={view === 'status'}
          >
            <SquaresFour size={13} aria-hidden="true" />
            By Status
          </button>
          <button
            type="button"
            role="tab"
            className={`sub-tab ${view === 'milestone' ? 'sub-tab-active' : ''}`}
            onClick={() => setView('milestone')}
            aria-selected={view === 'milestone'}
          >
            <Flag size={13} aria-hidden="true" />
            By Milestone
          </button>
          <button
            type="button"
            role="tab"
            className={`sub-tab ${view === 'due' ? 'sub-tab-active' : ''}`}
            onClick={() => setView('due')}
            aria-selected={view === 'due'}
          >
            <CalendarBlank size={13} aria-hidden="true" />
            By Due Date
          </button>
        </div>
        {view === 'due' && (
          <div className="sub-tabs" role="tablist" aria-label="Due date view">
            <button
              type="button"
              role="tab"
              className={`sub-tab ${!calMode ? 'sub-tab-active' : ''}`}
              onClick={() => setCal(false)}
              aria-selected={!calMode}
            >
              Buckets
            </button>
            <button
              type="button"
              role="tab"
              className={`sub-tab ${calMode ? 'sub-tab-active' : ''}`}
              onClick={() => setCal(true)}
              aria-selected={calMode}
            >
              Calendar
            </button>
          </div>
        )}
        <span className="board-hints" aria-hidden="true">
          ← → move · n new item
        </span>
      </div>

      {doneBlockedMsg && <InlineError className="mb-12">{doneBlockedMsg}</InlineError>}

      <div className="kanban">
        {view === 'status' ? (
          statusColumns
        ) : view === 'milestone' ? (
          milestoneCols
        ) : calMode ? (
          <DueCalendar onOpenTask={openTask} onQuickCreate={(dueDate) => setNewTaskAt({ dueDate })} />
        ) : (
          dueCols
        )}
      </div>

      <TaskModal taskId={editId} onClose={() => setEditId(null)} />
      <NewTaskModal
        open={newTaskAt !== null}
        status={newTaskAt?.status ?? null}
        milestoneId={newTaskAt?.milestoneId}
        dueDate={newTaskAt?.dueDate}
        onClose={() => setNewTaskAt(null)}
      />
    </div>
  );
}
