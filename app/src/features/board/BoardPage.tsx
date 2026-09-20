import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Plus, SquaresFour, Flag, CalendarBlank, ArrowsOutSimple, ArrowsInSimple, CaretDown } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Milestone, Task, TaskStatus } from '../../lib/types';
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
import { DataErrorState } from '../../components/DataErrorState';
import { isTypingTarget, isModalOrPaletteOpen } from '../../lib/keys';

const DueCalendar = lazy(() => import('./DueCalendar').then((m) => ({ default: m.DueCalendar })));

const COLUMNS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];

type BoardView = 'status' | 'milestone' | 'calendar';

/** P2: <768px kanban swipe + milestone accordion breakpoint. */
function useIsBoardNarrow(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = (): void => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}

function milestoneVersionBadge(version: string): string {
  const trimmed = version.trim().replace(/^v/i, '');
  return trimmed.length > 0 ? `v${trimmed}` : version.trim();
}

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
  const { state, loading, error, loadError, dispatch, canEdit, teamId, retryLoad } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  // calendar replaces timeline (user request) — keep legacy redirects
  const view: BoardView =
    rawView === 'milestone' ? 'milestone' : rawView === 'calendar' || rawView === 'timeline' || rawView === 'due' ? 'calendar' : 'status';
  // legacy ?view=due|timeline or ?cal=1 → normalize to calendar (replace once)
  useEffect(() => {
    if (rawView === 'due' || rawView === 'timeline' || searchParams.get('cal') === '1') {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('view', 'calendar');
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
        // cleanup legacy cal param when leaving calendar
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
  const setMine = useCallback((on: boolean) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (on) p.set('mine', '1');
        else p.delete('mine');
        return p;
      },
      { replace: true },
    );
  }, [setSearchParams]);
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
  const [calHideCompleted, setCalHideCompleted] = useState(false);
  const [doneBlockedMsg, setDoneBlockedMsg] = useState<string | null>(null);
  // P2: kanban swipe (status tabs) + milestone accordion (mobile).
  const [activeStatusTab, setActiveStatusTab] = useState<TaskStatus>('todo');
  const [expandedMilestones, setExpandedMilestones] = useState<ReadonlySet<string>>(new Set());
  // Accordion: default expand item pertama saat mobile agar list tidak kosong.
  // Setelah pengguna menyentuh (buka/tutup) sekali, pilihannya dihormati —
  // semua grup boleh tertutup. (Deklarasi di sini, bukan di bawah: semua hook
  // wajib di atas early return loading/error/state — Rules of Hooks.)
  const [milestonesTouched, setMilestonesTouched] = useState(false);
  const isNarrow = useIsBoardNarrow();
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  // Waktu swipe terakhir (ms) — menekan tab tepat setelah swipe diabaikan agar
  // klik yang terbawa gesture tidak mengaktifkan tab yang salah.
  const lastSwipeAt = useRef(0);
  // P2: mobile breakpoints — status swipe tabs, milestone accordion.
  const isStatusSwipe = isNarrow && view === 'status';
  const isMilestoneAccordion = isNarrow && view === 'milestone';
  const [members, setMembers] = useState<Record<string, { email: string; displayName?: string }>>({});
  const doneBlockedTimer = useRef<number | undefined>(undefined);
  // Fullscreen = overlay CSS (.board-shell--fullscreen), BUKAN Fullscreen API:
  // portal ke document.body (Modal, Tooltip, BottomSheet) tetap tampil di atasnya.
  const [isFs, setIsFs] = useState(false);
  const fsBtnRef = useRef<HTMLButtonElement>(null);
  const toggleFs = useCallback(() => {
    setIsFs((v) => !v);
  }, []);

  const tabStatusRef = useRef<HTMLButtonElement>(null);
  const tabMilestoneRef = useRef<HTMLButtonElement>(null);
  const tabCalendarRef = useRef<HTMLButtonElement>(null);
  const handleViewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const order: BoardView[] = ['status', 'milestone', 'calendar'];
    const idx = order.indexOf(view);
    const next = order[(idx + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length] as BoardView;
    setView(next);
    (next === 'status' ? tabStatusRef : next === 'milestone' ? tabMilestoneRef : tabCalendarRef).current?.focus();
  };
  // Overlay fullscreen mengunci scroll body (pola whiteboard WB-17).
  useEffect(() => {
    if (!isFs) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFs]);
  // Fokuskan tombol keluar saat masuk fullscreen (pola whiteboard WB-17).
  useEffect(() => {
    if (isFs) fsBtnRef.current?.focus();
  }, [isFs]);
  useEffect(() => {
    if (editId || newTaskAt) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen() || e.altKey) return;
      if (e.key === 'Escape' && isFs) {
        e.preventDefault();
        setIsFs(false);
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFs();
      } else if (e.key === 'm' || e.key === 'M') {
        // M toggles the "only my tasks" chip (no-op when signed out).
        if (!user?.id) return;
        e.preventDefault();
        setMine(!mineOnly);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editId, newTaskAt, isFs, toggleFs, setMine, mineOnly, user]);
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
      if (view === 'calendar') return;
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

  function BoardCalendarSkeleton() {
    return (
      <div className="due-cal-skeleton" role="status" aria-busy="true" aria-live="polite" aria-label="Loading calendar">
        <span className="sr-only">Loading calendar…</span>
        <div aria-hidden="true">
          <div className="due-cal-toolbar">
            <div className="due-cal-nav">
              <Skeleton style={{ width: 32, height: 32, borderRadius: 8 }} />
              <Skeleton style={{ width: 130, height: 18 }} />
              <Skeleton style={{ width: 32, height: 32, borderRadius: 8 }} />
            </div>
            <div className="sub-tabs">
              <Skeleton style={{ width: 76, height: 28, borderRadius: 999 }} />
              <Skeleton style={{ width: 76, height: 28, borderRadius: 999 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, margin: "10px 0 6px" }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} style={{ width: "60%", height: 11, margin: "0 auto" }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {Array.from({ length: 21 }).map((_, i) => (
              <Skeleton key={i} style={{ width: "100%", height: 64, borderRadius: 8 }} />
            ))}
          </div>
          <Skeleton style={{ width: "100%", height: 40, marginTop: 8, borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  if (loading) {
    if (view === "calendar") {
      return <BoardCalendarSkeleton />;
    }
    return (
      <>
      <div className="data-list-header" aria-hidden="true">
        <Skeleton style={{ width: 90, height: 13 }} />
        <span className="data-list-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Skeleton style={{ width: 120, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 32, height: 32, borderRadius: 8 }} />
        </span>
      </div>
      <div className="board-subtabs-row" aria-hidden="true">
        <div style={{ display: "flex", gap: 2 }}>
          <Skeleton style={{ width: 92, height: 30, borderRadius: 8 }} />
          <Skeleton style={{ width: 104, height: 30, borderRadius: 8 }} />
          <Skeleton style={{ width: 104, height: 30, borderRadius: 8 }} />
        </div>
      </div>
      <div className="kanban" role="status" aria-live="polite" aria-busy="true" aria-label="Loading board">
        <span className="sr-only">Loading board…</span>
        <div aria-hidden="true" style={{ display: 'contents' }}>
          {COLUMNS.map((col) => (
            <div key={col} className="kanban-col">
              <div className="kanban-col-header">
                <span className="kanban-col-label">{columnLabels[col]}</span>
                <Skeleton style={{ width: 20, height: 11, marginLeft: 6 }} />
              </div>
              <div className="kanban-col-body">
                {[0, 1].map((i) => (
                  <div key={i} className="task-card-wrap">
                    <div className="task-card">
                      <div className="task-card-top">
                        <Skeleton style={{ width: 20, height: 20, borderRadius: '50%' }} />
                        <Skeleton style={{ width: '34%', height: 11 }} />
                        <Skeleton style={{ width: 30, height: 18, borderRadius: 6, marginLeft: 'auto' }} />
                      </div>
                      <Skeleton style={{ width: '85%', height: 14 }} />
                      <div className="task-card-labels">
                        <Skeleton style={{ width: 48, height: 16, borderRadius: 999 }} />
                        <Skeleton style={{ width: 52, height: 16, borderRadius: 999 }} />
                      </div>
                      <div className="task-card-meta">
                        <span className="task-meta-left">
                          <Skeleton style={{ width: 64, height: 11 }} />
                        </span>
                        <span className="task-meta-right">
                          <Skeleton style={{ width: 44, height: 11 }} />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="kanban-col-add">
                <Skeleton style={{ width: '100%', height: 28, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
    );
  }

  if (error) {
    return <DataErrorState error={loadError ?? error} onRetry={retryLoad} />;
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
    /** Teks kosong khusus (mis. label per status di swipe). Jika diisi, kotak
        dashed "drop" diganti teks polos — dipakai saat drag tak tersedia. */
    emptyText?: string,
  ) {
    registerDrop(dropKey ?? '', onDrop);
    // Drag hanya saat kolom berdampingan (desktop). Di mode swipe HP satu
    // kolom per layar + gesture swipe berebut dengan long-press → drag mati,
    // pindah status lewat tap kartu (TaskModal) atau panah keyboard.
    const colDragEnabled = !isStatusSwipe;
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
          {tasks.length === 0 &&
            (emptyText ? (
              <p className="kanban-col-empty kanban-col-empty--plain">{emptyText}</p>
            ) : (
              <p className="kanban-col-empty">{t('board.dropHere')}</p>
            ))}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={openTask} members={members} showStatus={view === 'milestone'} showMilestone={view === 'status'} unread={unreadIds?.has(task.id)} onTouchDrop={handleTouchDrop} dragEnabled={colDragEnabled} density="full" />
          ))}
        </div>
        <div className="kanban-col-add">
          {canEdit && (
            <Button
              variant={isStatusSwipe ? 'primary' : 'ghost'}
              size={isStatusSwipe ? 'md' : 'sm'}
              className="kanban-add-btn"
              leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
              onClick={onAdd}
            >
              {isStatusSwipe ? t('board.addTaskShort', { defaultValue: 'Task' }) : t('board.addTask')}
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
      mineOnly && (state?.tasks.length ?? 0) > 0
        ? t('board.emptyMineSwipe', { label: columnLabels[col] })
        : t('board.emptySwipe', { label: columnLabels[col] }),
    ),
  );

  interface MilestoneGroup {
    key: string;
    milestone: Milestone | null;
    milestoneId: string | null;
    tasks: Task[];
    done: number;
    total: number;
    progress: number;
  }

  const milestoneGroups: MilestoneGroup[] = milestoneColumns.map((m) => {
    const mId = m?.id ?? null;
    const tasks = applySort(
      filteredTasks.filter((t) => t.milestoneId === mId),
      sortSpec,
      effectiveSort.dir,
      (t) => !!t.pinned,
    );
    const done = tasks.filter((t) => t.status === 'done').length;
    const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    return { key: mId ?? 'unassigned', milestone: m, milestoneId: mId, tasks, done, total: tasks.length, progress };
  });

  const milestoneCols = milestoneGroups.map((g) =>
    renderColumn(
      g.key,
      <>
        <div className="kanban-milestone-header">
          <span className="kanban-col-label">{g.milestone?.name ?? t('board.unassigned')}</span>
          {g.milestone?.version && <span className="task-label">{milestoneVersionBadge(g.milestone.version)}</span>}
        </div>
        <span className="kanban-col-count tabular" title={t('board.doneProgress', { done: g.done, total: g.total })}>
          {g.total} · {g.progress}%
        </span>
      </>,
      g.tasks,
      g.key,
      (id) => moveTaskMilestone(id, g.milestoneId),
      () => setNewTaskAt({ milestoneId: g.milestoneId }),
    ),
  );

  // P2: penghitung + navigasi swipe.
  const statusCounts: Record<TaskStatus, number> = {
    todo: filteredTasks.filter((t) => t.status === 'todo').length,
    inProgress: filteredTasks.filter((t) => t.status === 'inProgress').length,
    review: filteredTasks.filter((t) => t.status === 'review').length,
    done: filteredTasks.filter((t) => t.status === 'done').length,
  };
  const activeStatusIndex = Math.max(0, COLUMNS.indexOf(activeStatusTab));
  const goStatusTab = (dir: 1 | -1): void => {
    const next = COLUMNS[(activeStatusIndex + dir + COLUMNS.length) % COLUMNS.length];
    if (next) setActiveStatusTab(next);
  };

  const handleSwipeTouchStart = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent): void => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    // Jangan rebut gesture drag task: useTouchDrag memakai long-press 180ms +
    // class .dragging, dan target .task-card. Swipe hanya dari area kosong kolom.
    if (typeof document !== 'undefined' && document.querySelector('.task-card.dragging')) return;
    const target = e.target as HTMLElement | null;
    // Swipe boleh mulai dari baris tab (tap kecil tetap jadi klik biasa,
    // klik yang terbawa swipe ditekan via lastSwipeAt). Area kartu/tombol
    // lain tetap dikecualikan agar tidak berebut dengan drag & scroll.
    const fromSwipeTab = !!target?.closest?.('.kanban-swipe-tab');
    if (!fromSwipeTab && target?.closest?.('.task-card, .task-card-pin, button, a, input, textarea, select')) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      lastSwipeAt.current = Date.now();
      goStatusTab(dx < 0 ? 1 : -1);
    }
  };

  const handleStatusTabKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let nextIdx = activeStatusIndex;
    if (e.key === 'ArrowRight') nextIdx = (activeStatusIndex + 1) % COLUMNS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (activeStatusIndex - 1 + COLUMNS.length) % COLUMNS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = COLUMNS.length - 1;
    const next = COLUMNS[nextIdx];
    if (!next) return;
    setActiveStatusTab(next);
    if (typeof document !== 'undefined') {
      document.getElementById(`kanban-swipe-tab-${next}`)?.focus();
    }
  };

  // Accordion: pakai milestonesTouched (state di atas) agar default expand
  // item pertama saat mobile — lihat deklarasi di blok state.
  const effectiveExpandedMilestones: ReadonlySet<string> =
    milestonesTouched || expandedMilestones.size > 0 || milestoneGroups.length === 0
      ? expandedMilestones
      : new Set([milestoneGroups[0]?.key ?? 'unassigned']);

  const toggleMilestone = (key: string): void => {
    setMilestonesTouched(true);
    setExpandedMilestones((prev) => {
      const firstKey = milestoneGroups[0]?.key;
      const base: ReadonlySet<string> =
        prev.size > 0 ? prev : firstKey ? new Set([firstKey]) : new Set<string>();
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
    <div className={isFs ? 'board-shell board-shell--fullscreen' : 'board-shell'}>
      <div className="data-list-header">
        {!isNarrow ? (
          <span className="data-list-count">{t('board.count', { count: state.tasks.length })}</span>
        ) : (
          <span className="sr-only" role="status">{t('board.count', { count: state.tasks.length })}</span>
        )}
        <div className="data-list-actions">
          <SortControl
            options={view === 'calendar' ? [] : TASK_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={view === 'calendar' ? null : sortValue}
            onChange={setSort}
            filters={[
              ...(userId
                ? [{
                    id: 'mine',
                    label: t('board.onlyMyTasks'),
                    checked: mineOnly,
                    onChange: setMine,
                  }]
                : []),
              ...(view === 'calendar'
                ? [{
                    id: 'hide-completed',
                    label: t('board.cal.hideCompleted'),
                    checked: calHideCompleted,
                    onChange: setCalHideCompleted,
                  }]
                : []),
            ]}
          />
          <Button
            ref={fsBtnRef}
            variant="ghost"
            size="sm"
            className="board-canvas-btn"
            aria-pressed={isFs}
            aria-label={isFs ? t('board.fullscreen.exit', { defaultValue: 'Exit fullscreen — F' }) : t('board.fullscreen.enter', { defaultValue: 'Fullscreen — F' })}
            title={isFs ? t('board.fullscreen.exit', { defaultValue: 'Fullscreen (F)' }) : t('board.fullscreen.enter', { defaultValue: 'Fullscreen (F)' })}
            onClick={toggleFs}
            leftIcon={isFs ? <ArrowsInSimple size={14} aria-hidden="true" /> : <ArrowsOutSimple size={14} aria-hidden="true" />}
          >
            {t('board.fullscreen.canvasLabel')}
          </Button>
        </div>
      </div>
      <div className="board-subtabs-row">
        <div className="sub-tabs" role="tablist" aria-label={t('board.viewTabs')}>
          <button
            ref={tabStatusRef}
            type="button"
            className={`sub-tab ${view === 'status' ? 'sub-tab-active' : ''}`}
            role="tab"
            id="tab-board-status"
            aria-controls="board-panel"
            aria-selected={view === 'status'}
            tabIndex={view === 'status' ? 0 : -1}
            onClick={() => setView('status')}
            onKeyDown={handleViewKeyDown}
            aria-label={t('board.byStatus')}
            title={t('board.byStatus')}
          >
            <SquaresFour size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('board.byStatus')}</span>
          </button>
          <button
            ref={tabMilestoneRef}
            type="button"
            className={`sub-tab ${view === 'milestone' ? 'sub-tab-active' : ''}`}
            role="tab"
            id="tab-board-milestone"
            aria-controls="board-panel"
            aria-selected={view === 'milestone'}
            tabIndex={view === 'milestone' ? 0 : -1}
            onClick={() => setView('milestone')}
            onKeyDown={handleViewKeyDown}
            aria-label={t('board.byMilestone')}
            title={t('board.byMilestone')}
          >
            <Flag size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('board.byMilestone')}</span>
          </button>
          <button
            ref={tabCalendarRef}
            type="button"
            className={`sub-tab ${view === 'calendar' ? 'sub-tab-active' : ''}`}
            role="tab"
            id="tab-board-calendar"
            aria-controls="board-panel"
            aria-selected={view === 'calendar'}
            tabIndex={view === 'calendar' ? 0 : -1}
            onClick={() => setView('calendar')}
            onKeyDown={handleViewKeyDown}
            aria-label={t('board.byCalendar', { defaultValue: 'Calendar' })}
            title={t('board.byCalendar', { defaultValue: 'Calendar' })}
          >
            <CalendarBlank size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('board.byCalendar', { defaultValue: 'Calendar' })}</span>
          </button>
        </div>
        <div className="board-subtabs-actions" />
      </div>

      {doneBlockedMsg && <InlineError className="mb-12">{doneBlockedMsg}</InlineError>}

      <div
        id="board-panel"
        role="tabpanel"
        aria-labelledby={view === 'status' ? 'tab-board-status' : view === 'milestone' ? 'tab-board-milestone' : 'tab-board-calendar'}
        tabIndex={0}
      >
      {view === 'calendar' ? (
        <Suspense
          fallback={<BoardCalendarSkeleton />}
        >
          <DueCalendar
            onOpenTask={openTask}
            onQuickCreate={(dueDate) => setNewTaskAt({ startDate: dueDate, dueDate })}
            taskFilter={mineOnly && userId ? (t) => t.assigneeId === userId : undefined}
            onTouchDrop={handleTouchDrop}
            hideCompleted={calHideCompleted}
            members={members}
            unreadIds={unreadIds}
          />
        </Suspense>
      ) : isStatusSwipe ? (
        <div className="kanban kanban--swipe" data-testid="kanban-swipe">
          <p className="sr-only" role="status">
            {t('board.swipeStatus', {
              label: columnLabels[activeStatusTab],
              index: activeStatusIndex + 1,
              total: COLUMNS.length,
              count: statusCounts[activeStatusTab],
            })}
          </p>
          <div
            className="kanban-swipe-tabs"
            role="tablist"
            aria-label={t('board.byStatus')}
            onKeyDown={handleStatusTabKeyDown}
            onTouchStart={handleSwipeTouchStart}
            onTouchEnd={handleSwipeTouchEnd}
          >
            {COLUMNS.map((col) => {
              const isActive = activeStatusTab === col;
              return (
                <button
                  key={col}
                  id={`kanban-swipe-tab-${col}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="kanban-swipe-panel"
                  tabIndex={isActive ? 0 : -1}
                  className={`kanban-swipe-tab${isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    // Abaikan klik yang terbawa gesture swipe.
                    if (Date.now() - lastSwipeAt.current < 500) return;
                    setActiveStatusTab(col);
                  }}
                >
                  <span className="kanban-swipe-tab-label">{columnLabels[col]}</span>
                  <span className="kanban-col-count tabular">{statusCounts[col]}</span>
                </button>
              );
            })}
          </div>
          <div
            className="kanban-swipe-viewport"
            id="kanban-swipe-panel"
            role="tabpanel"
            aria-labelledby={`kanban-swipe-tab-${activeStatusTab}`}
            aria-label={`${columnLabels[activeStatusTab]} — ${activeStatusIndex + 1} / ${COLUMNS.length}`}
            onTouchStart={handleSwipeTouchStart}
            onTouchEnd={handleSwipeTouchEnd}
          >
            {statusColumns[activeStatusIndex]}
          </div>
        </div>
      ) : isMilestoneAccordion ? (
        <div className="milestone-accordion" data-testid="milestone-accordion">
          {milestoneGroups.map((g) => {
            registerDrop(g.key, (id) => moveTaskMilestone(id, g.milestoneId));
            const isExpanded = effectiveExpandedMilestones.has(g.key);
            const triggerId = `ms-acc-trigger-${g.key}`;
            const panelId = `ms-acc-panel-${g.key}`;
            return (
              <div
                key={g.key}
                className={`ms-acc-item${isExpanded ? ' is-open' : ''}${overKey === g.key ? ' kanban-drop-active' : ''}`}
                data-testid={`ms-acc-${g.key}`}
                data-drop-key={g.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setOverKey(g.key);
                }}
                onDragLeave={() => setOverKey((cur) => (cur === g.key ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverKey(null);
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) moveTaskMilestone(id, g.milestoneId);
                }}
              >
                <button
                  type="button"
                  id={triggerId}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  className="ms-acc-trigger"
                  onClick={() => toggleMilestone(g.key)}
                >
                  <span className="ms-acc-name">{g.milestone?.name ?? t('board.unassigned')}</span>
                  {g.milestone?.version && (
                    <span className="task-label" title={g.milestone.version}>
                      {milestoneVersionBadge(g.milestone.version)}
                    </span>
                  )}
                  <span
                    className="milestone-progress ms-acc-progress"
                    title={t('board.doneProgress', { done: g.done, total: g.total })}
                  >
                    <span className="milestone-progress-track" aria-hidden="true">
                      <span className="milestone-progress-fill" style={{ width: `${g.progress}%` }} />
                    </span>
                    <span className="tabular ms-acc-pct">{g.progress}%</span>
                  </span>
                  <span className="kanban-col-count tabular">{g.total}</span>
                  <CaretDown size={14} aria-hidden="true" className={`ms-acc-chev${isExpanded ? ' is-open' : ''}`} />
                </button>
                {isExpanded && (
                  <div id={panelId} role="region" aria-labelledby={triggerId} className="ms-acc-panel">
                    <div className="ms-acc-tasks">
                      {g.tasks.length === 0 ? (
                        <p className="kanban-col-empty kanban-col-empty--plain">
                          {mineOnly && (state?.tasks.length ?? 0) > 0
                            ? t('board.emptyMineSwipe', { label: g.milestone?.name ?? t('board.unassigned') })
                            : t('board.emptySwipe', { label: g.milestone?.name ?? t('board.unassigned') })}
                        </p>
                      ) : (
                        g.tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onOpen={openTask}
                            members={members}
                            showStatus
                            showMilestone={false}
                            unread={unreadIds?.has(task.id)}
                            onTouchDrop={undefined}
                            dragEnabled={false}
                          />
                        ))
                      )}
                    </div>
                    <div className="kanban-col-add">
                      {canEdit && (
                        <Button
                          variant="primary"
                          size="md"
                          className="kanban-add-btn"
                          leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
                          onClick={() => setNewTaskAt({ milestoneId: g.milestoneId })}
                        >
                          {t('board.addTaskShort', { defaultValue: 'Task' })}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="kanban">
          {view === 'status' ? statusColumns : milestoneCols}
        </div>
      )}
      </div>
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
