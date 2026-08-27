import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Plus, SquaresFour, Flag, ChartBar, ArrowsOutSimple, ArrowsInSimple } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Task, TaskStatus } from '../../lib/types';
import { isTaskCompletable } from '../../lib/utils';
import { TASK_PRIORITY_ORDER } from '../../lib/labels';
import { applySort, type SortSpec } from '../../lib/sort';
import { useProject } from '../../state/project-context';
import { useOptionalAuth } from '../../state/auth-context';
import { api } from '../../lib/api';
import { registerDrop, getDropHandler } from '../../lib/drop-registry';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { NewTaskModal } from './NewTaskModal';
import { InlineError } from '../../components/InlineError';
import { isTypingTarget, isModalOrPaletteOpen } from '../../lib/keys';

const BoardTimeline = lazy(() =>
  import('./BoardTimeline').then((m) => ({ default: m.BoardTimeline })),
);

const COLUMNS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];

type BoardView = 'status' | 'milestone' | 'timeline';

const milestoneOrder = (m: { status: string; targetDate?: string | null }): number =>
  m.status === 'planned' ? 0 : m.status === 'inProgress' ? 1 : 2;

const TASK_SORT_SPECS: SortSpec<Task>[] = [
  { key: 'priority', label: 'board.sort.priority', get: (t) => t.priority, order: TASK_PRIORITY_ORDER },
  { key: 'estimate', label: 'board.sort.estimate', get: (t) => t.estimate ?? null },
  { key: 'title', label: 'board.sort.title', get: (t) => t.title },
  { key: 'createdAt', label: 'board.sort.createdAt', get: (t) => t.createdAt },
  { key: 'dueDate', label: 'board.sort.dueDate', get: (t) => t.dueDate ?? null },
];

interface NewTaskTarget {
  status?: TaskStatus;
  milestoneId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
}

