import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Bug, Columns, Info, Rocket, Stack } from '@phosphor-icons/react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, api } from '../../lib/api';
import type { PublicProject, State } from '../../lib/types';
import {
  ISSUE_STATUS,
  MILESTONE_STATUS,
  PROJECT_STATUS,
  TASK_STATUS,
  TECH_CATEGORY,
  TECH_STATUS,
} from '../../lib/labels';
import { formatDate } from '../../lib/utils';
import { computeProjectStats } from '../../lib/stats';
import { useAuth } from '../../state/auth-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';

type PublicTab = 'board' | 'issues' | 'stack' | 'milestones' | 'about';

const TABS: { id: PublicTab; label: string; icon: ReactNode }[] = [
  { id: 'board', label: 'Board', icon: <Columns size={15} /> },
  { id: 'issues', label: 'Issues', icon: <Bug size={15} /> },
  { id: 'stack', label: 'Stack', icon: <Stack size={15} /> },
  { id: 'milestones', label: 'Milestones', icon: <Rocket size={15} /> },
  { id: 'about', label: 'About', icon: <Info size={15} /> },
];

const BOARD_STATUSES = ['todo', 'inProgress', 'review', 'done'] as const;

const EMPTY_MESSAGE: Record<Exclude<PublicTab, 'about'>, string> = {
  board: 'No tasks yet.',
  issues: 'No issues yet.',
  stack: 'No stack entries yet.',
  milestones: 'No milestones yet.',
};

export function PublicProjectPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<PublicTab>('board');
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
          setState(data);
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

            <nav className="tabs" aria-label="Public project sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tab${tab === t.id ? ' tab-active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="tab-panel">
              {tab === 'board' && <PublicBoard state={state} />}
              {tab === 'issues' && <PublicIssues state={state} />}
              {tab === 'stack' && <PublicStack state={state} />}
              {tab === 'milestones' && <PublicMilestones state={state} />}
              {tab === 'about' && <PublicAbout project={project} state={state} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PublicBoard({ state }: { state: State }) {
  return (
    <div className="kanban">
      {BOARD_STATUSES.map((status) => {
        const tasks = state.tasks.filter((t) => t.status === status).slice(0, 20);
        return (
          <div key={status} className="kanban-col">
            <div className="kanban-col-header">
              <span className="kanban-col-label">{TASK_STATUS[status].label}</span>
              {tasks.length > 0 && (
                <span className="kanban-col-count tabular">{tasks.length}</span>
              )}
            </div>
            <div className="kanban-col-body">
              {tasks.length === 0 ? (
                <p className="kanban-col-empty">No tasks</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="task-card">
                    <div className="task-card-top">
                      <span className="task-card-title">{task.title}</span>
                    </div>
                    <div className="task-card-labels">
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
                      <span className="task-card-id font-mono" title={task.id}>
                        {task.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
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

function PublicAbout({ project, state }: { project: PublicProject; state: State }) {
  const stats = computeProjectStats(state);
  const counts = [
    { label: 'Tasks', value: state.tasks.length },
    { label: 'Open issues', value: stats.openIssues },
    { label: 'Test cases', value: state.testCases.length },
    { label: 'Stack entries', value: state.techEntries.length },
    { label: 'Milestones', value: state.milestones.length },
  ];

  return (
    <div className="about-body">
      <p className="about-description">{project.description || 'No description yet.'}</p>
      <p className="about-meta">
        <span>Team: {project.teamName}</span>
        <span>Created {formatDate(project.createdAt)}</span>
        <span>Updated {formatDate(project.updatedAt)}</span>
      </p>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
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