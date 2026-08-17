import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Bug, CalendarBlank, ChalkboardSimple, Columns, Flag, Info, ListChecks, Rocket, SquaresFour, Stack } from '@phosphor-icons/react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError, api } from '../../lib/api';
import type { PublicProject, PublicTab, State, Task } from '../../lib/types';
import {
  ISSUE_STATUS,
  MILESTONE_STATUS,
  PROJECT_STATUS,
  TASK_STATUS,
  TECH_CATEGORY,
  TECH_STATUS,
} from '../../lib/labels';
import { formatDate, linkedTestCases } from '../../lib/utils';
import { dueBucket, taskDueChip } from '../../lib/due-dates';
import { computeProjectStats } from '../../lib/stats';
import { useAuth } from '../../state/auth-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { PublicWhiteboards } from './PublicWhiteboards';

const ALL_PUBLIC_TABS: PublicTab[] = ['board', 'issues', 'stack', 'milestones', 'about', 'whiteboard'];

const TABS: { id: PublicTab; label: string; icon: ReactNode }[] = [
  { id: 'board', label: 'Board', icon: <Columns size={15} /> },
  { id: 'issues', label: 'Issues', icon: <Bug size={15} /> },
  { id: 'stack', label: 'Stack', icon: <Stack size={15} /> },
  { id: 'milestones', label: 'Milestones', icon: <Rocket size={15} /> },
  { id: 'whiteboard', label: 'Whiteboard', icon: <ChalkboardSimple size={15} /> },
  { id: 'about', label: 'About', icon: <Info size={15} /> },
];

const BOARD_STATUSES = ['todo', 'inProgress', 'review', 'done'] as const;

const EMPTY_MESSAGE: Record<Exclude<PublicTab, 'about'>, string> = {
  board: 'No tasks yet.',
  issues: 'No issues yet.',
  stack: 'No stack entries yet.',
  milestones: 'No milestones yet.',
  whiteboard: 'No whiteboards yet.',
};