export function BoardPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { t } = useTranslation('tracker');
  const { state, loading, error, dispatch, canEdit, teamId } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  // hard delete ?view=due → redirect to timeline (M41)
  const view: BoardView =
    rawView === 'milestone' ? 'milestone' : rawView === 'timeline' || rawView === 'due' ? 'timeline' : 'status';
  // legacy ?view=due or ?cal=1 → normalize to timeline (replace once)
  useEffect(() => {
    if (rawView === 'due' || searchParams.get('cal') === '1') {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('view', 'timeline');
          p.delete('cal');
          return p;
        },
        { replace: true },
      );
    }
  }, [rawView, searchParams, setSearchParams]);
  const setView = (next: BoardView) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('view', next);
        // cleanup legacy cal param when leaving due
        p.delete('cal');
        return p;
      },
      { replace: true },
    );
  };
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const { user } = useOptionalAuth();
  const mineParam = searchParams.get('mine');
  const mineOnly = mineParam === '1';
  const setMine = (on: boolean) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (on) p.set('mine', '1');
        else p.delete('mine');
        return p;
      },
      { replace: true },
    );
  };
  const sortSpec = TASK_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const columnLabels: Record<TaskStatus, string> = {
    todo: t('board.column.todo'),
    inProgress: t('board.column.inProgress'),
    review: t('board.column.review'),
    done: t('board.column.done'),
  };
  const [overKey, setOverKey] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [newTaskAt, setNewTaskAt] = useState<NewTaskTarget | null>(null);
  const [doneBlockedMsg, setDoneBlockedMsg] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, { email: string; displayName?: string }>>({});
  const doneBlockedTimer = useRef<number | undefined>(undefined);
  const shellRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen();
  }, []);
  useEffect(() => {
    const onFsChange = () => setIsFs(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  useEffect(() => {
    if (editId || newTaskAt) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen() || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFs();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editId, newTaskAt, toggleFs]);
  const openTask = useCallback((id: string) => setEditId(id), []);
  const handleTouchDrop = useCallback((taskId: string, dropKey: string | null) => {
    getDropHandler(dropKey)?.(taskId);
  }, []);
  useEntityDeepLink('tasks', openTask);
  useNewParam(() => setNewTaskAt({}), '1', canEdit);

  useEffect(() => {
    if (!teamId) {
      setMembers({});
      return;
    }
    let cancelled = false;
    api
      .listMembers(teamId)
      .then((list) => {
        if (!cancelled) {
          setMembers(
            Object.fromEntries(
              list.map((m) => [m.id, { email: m.email, displayName: m.displayName ?? '' }]),
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setMembers({});
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

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
      if (view === 'timeline') return;
      if (view === 'status') {
        const i = COLUMNS.indexOf(task.status);
        const next = COLUMNS[(i + dir + COLUMNS.length) % COLUMNS.length]!;
        if (next === task.status) return;
        if (next === 'done' && !isTaskCompletable(task, state.testCases)) {
          showDoneBlocked(
            t('board.blockedDone', { title: task.title }),
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
  }, [canEdit, editId, newTaskAt, view, state, dispatch, t]);

  if (loading) {
    return (
      <div className="kanban">
        {COLUMNS.map((col) => (
          <div key={col} className="kanban-col" aria-hidden="true">
            <div className="kanban-col-header">
              <span>{columnLabels[col]}</span>
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

  const userId = user?.id ?? null;
  const filteredTasks =
    mineOnly && userId ? state.tasks.filter((t) => t.assigneeId === userId) : state.tasks;

  const milestoneColumns = [
    ...[...state.milestones].sort((a, b) => {
      const order = milestoneOrder(a) - milestoneOrder(b);
      if (order !== 0) return order;
      return (a.targetDate ?? '9999-99-99').localeCompare(b.targetDate ?? '9999-99-99');
    }),
    null,
  ];

  function moveTaskStatus(id: string, status: TaskStatus) {
    if (!canEdit) return;
    const task = state?.tasks.find((t) => t.id === id);
    if (!task) return;
    if (status === 'done' && task.status !== 'done' && !isTaskCompletable(task, state!.testCases)) {
      showDoneBlocked(t('board.blockedDone', { title: task.title }));
      return;
    }
    if (task.status !== status) {
      dispatch({ type: 'task/update', id, patch: { status } });
    }
  }

  function moveTaskMilestone(id: string, milestoneId: string | null) {
    if (!canEdit) return;
    const task = state?.tasks.find((t) => t.id === id);
    if (task && task.milestoneId !== milestoneId) {
      dispatch({ type: 'task/update', id, patch: { milestoneId } });
    }
  }

  function renderColumn(
    key: string,
    header: React.ReactNode,
    tasks: Task[],
    dropKey: string | null,
    onDrop: (taskId: string) => void,
    onAdd: () => void,
  ) {
    registerDrop(dropKey ?? '', onDrop);
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
          setOverKey(null);
          const id = e.dataTransfer.getData('text/plain');
          if (id) onDrop(id);
        }}
      >
        <div className="kanban-col-header">{header}</div>
        <div
          className={`kanban-col-body ${overKey === dropKey ? 'kanban-drop-active' : ''}`}
          data-drop-key={dropKey ?? ''}
        >
          {tasks.length === 0 && <p className="kanban-col-empty">{t('board.dropHere')}</p>}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={openTask} members={members} showStatus={view === 'milestone'} showMilestone={view === 'status'} unread={unreadIds?.has(task.id)} onTouchDrop={handleTouchDrop} />
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
              {t('board.addTask')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const statusColumns = COLUMNS.map((col) =>
    renderColumn(
      col,
      <>
        <span className="kanban-col-label">{columnLabels[col]}</span>
        <span className="kanban-col-count tabular">
          {filteredTasks.filter((t) => t.status === col).length}
        </span>
      </>,
      applySort(
        filteredTasks.filter((t) => t.status === col),
        sortSpec,
        effectiveSort.dir,
        (t) => !!t.pinned,
      ),
      col,
      (id) => moveTaskStatus(id, col),
      () => setNewTaskAt({ status: col }),
    ),
  );

  const milestoneCols = milestoneColumns.map((m) => {
    const mId = m?.id ?? null;
    const tasks = applySort(
      filteredTasks.filter((t) => t.milestoneId === mId),
      sortSpec,
      effectiveSort.dir,
      (t) => !!t.pinned,
    );
    const done = tasks.filter((t) => t.status === 'done').length;
    const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    const key = mId ?? 'unassigned';
    return renderColumn(
      key,
      <>
        <div className="kanban-milestone-header">
          <span className="kanban-col-label">{m?.name ?? t('board.unassigned')}</span>
          {m?.version && <span className="task-label">{m.version}</span>}
        </div>
        <span className="kanban-col-count tabular" title={t('board.doneProgress', { done, total: tasks.length })}>
          {tasks.length} · {progress}%
        </span>
      </>,
      tasks,
      key,
      (id) => moveTaskMilestone(id, mId),
      () => setNewTaskAt({ milestoneId: mId }),
    );
  });

  return (
    <>
    <div ref={shellRef} className="board-shell">
      <div className="board-toolbar">
        <div className="sub-tabs" role="tablist" aria-label={t('board.viewTabs')}>
          <button
            type="button"
            role="tab"
            className={`sub-tab ${view === 'status' ? 'sub-tab-active' : ''}`}
            onClick={() => setView('status')}
            aria-selected={view === 'status'}
          >
            <SquaresFour size={13} aria-hidden="true" />
            {t('board.byStatus')}
          </button>
          <button
            type="button"
            role="tab"
            className={`sub-tab ${view === 'milestone' ? 'sub-tab-active' : ''}`}
            onClick={() => setView('milestone')}
            aria-selected={view === 'milestone'}
          >
            <Flag size={13} aria-hidden="true" />
            {t('board.byMilestone')}
          </button>
          <button
            type="button"
            role="tab"
            className={`sub-tab ${view === 'timeline' ? 'sub-tab-active' : ''}`}
            onClick={() => setView('timeline')}
            aria-selected={view === 'timeline'}
          >
            <ChartBar size={13} aria-hidden="true" />
            {t('board.byTimeline', { defaultValue: 'Timeline' })}
          </button>
        </div>
        <div className="board-toolbar-actions">
          {view !== 'timeline' && (
            <SortControl
              options={TASK_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
              value={sortValue}
              onChange={setSort}
            />
          )}
          {userId && (
            <label
              className="toolbar-check"
              title={mineOnly ? t('board.showAllTasks') : t('board.showOnlyMine')}
            >
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => setMine(e.target.checked)}
              />
              {t('board.onlyMyTasks')}
            </label>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="btn-icon"
            aria-pressed={isFs}
            aria-label={isFs ? t('board.fullscreen.exit', { defaultValue: 'Exit fullscreen — F' }) : t('board.fullscreen.enter', { defaultValue: 'Fullscreen — F' })}
            title={isFs ? t('board.fullscreen.exit', { defaultValue: 'Exit fullscreen (F)' }) : t('board.fullscreen.enter', { defaultValue: 'Fullscreen (F)' })}
            onClick={toggleFs}
          >
            {isFs ? <ArrowsInSimple size={15} aria-hidden="true" /> : <ArrowsOutSimple size={15} aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {doneBlockedMsg && <InlineError className="mb-12">{doneBlockedMsg}</InlineError>}

      {view === 'timeline' ? (
        <Suspense fallback={<div className="tl-skeleton" aria-busy="true" aria-live="polite"><Skeleton style={{ height: 28, width: '100%', marginBottom: 8 }} /><Skeleton style={{ height: 44, width: '100%', marginBottom: 12 }} /><Skeleton style={{ height: 280, width: '100%' }} /></div>}>
          <BoardTimeline
            filteredTasks={filteredTasks}
            onOpenTask={openTask}
            members={members}
            userId={userId}
            mineOnly={mineOnly}
            onNewTaskAt={setNewTaskAt}
            onTouchDrop={handleTouchDrop}
            unreadIds={unreadIds}
          />
        </Suspense>
      ) : (
        <div className="kanban">
          {view === 'status' ? statusColumns : milestoneCols}
        </div>
      )}
      </div>

      <TaskModal taskId={editId} onClose={() => setEditId(null)} />
      <NewTaskModal
        open={newTaskAt !== null}
        status={newTaskAt?.status ?? null}
        milestoneId={newTaskAt?.milestoneId}
        dueDate={newTaskAt?.dueDate}
        startDate={newTaskAt?.startDate}
        onClose={() => setNewTaskAt(null)}
      />
    </>
  );
}
