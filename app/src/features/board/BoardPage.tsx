import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, SquaresFour, Flag } from '@phosphor-icons/react';
import type { Task, TaskStatus } from '../../lib/types';
import { isTaskCompletable } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { NewTaskModal } from './NewTaskModal';
import { InlineError } from '../../components/InlineError';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'inProgress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

type BoardView = 'status' | 'milestone';

interface NewTaskTarget {
  status?: TaskStatus;
  milestoneId?: string | null;
}

export function BoardPage() {
  const { state, loading, error, dispatch, canEdit } = useProject();
  const [view, setView] = useState<BoardView>('status');
  const [overKey, setOverKey] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [newTaskAt, setNewTaskAt] = useState<NewTaskTarget | null>(null);
  const [doneBlockedMsg, setDoneBlockedMsg] = useState<string | null>(null);
  const doneBlockedTimer = useRef<number | undefined>(undefined);
  const openTask = useCallback((id: string) => setEditId(id), []);

  useEffect(() => () => window.clearTimeout(doneBlockedTimer.current), []);

  const showDoneBlocked = (msg: string) => {
    setDoneBlockedMsg(msg);
    window.clearTimeout(doneBlockedTimer.current);
    doneBlockedTimer.current = window.setTimeout(() => setDoneBlockedMsg(null), 4000);
  };

  useEffect(() => {
    if (!canEdit || editId || newTaskAt) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || typing) return;
      e.preventDefault();
      setNewTaskAt({});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, editId, newTaskAt]);

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

  const milestoneOrder = (m: { status: string; targetDate?: string | null }): number =>
    m.status === 'planned' ? 0 : m.status === 'inProgress' ? 1 : 2;

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
            <TaskCard key={task.id} task={task} onOpen={openTask} showStatus={view === 'milestone'} showMilestone={view === 'status'} />
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

  return (
    <div>
      <div className="sub-tabs" role="tablist" aria-label="Board view">
        <button
          type="button"
          className={`sub-tab ${view === 'status' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('status')}
          aria-current={view === 'status' ? 'page' : undefined}
        >
          <SquaresFour size={13} aria-hidden="true" />
          By Status
        </button>
        <button
          type="button"
          className={`sub-tab ${view === 'milestone' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('milestone')}
          aria-current={view === 'milestone' ? 'page' : undefined}
        >
          <Flag size={13} aria-hidden="true" />
          By Milestone
        </button>
      </div>

      {doneBlockedMsg && <InlineError style={{ marginBottom: 12 }}>{doneBlockedMsg}</InlineError>}

      <div className="kanban">{view === 'status' ? statusColumns : milestoneCols}</div>

      <TaskModal taskId={editId} onClose={() => setEditId(null)} />
      <NewTaskModal
        open={newTaskAt !== null}
        status={newTaskAt?.status ?? null}
        milestoneId={newTaskAt?.milestoneId}
        onClose={() => setNewTaskAt(null)}
      />
    </div>
  );
}