export function PublicProjectPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
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
  const [project, setProject] = useState<PublicProject | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
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
          setError(err instanceof ApiError ? err.message : 'Failed to load project.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const allowedTabs =
    project && project.tabs.length > 0 ? project.tabs : ALL_PUBLIC_TABS;
  const tab: PublicTab =
    TABS.some((t) => t.id === tabParam) && allowedTabs.includes(tabParam as PublicTab)
      ? (tabParam as PublicTab)
      : allowedTabs[0] ?? 'board';

  return (
    <div className="public-root">
      <header className="public-bar">
        <button type="button" className="public-brand" onClick={() => navigate('/')}>
          DevHub
        </button>
        <div className="public-bar-actions">
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}`)}>
              Open in DevHub
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate('/')}>
              Sign in
            </Button>
          )}
        </div>
      </header>

      <main className="page">
        {loading && (
          <>
            <Skeleton style={{ width: 280, height: 28, marginTop: 8 }} />
            <Skeleton style={{ width: 200, height: 16, marginTop: 12 }} />
            <Skeleton style={{ width: '100%', height: 220, marginTop: 28 }} />
          </>
        )}

        {!loading && notFound && (
          <div className="page-empty">
            <EmptyState
              icon={<Columns size={22} />}
              title="Project not found"
              description="This project does not exist or is not shared publicly."
            />
            <Button onClick={() => navigate('/')}>Back to DevHub</Button>
          </div>
        )}

        {!loading && error && !project && <InlineError>{error}</InlineError>}

        {!loading && project && state && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">{project.name}</h1>
                <p className="page-subtitle">
                  {project.teamName} · Updated {formatDate(project.updatedAt)}
                </p>
              </div>
              <div className="project-actions">
                <Badge tone={PROJECT_STATUS[project.status].tone}>
                  {PROJECT_STATUS[project.status].label}
                </Badge>
                <Badge tone="success">Public</Badge>
              </div>
            </div>

            <nav className="tabs" role="tablist" aria-label="Public project sections">
              {TABS.filter((t) => allowedTabs.includes(t.id)).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`public-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="public-tabpanel"
                  className={`tab${tab === t.id ? ' tab-active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </nav>

            <div
              className="tab-panel"
              role="tabpanel"
              id="public-tabpanel"
              aria-labelledby={`public-tab-${tab}`}
              tabIndex={0}
            >
              {tab === 'board' && <PublicBoard state={state} />}
              {tab === 'issues' && <PublicIssues state={state} />}
              {tab === 'stack' && <PublicStack state={state} />}
              {tab === 'milestones' && <PublicMilestones state={state} />}
              {tab === 'whiteboard' && <PublicWhiteboards state={state} projectId={projectId} />}
              {tab === 'about' && <PublicAbout project={project} state={state} tabs={allowedTabs} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

type BoardView = 'status' | 'milestone' | 'due';

function PublicTaskCard({
  task,
  state,
  showStatus,
  showMilestone,
}: {
  task: Task;
  state: State;
  showStatus?: boolean;
  showMilestone?: boolean;
}) {
  const milestone = task.milestoneId
    ? state.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const testCases = linkedTestCases(task.id, state.testCases);
  return (
    <div className="task-card">
      <div className="task-card-top">
        <span className="task-card-title">{task.title}</span>
      </div>
      <div className="task-card-labels">
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
      </div>
      <div className="task-card-meta">
        <span className="task-meta-left">
          {task.dueDate && taskDueChip(task).label && (
            <span
              className={`task-due task-due-${taskDueChip(task).tone}`}
              title={formatDate(task.dueDate)}
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
        <span className="task-card-id font-mono" title={task.id}>
          {task.id.slice(0, 8)}
        </span>
      </div>
    </div>
  );
}

function PublicBoard({ state }: { state: State }) {
  const [view, setView] = useState<BoardView>('status');

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
    const tasks = state.tasks.filter((t) => t.status === status);
    return (
      <div key={status} className="kanban-col">
        <div className="kanban-col-header">
          <span className="kanban-col-label">{TASK_STATUS[status].label}</span>
          {tasks.length > 0 && <span className="kanban-col-count tabular">{tasks.length}</span>}
        </div>
        <div className="kanban-col-body">
          {tasks.length === 0 ? (
            <p className="kanban-col-empty">No tasks</p>
          ) : (
            tasks.map((task) => (
              <PublicTaskCard key={task.id} task={task} state={state} showMilestone />
            ))
          )}
        </div>
      </div>
    );
  });

  const milestoneCols = milestoneColumns.map((m) => {
    const mId = m?.id ?? null;
    const tasks = state.tasks.filter((t) => t.milestoneId === mId);
    const done = tasks.filter((t) => t.status === 'done').length;
    const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    return (
      <div key={mId ?? 'unassigned'} className="kanban-col">
        <div className="kanban-col-header">
          <div className="kanban-milestone-header">
            <span className="kanban-col-label">{m?.name ?? 'Unassigned'}</span>
            {m?.version && <span className="task-label">{m.version}</span>}
          </div>
          <span className="kanban-col-count tabular" title={`${done}/${tasks.length} done`}>
            {tasks.length} · {progress}%
          </span>
        </div>
        <div className="kanban-col-body">
          {tasks.length === 0 ? (
            <p className="kanban-col-empty">No tasks</p>
          ) : (
            tasks.map((task) => (
              <PublicTaskCard key={task.id} task={task} state={state} showStatus />
            ))
          )}
        </div>
      </div>
    );
  });

  const DUE_BUCKETS_PUBLIC: { bucket: ReturnType<typeof dueBucket>; label: string }[] = [
    { bucket: 'overdue', label: 'Overdue' },
    { bucket: 'today', label: 'Today' },
    { bucket: 'tomorrow', label: 'Tomorrow' },
    { bucket: 'thisWeek', label: 'This Week' },
    { bucket: 'nextWeek', label: 'Next Week' },
    { bucket: 'later', label: 'Later' },
    { bucket: 'none', label: 'No Date' },
  ];

  const dueCols = DUE_BUCKETS_PUBLIC.map(({ bucket, label }) => {
    const tasks = state.tasks
      .filter((t) => dueBucket(t.dueDate) === bucket)
      .sort((a, b) => (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'));
    return (
      <div key={bucket} className="kanban-col">
        <div className="kanban-col-header">
          <span className="kanban-col-label">{label}</span>
          <span className="kanban-col-count tabular">{tasks.length}</span>
        </div>
        <div className="kanban-col-body">
          {tasks.length === 0 ? (
            <p className="kanban-col-empty">No tasks</p>
          ) : (
            tasks.map((task) => (
              <PublicTaskCard key={task.id} task={task} state={state} showMilestone />
            ))
          )}
        </div>
      </div>
    );
  });

  return (
    <div>
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
      <div className="kanban">
        {view === 'status' ? statusCols : view === 'milestone' ? milestoneCols : dueCols}
      </div>
    </div>
  );
}

function PublicIssues({ state }: { state: State }) {
  if (state.issues.length === 0) {
    return <p className="about-section-body about-section-body-empty">{EMPTY_MESSAGE.issues}</p>;
  }
  return (
    <div className="data-list">
      {state.issues.map((issue) => (
        <div key={issue.id} className="data-row">
          <div className="data-row-main">
            <span className="data-row-title">{issue.title}</span>
            <span className="data-row-sub">
              Severity: {issue.severity}
              {issue.linkedTaskId ? ` · Linked to task ${issue.linkedTaskId.slice(0, 8)}` : ''}
            </span>
            {issue.description && (
              <span className="data-row-sub public-issue-text">{issue.description}</span>
            )}
            {issue.reproduction && (
              <span className="data-row-sub public-issue-text">{issue.reproduction}</span>
            )}
          </div>
          <div className="data-row-side">
            <Badge tone={ISSUE_STATUS[issue.status].tone}>{ISSUE_STATUS[issue.status].label}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function PublicStack({ state }: { state: State }) {
  if (state.techEntries.length === 0) {
    return <p className="about-section-body about-section-body-empty">{EMPTY_MESSAGE.stack}</p>;
  }
  return (
    <div className="data-list">
      {state.techEntries.map((entry) => (
        <div key={entry.id} className="data-row">
          <div className="data-row-main">
            <span className="data-row-title">{entry.name}</span>
            <span className="data-row-sub">{TECH_CATEGORY[entry.category].label}</span>
          </div>
          <div className="data-row-side">
            {entry.version && <span className="data-row-meta font-mono">{entry.version}</span>}
            <Badge tone={TECH_STATUS[entry.status].tone}>{TECH_STATUS[entry.status].label}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function PublicMilestones({ state }: { state: State }) {
  if (state.milestones.length === 0) {
    return <p className="about-section-body about-section-body-empty">{EMPTY_MESSAGE.milestones}</p>;
  }
  const sorted = [...state.milestones].sort((a, b) => {
    if (a.status === 'released' && b.status !== 'released') return -1;
    if (b.status === 'released' && a.status !== 'released') return 1;
    return a.targetDate?.localeCompare(b.targetDate ?? '') ?? 0;
  });
  return (
    <div className="data-list">
      {sorted.map((milestone) => (
        <div key={milestone.id} className="data-row">
          <div className="data-row-main">
            <span className="data-row-title">{milestone.name}</span>
            <span className="data-row-sub">
              {milestone.targetDate ? `Target ${formatDate(milestone.targetDate)}` : 'No target date'}
            </span>
          </div>
          <div className="data-row-side">
            {milestone.version && <span className="data-row-meta font-mono">{milestone.version}</span>}
            <Badge tone={MILESTONE_STATUS[milestone.status].tone}>
              {MILESTONE_STATUS[milestone.status].label}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

const PRD_SECTIONS: { key: keyof PublicProject['prd']; label: string }[] = [
  { key: 'purpose', label: 'Purpose' },
  { key: 'goals', label: 'Goals' },
  { key: 'features', label: 'Features' },
  { key: 'scope', label: 'Scope' },
  { key: 'outOfScope', label: 'Out of scope' },
];

function PublicAbout({ project, state, tabs }: { project: PublicProject; state: State; tabs: PublicTab[] }) {
  const stats = computeProjectStats(state);
  const tabCounts: Record<PublicTab, { label: string; value: number }> = {
    board: { label: 'Tasks', value: state.tasks.length },
    issues: { label: 'Open issues', value: stats.openIssues },
    milestones: { label: 'Milestones', value: state.milestones.length },
    stack: { label: 'Stack entries', value: state.techEntries.length },
    whiteboard: { label: 'Whiteboards', value: state.whiteboards.length },
    about: { label: 'Test cases', value: state.testCases.length },
  };
  const counts = ALL_PUBLIC_TABS.filter((t) => tabs.includes(t)).map((t) => tabCounts[t]);

  return (
    <div className="about-body">
      <p className="about-description">{project.description || 'No description yet.'}</p>
      <p className="about-meta">
        <span>Team: {project.teamName}</span>
        <span>Created {formatDate(project.createdAt)}</span>
        <span>Updated {formatDate(project.updatedAt)}</span>
      </p>

      <div className="stats-grid mb-24">
        {counts.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="stat-card-head">
              <span className="stat-card-title">{c.label}</span>
              <span className="stat-card-value">{c.value}</span>
            </div>
          </div>
        ))}
      </div>

      {PRD_SECTIONS.map((s) => {
        const value = project.prd[s.key];
        return (
          <section key={s.key} className="about-section">
            <h3 className="about-section-title">{s.label}</h3>
            <p className={`about-section-body${value ? '' : ' about-section-body-empty'}`}>
              {value || 'Not set yet.'}
            </p>
          </section>
        );
      })}
    </div>
  );
}