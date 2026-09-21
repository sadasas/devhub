import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowSquareOut, Bug, CalendarBlank, ChalkboardSimple, Columns, Flag, Gauge, ListChecks, Rocket, SquaresFour, Stack, Eye, LockSimple, MagnifyingGlass, Prohibit, Target, type Icon } from '@phosphor-icons/react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError, api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { PublicProject, PublicTab, State, Task } from '../../lib/types';
import {
  ISSUE_STATUS,
  PROJECT_STATUS,
  TASK_STATUS,
} from '../../lib/labels';
import { formatDate, linkedTestCases } from '../../lib/utils';
import { dueBucket, taskDueChip } from '../../lib/due-dates';
import { computeProjectStats } from '../../lib/stats';
import { MarkdownBlocks, renderInline } from '../../lib/markdown';
import { useAuth } from '../../state/auth-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DataErrorState } from '../../components/DataErrorState';
import { Skeleton } from '../../components/Skeleton';
import { LegalFooter } from '../../components/LegalFooter';
import { PublicWhiteboards } from './PublicWhiteboards';
import { ReleasesTimelineView } from '../releases/ReleasesTimelineView';
import { DueCalendar } from '../board/DueCalendar';
import { StackGraph } from '../stack/StackGraph';
import { PublicIssueDetailModal, PublicTaskDetailModal } from './PublicDetailModal';

const ALL_PUBLIC_TABS: PublicTab[] = ['board', 'issues', 'stack', 'milestones', 'about', 'whiteboard'];

const TABS: { id: PublicTab; labelKey: string; icon: ReactNode }[] = [
  { id: 'board', labelKey: 'public.tab.board', icon: <Columns size={15} /> },
  { id: 'issues', labelKey: 'public.tab.issues', icon: <Bug size={15} /> },
  { id: 'stack', labelKey: 'public.tab.stack', icon: <Stack size={15} /> },
  { id: 'milestones', labelKey: 'public.tab.milestones', icon: <Rocket size={15} /> },
  { id: 'whiteboard', labelKey: 'public.tab.whiteboard', icon: <ChalkboardSimple size={15} /> },
  { id: 'about', labelKey: 'public.tab.overview', icon: <Gauge size={15} /> },
];

const BOARD_STATUSES = ['todo', 'inProgress', 'review', 'done'] as const;

/** Fail-closed: hanya http(s)://… ≤2048 char yang dirender sebagai CTA. */
function safePublicUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v === '' || v.length > 2048) return null;
  if (!/^https?:\/\/\S+$/i.test(v)) return null;
  return v;
}

const EMPTY_MESSAGE_KEYS: Record<Exclude<PublicTab, 'about'>, string> = {
  board: 'public.empty.board',
  issues: 'public.empty.issues',
  stack: 'public.empty.stack',
  milestones: 'public.empty.milestones',
  whiteboard: 'public.empty.whiteboard',
};

