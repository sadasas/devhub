import { useEffect, useState } from 'react';
import { FolderOpen, Plus, SquaresFour } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { computeProjectStats } from '../../lib/stats';
import type { ProjectStats } from '../../lib/stats';
import { PROJECT_STATUS } from '../../lib/labels';
import { formatDate, formatRelative } from '../../lib/utils';
import { useNavigation } from '../../state/navigation-context';
import { useProjects } from '../../state/projects-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { NewProjectModal } from './NewProjectModal';

export function DashboardPage() {
  const { projects, loading, error } = useProjects();
  const { openProject } = useNavigation();
  const [newOpen, setNewOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!projects) return;
    let cancelled = false;
    setStatsLoading(true);
    Promise.all(
      projects.map(async (p) => ({ id: p.id, stats: computeProjectStats(await api.getState(p.id)) })),
    )
      .then((results) => {
        if (!cancelled) setStats(Object.fromEntries(results.map((r) => [r.id, r.stats])));
      })
      .catch(() => {
        /* stats are best-effort */
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Everything you are building, in one place.</p>
        </div>
        <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setNewOpen(true)}>
          New project
        </Button>
      </header>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="project-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="project-card">
              <Skeleton style={{ width: 140, height: 16 }} />
              <Skeleton style={{ width: '100%', height: 14 }} />
              <Skeleton style={{ width: '70%', height: 14 }} />
              <Skeleton style={{ width: 120, height: 12 }} />
            </div>
          ))}
        </div>
      ) : projects && projects.length === 0 ? (
        <div className="page-empty">
          <EmptyState
            icon={<SquaresFour size={22} />}
            title="No projects yet"
            description="Create your first project to track tasks, issues, your tech stack and more."
            action={
              <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setNewOpen(true)}>
                New project
              </Button>
            }
          />
        </div>
      ) : (
        <div className="project-grid">
          {projects?.map((p) => {
            const st = stats[p.id];
            return (
              <button key={p.id} type="button" className="project-card" onClick={() => openProject(p.id)}>
                <div className="project-card-top">
                  <span className="project-card-title">{p.name}</span>
                  <Badge tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Badge>
                </div>
                <p className="project-card-desc">{p.description || 'No description.'}</p>
                <div className="project-card-meta">
                  {st ? (
                    <>
                      <span className="tabular">
                        {st.doneTasks}/{st.totalTasks} done
                      </span>
                      <span className="tabular">{st.openIssues} issues</span>
                      {st.outdatedDeps > 0 ? (
                        <span className="tabular text-danger">{st.outdatedDeps} deps outdated</span>
                      ) : (
                        <span className="tabular">{st.outdatedDeps} deps outdated</span>
                      )}
                      {st.nextMilestone && (
                        <span className="project-card-meta-milestone" title={st.nextMilestone.name}>
                          <FolderOpen size={11} aria-hidden="true" />
                          {formatDate(st.nextMilestone.targetDate)} · {st.nextMilestone.name}
                        </span>
                      )}
                    </>
                  ) : statsLoading ? (
                    <span className="text-muted">…</span>
                  ) : null}
                </div>
                <div className="project-card-foot">
                  <span className="project-card-updated">updated {formatRelative(p.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <NewProjectModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