export function PublicProjectPage() {
  const { t, i18n } = useTranslation('extras');
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isId = i18n.resolvedLanguage === 'id';
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const taskParam = searchParams.get('task');
  const issueParam = searchParams.get('issue');
  // A11y: ingat kartu pembuka modal agar fokus bisa dikembalikan saat tutup.
  const lastOpenedRef = useRef<{ kind: 'task' | 'issue'; id: string } | null>(null);
  const setTab = (next: PublicTab) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', next);
        return p;
      },
      { replace: true },
    );
  };
  const openTask = (id: string) => {
    lastOpenedRef.current = { kind: 'task', id };
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('task', id);
        p.delete('issue');
        return p;
      },
      { replace: true },
    );
  };
  const openIssue = (id: string) => {
    lastOpenedRef.current = { kind: 'issue', id };
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('issue', id);
        p.delete('task');
        return p;
      },
      { replace: true },
    );
  };
  const closeDetail = () => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('task');
        p.delete('issue');
        return p;
      },
      { replace: true },
    );
  };
  const [project, setProject] = useState<PublicProject | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLoadErrorRaw(null);
    setNotFound(false);
    setProject(null);
    setState(null);
    Promise.all([api.getPublicProject(projectId), api.getPublicState(projectId)])
      .then(([meta, data]) => {
        if (!cancelled) {
          setProject(meta);
          setState(data.state);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(getErrorMessage(err, t('public.errors.load')));
          setLoadErrorRaw(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, t, attempt]);

  const allowedTabs =
    project && project.tabs.length > 0 ? project.tabs : ALL_PUBLIC_TABS;
  const tab: PublicTab =
    TABS.some((tb) => tb.id === tabParam) && allowedTabs.includes(tabParam as PublicTab)
      ? (tabParam as PublicTab)
      : allowedTabs.includes('about')
        ? 'about'
        : (allowedTabs[0] ?? 'about');

  // SEO: meta robots noindex,nofollow KONDISIONAL hanya untuk /p/*.
  // Jangan ubah / (index) menjadi noindex.
  // SEO OPT-IN (flag-ready, default OFF — JANGAN aktifkan sekarang):
  //   ADR GA4 gated + noindex /p/ tetap berlaku. Bila nanti owner meminta
  //   "Allow search engines", tambahkan field opt-in (mis. project.allowIndexing)
  //   lalu ganti content di bawah menjadi:
  //     tag.setAttribute('content', project?.allowIndexing ? 'index,follow' : 'noindex,nofollow');
  //   Default harus tetap 'noindex,nofollow' (fail-closed).
  useEffect(() => {
    let tag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const created = !tag;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'robots');
      document.head.appendChild(tag);
    }
    const prev = tag.getAttribute('content');
    tag.setAttribute('content', 'noindex,nofollow');
    return () => {
      if (created) tag?.remove();
      else if (prev != null) tag?.setAttribute('content', prev);
      else tag?.removeAttribute('content');
    };
  }, []);

  const taskDone = state ? state.tasks.filter((tk) => tk.status === 'done').length : 0;
  const taskTotal = state ? state.tasks.length : 0;

  // Deep-link ?task=:id / ?issue=:id — ID tidak valid diabaikan diam-diam.
  const selectedTask = state && taskParam ? (state.tasks.find((tk) => tk.id === taskParam) ?? null) : null;
  const selectedIssue =
    state && issueParam && !selectedTask ? (state.issues.find((is) => is.id === issueParam) ?? null) : null;

  // Owner CTA opt-in (fail-closed): hanya http(s) valid yang dirender.
  const contactUrl = project ? safePublicUrl(project.contactUrl) : null;
  const liveDemoUrl = project ? safePublicUrl(project.liveDemoUrl) : null;
  const hasCta = contactUrl != null || liveDemoUrl != null;

  return (
    <div className="public-root">
      <header className="public-bar">
        <button type="button" className="public-brand" onClick={() => navigate('/')}>
          DevHub
        </button>
        <div className="public-bar-actions">
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}`)}>
              {t('public.openInDevHub')}
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate('/')}>
              {t('public.signIn')}
            </Button>
          )}
        </div>
      </header>

      <main className="page">
        {loading && (
          <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading public project">
            <span className="sr-only">Loading public project…</span>
            <div aria-hidden="true">
              <Skeleton style={{ width: 280, height: 28, marginTop: 8, borderRadius: 6 }} />
              <Skeleton style={{ width: 200, height: 16, marginTop: 12, borderRadius: 6 }} />
              <div className="project-actions" style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Skeleton style={{ width: 90, height: 22, borderRadius: 999 }} />
                <Skeleton style={{ width: 70, height: 22, borderRadius: 999 }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="skeleton-tab" />
                ))}
              </div>
              <div className="kanban" style={{ marginTop: 16 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="kanban-col">
                    <div className="kanban-col-header">
                      <Skeleton style={{ width: 72, height: 13 }} />
                      <Skeleton style={{ width: 20, height: 11, marginLeft: 6 }} />
                    </div>
                    <div className="kanban-col-body">
                      <Skeleton style={{ width: "100%", height: 88, borderRadius: 8 }} />
                      <Skeleton style={{ width: "100%", height: 88, borderRadius: 8, marginTop: 8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && notFound && (
          <div className="page-empty">
            <EmptyState
              icon={<Columns size={22} />}
              title={t('public.notFound.title')}
              description={t('public.notFound.desc')}
            />
            <Button onClick={() => navigate('/')}>{t('public.backToDevHub')}</Button>
          </div>
        )}

        {!loading && error && !project && <DataErrorState error={loadErrorRaw ?? error} onRetry={() => { setError(null); setLoadErrorRaw(null); setAttempt((a) => a + 1); }} />}

        {!loading && project && state && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">{project.name}</h1>
                <p className="page-subtitle">
                  {isId
                    ? `Dibagikan oleh ${project.teamName} • Diperbarui ${formatDate(project.updatedAt)} • ${taskDone} dari ${taskTotal} selesai`
                    : `Shared by ${project.teamName} • Updated ${formatDate(project.updatedAt)} • ${taskDone}/${taskTotal} done`}
                </p>
              </div>
              <div className="project-actions" aria-label={isId ? 'Tautan publik, hanya baca, tanpa login' : 'Public link, read-only, no login'}>
                <Badge tone={PROJECT_STATUS[project.status].tone}>
                  {PROJECT_STATUS[project.status].label}
                </Badge>
                <Badge tone="success">
                  <Eye size={11} aria-hidden="true" />
                  {isId ? 'Tautan publik' : t('public.badge.public')}
                </Badge>
                <Badge tone="info">
                  <LockSimple size={11} aria-hidden="true" />
                  {isId ? 'hanya baca • tanpa login' : 'read-only • no login'}
                </Badge>
                {hasCta && (
                  <span role="group" aria-label={t('public.cta.groupAria')} style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                    {contactUrl && (
                      <a
                        className="btn btn-secondary btn-sm"
                        href={contactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('public.cta.contact')}
                        <ArrowSquareOut size={11} aria-hidden="true" />
                      </a>
                    )}
                    {liveDemoUrl && (
                      <a
                        className="btn btn-secondary btn-sm"
                        href={liveDemoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('public.cta.demo')}
                        <ArrowSquareOut size={11} aria-hidden="true" />
                      </a>
                    )}
                  </span>
                )}
              </div>
            </div>

            {project.status === 'archived' && (
              <div className="archived-banner" role="status">
                <Archive size={14} weight="duotone" aria-hidden="true" />
                <span className="archived-banner-copy">This project is archived — read-only.</span>
              </div>
            )}

            <nav className="tabs" role="tablist" aria-label={t('public.sectionsAria')}>
              {TABS.filter((tb) => allowedTabs.includes(tb.id)).map((tb) => {
                return (
                  <button
                    key={tb.id}
                    type="button"
                    role="tab"
                    id={`public-tab-${tb.id}`}
                    aria-selected={tab === tb.id}
                    aria-controls="public-tabpanel"
                    className={`tab${tab === tb.id ? ' tab-active' : ''}`}
                    onClick={() => setTab(tb.id)}
                  >
                    {tb.icon}
                    {t(tb.labelKey)}
                  </button>
                );
              })}
            </nav>

            <div
              className="tab-panel"
              role="tabpanel"
              id="public-tabpanel"
              aria-labelledby={`public-tab-${tab}`}
              tabIndex={0}
            >
              {tab === 'board' && <PublicBoard state={state} onOpenTask={openTask} />}
              {tab === 'issues' && <PublicIssues state={state} onOpenIssue={openIssue} onOpenTask={openTask} />}
              {tab === 'stack' && <PublicStack state={state} />}
              {tab === 'milestones' && <PublicMilestones state={state} />}
              {tab === 'whiteboard' && <PublicWhiteboards state={state} projectId={projectId} />}
              {tab === 'about' && <PublicAbout project={project} state={state} />}
            </div>

            {selectedTask && (
              <PublicTaskDetailModal task={selectedTask} state={state} onClose={closeDetail} onOpenTask={openTask} />
            )}
            {!selectedTask && selectedIssue && (
              <PublicIssueDetailModal issue={selectedIssue} state={state} onClose={closeDetail} onOpenTask={openTask} />
            )}
          </>
        )}
      </main>
      <div className="public-footer">
        <LegalFooter compact />
      </div>
    </div>
  );
}

type BoardView = 'status' | 'milestone' | 'calendar';

function PublicTaskCard({
  task,
  state,
  showStatus,
  showMilestone,
  onOpen,
}: {
  task: Task;
  state: State;
  showStatus?: boolean;
  showMilestone?: boolean;
  onOpen: (taskId: string) => void;
}) {
  const milestone = task.milestoneId
    ? state.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const testCases = linkedTestCases(task.id, state.testCases);
  return (
    <button
      type="button"
      className="task-card"
      onClick={() => onOpen(task.id)}
      aria-label={task.title}
      style={{ cursor: 'pointer' }}
    >
      <span className="task-card-top">
        <span className="task-card-title">{task.title}</span>
      </span>
      <span className="task-card-labels">
        {showStatus && <span className="task-label">{TASK_STATUS[task.status].label}</span>}
        {showMilestone && milestone && <span className="task-label">{milestone.name}</span>}
        <span key="priority" className="task-label">
          {task.priority}
        </span>
        {task.labels.slice(0, 3).map((label) => (
          <span key={label} className="task-label">
            {label}
          </span>
        ))}
      </span>
      <span className="task-card-meta">
        <span className="task-meta-left">
          {task.dueDate && taskDueChip(task).label && (
            <span
              className={`task-due task-due-${taskDueChip(task).tone}`}
              title={taskDueChip(task).title || formatDate(task.dueDate)}
            >
              {taskDueChip(task).label}
            </span>
          )}
          {testCases.length > 0 && (
            <span
              className="task-tests"
              title={testCases.map((tc) => `${tc.name} (${tc.status})`).join(', ')}
            >
              <ListChecks size={11} weight="bold" aria-hidden="true" />
              {testCases.length}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function PublicBoard({ state, onOpenTask }: { state: State; onOpenTask: (taskId: string) => void }) {
  const { t, i18n } = useTranslation('extras');
  const isId = i18n.resolvedLanguage === 'id';
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  // calendar menggantikan due/timeline — normalisasi legacy ?view=due|timeline → calendar.
  const view: BoardView =
    rawView === 'milestone'
      ? 'milestone'
      : rawView === 'calendar' || rawView === 'due' || rawView === 'timeline'
        ? 'calendar'
        : 'status';

  useEffect(() => {
    if (rawView === 'due' || rawView === 'timeline') {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('view', 'calendar');
          return p;
        },
        { replace: true },
      );
    }
  }, [rawView, setSearchParams]);

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

  const statusCols = BOARD_STATUSES.map((status) => {
    const tasks = state.tasks.filter((tk) => tk.status === status);
    return (
      <div key={status} className="kanban-col">
        <div className="kanban-col-header">
          <span className="kanban-col-label">{TASK_STATUS[status].label}</span>
          {tasks.length > 0 && <span className="kanban-col-count tabular">{tasks.length}</span>}
        </div>
        <div className="kanban-col-body">
          {tasks.length === 0 ? (
            <p className="kanban-col-empty">{t('public.board.noTasks')}</p>
          ) : (
            tasks.map((task) => (
              <PublicTaskCard key={task.id} task={task} state={state} showMilestone onOpen={onOpenTask} />
            ))
          )}
        </div>
      </div>
    );
  });

  const milestoneCols = milestoneColumns.map((m) => {
    const mId = m?.id ?? null;
    const tasks = state.tasks.filter((tk) => tk.milestoneId === mId);
    const done = tasks.filter((tk) => tk.status === 'done').length;
    const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    return (
      <div key={mId ?? 'unassigned'} className="kanban-col">
        <div className="kanban-col-header">
          <div className="kanban-milestone-header">
            <span className="kanban-col-label">{m?.name ?? t('public.board.unassigned')}</span>
            {m?.version && <span className="task-label">{m.version}</span>}
          </div>
          <span className="kanban-col-count tabular" title={t('public.board.doneTitle', { done, total: tasks.length })}>
            {tasks.length} · {progress}%
          </span>
        </div>
        <div className="kanban-col-body">
          {tasks.length === 0 ? (
            <p className="kanban-col-empty">{t('public.board.noTasks')}</p>
          ) : (
            tasks.map((task) => (
              <PublicTaskCard key={task.id} task={task} state={state} showStatus onOpen={onOpenTask} />
            ))
          )}
        </div>
      </div>
    );
  });

  return (
    <div>
      <div className="sub-tabs" role="tablist" aria-label={t('public.board.viewAria')}>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${view === 'status' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('status')}
          aria-selected={view === 'status'}
        >
          <SquaresFour size={13} aria-hidden="true" />
          {t('public.board.byStatus')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${view === 'milestone' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('milestone')}
          aria-selected={view === 'milestone'}
        >
          <Flag size={13} aria-hidden="true" />
          {t('public.board.byMilestone')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${view === 'calendar' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('calendar')}
          aria-selected={view === 'calendar'}
        >
          <CalendarBlank size={13} aria-hidden="true" />
          {t('public.board.byCalendar', { defaultValue: isId ? 'Kalender' : 'Calendar' })}
        </button>
      </div>
      {view === 'calendar' ? (
        <DueCalendar tasks={state.tasks} readOnly onOpenTask={onOpenTask} />
      ) : (
        <div className="kanban">
          {view === 'status' ? statusCols : milestoneCols}
        </div>
      )}
    </div>
  );
}

function PublicIssues({
  state,
  onOpenIssue,
  onOpenTask,
}: {
  state: State;
  onOpenIssue: (issueId: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { t } = useTranslation('extras');
  if (state.issues.length === 0) {
    return <p className="about-section-body about-section-body-empty">{t(EMPTY_MESSAGE_KEYS.issues)}</p>;
  }
  return (
    <div className="data-list">
      {state.issues.map((issue) => {
        const linkedTask = issue.linkedTaskId
          ? state.tasks.find((tk) => tk.id === issue.linkedTaskId)
          : undefined;
        return (
          <div key={issue.id} className="data-row">
            <div className="data-row-top">
              <button
                type="button"
                className="data-row-title-btn"
                onClick={() => onOpenIssue(issue.id)}
                aria-label={issue.title}
              >
                <span className="data-row-title">{issue.title}</span>
              </button>
              <span className="data-row-props">
                <Badge tone={ISSUE_STATUS[issue.status].tone}>{ISSUE_STATUS[issue.status].label}</Badge>
              </span>
            </div>
            <span className="data-row-sub">
              {t('public.issue.severity', { value: issue.severity })}
            </span>
            {issue.description && (
              <span className="data-row-sub public-issue-text">{issue.description}</span>
            )}
            {issue.reproduction && (
              <span className="data-row-sub public-issue-text">{issue.reproduction}</span>
            )}
            {linkedTask && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start', padding: 0, height: 'auto' }}
                onClick={() => onOpenTask(linkedTask.id)}
                aria-label={linkedTask.title}
              >
                → {linkedTask.title}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PublicStack({ state }: { state: State }) {
  const { t } = useTranslation('extras');
  if (state.techEntries.length === 0) {
    return <p className="about-section-body about-section-body-empty">{t(EMPTY_MESSAGE_KEYS.stack)}</p>;
  }
  return <StackGraph entries={state.techEntries} />;
}

function PublicMilestones({ state }: { state: State }) {
  const { t } = useTranslation('extras');
  if (state.milestones.length === 0) {
    return <p className="about-section-body about-section-body-empty">{t(EMPTY_MESSAGE_KEYS.milestones)}</p>;
  }
  return (
    <ReleasesTimelineView milestones={state.milestones} tasks={state.tasks} onSelect={() => {}} showCta={false} />
  );
}

const PRD_SECTIONS: { key: keyof NonNullable<PublicProject['prd']>; labelKey: string; icon: Icon }[] = [
  { key: 'purpose', labelKey: 'public.prd.purpose', icon: Target },
  { key: 'goals', labelKey: 'public.prd.goals', icon: Flag },
  { key: 'features', labelKey: 'public.prd.features', icon: Rocket },
  { key: 'scope', labelKey: 'public.prd.scope', icon: MagnifyingGlass },
  { key: 'outOfScope', labelKey: 'public.prd.outOfScope', icon: Prohibit },
];

function PublicAbout({ project, state }: { project: PublicProject; state: State }) {
  const { t, i18n } = useTranslation('extras');
  const isId = i18n.resolvedLanguage === 'id';
  const stats = computeProjectStats(state);
  const taskDone = stats.doneTasks;
  const taskTotal = stats.totalTasks;
  const progress = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
  const overdueViaBucket = state.tasks.filter(
    (tk) => tk.status !== 'done' && dueBucket(tk.dueDate) === 'overdue',
  ).length;
  const overdue = stats.overdueTasks > 0 ? stats.overdueTasks : overdueViaBucket;
  const next = stats.nextMilestone;

  const prdSections = PRD_SECTIONS.map((s) => ({
    ...s,
    value: project.prd?.[s.key] ?? '',
  })).filter((s) => s.value.trim() !== '');

  return (
    <div className="about-body">
      <p className="overview-public-note">{t('public.sharedSummaryNote')}</p>
      <div className="about-hero">
        <p className={`about-description${project.description.trim() ? '' : ' about-description-empty'}`}>
          {project.description.trim() ? renderInline(project.description) : t('public.noDescription')}
        </p>
        <p className="about-meta">
          <span className="about-meta-chip">{isId ? `Tim: ${project.teamName}` : `Team: ${project.teamName}`}</span>
          <span className="about-meta-chip">{t('public.header.created', { date: formatDate(project.createdAt) })}</span>
          <span className="about-meta-chip">{t('public.header.updated', { date: formatDate(project.updatedAt) })}</span>
        </p>
        <div className="milestone-progress" style={{ marginTop: 12 }}>
          <div className="milestone-progress-track">
            <div className="milestone-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="tabular">
            {taskDone}/{taskTotal} · {progress}%
          </span>
        </div>
        {overdue > 0 && (
          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: 'var(--status-danger)' }}>
            {isId ? `${overdue} task terlambat` : `${overdue} overdue`}
          </p>
        )}
        {next && (
          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {isId ? 'Berikutnya: ' : 'Next: '}
            <strong>{next.name}</strong>
            {next.targetDate ? ` • ${formatDate(next.targetDate)}` : ''}
          </p>
        )}
      </div>

      <div className="about-stats">
        <div className="about-stat">
          <span className="about-stat-title">{t('public.stats.tasks')}</span>
          <span className="about-stat-value">{taskTotal > 0 ? `${taskDone}/${taskTotal}` : '0'}</span>
        </div>
        <div className="about-stat">
          <span className="about-stat-title">{t('public.stats.milestones')}</span>
          <span className="about-stat-value">
            {stats.totalMilestones > 0 ? `${stats.releasedMilestones}/${stats.totalMilestones}` : '0'}
          </span>
        </div>
        <div className="about-stat">
          <span className="about-stat-title">{t('public.stats.openIssues')}</span>
          <span className="about-stat-value">{stats.openIssues}</span>
        </div>
      </div>

      <div className="about-stats">
        <div className="about-stat">
          <span className="about-stat-title">{t('public.stats.stackEntries')}</span>
          <span className="about-stat-value">{state.techEntries.length}</span>
        </div>
        <div className="about-stat">
          <span className="about-stat-title">{t('public.stats.whiteboards')}</span>
          <span className="about-stat-value">{state.whiteboards.length}</span>
        </div>
        <div className="about-stat">
          <span className="about-stat-title">{t('public.stats.testCases')}</span>
          <span className="about-stat-value">{state.testCases.length}</span>
        </div>
      </div>

      {prdSections.length > 0 && (
        <div className="about-cards">
          {prdSections.map((s) => (
            <section key={s.key} className="about-card">
              <h3 className="section-title">
                <s.icon size={14} weight="bold" aria-hidden="true" />
                {t(s.labelKey)}
              </h3>
              <div className="about-card-body">
                <MarkdownBlocks text={s.value} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
