import { memo, useState } from 'react';
import { CaretRight, CaretDown, FolderOpen, WarningCircle, Bug, Clock } from '@phosphor-icons/react';
import { formatDate, formatRelative } from '../../lib/utils';
import type { Project } from '../../lib/types';
import type { ProjectStats } from '../../lib/stats';

interface WelcomeProjectRowProps {
  project: Project;
  stats?: ProjectStats | null;
  statsLoading?: boolean;
  archived?: boolean;
  onOpen: (id: string) => void;
}

function getDotTone(stats?: ProjectStats | null): string {
  if (!stats) return 'var(--text-muted)';
  if (stats.openIssues > 3 || stats.outdatedDeps > 2) return 'var(--status-danger)';
  if (stats.openIssues > 0 || stats.outdatedDeps > 0) return 'var(--status-warn)';
  if (stats.totalTasks > 0 && stats.doneTasks === stats.totalTasks) return 'var(--status-success)';
  return 'var(--accent)';
}

export const WelcomeProjectRow = memo(function WelcomeProjectRow({
  project,
  stats,
  statsLoading,
  archived,
  onOpen,
}: WelcomeProjectRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isArchived = archived ?? project.status === 'archived';
  const dotColor = isArchived ? 'var(--text-muted)' : getDotTone(stats ?? null);
  const hasTasks = !!(stats && stats.totalTasks > 0);
  const progressPct = hasTasks ? Math.round((stats!.doneTasks / stats!.totalTasks) * 100) : 0;
  const showIssues = !!(stats && stats.openIssues > 0);
  const showOutdated = !!(stats && stats.outdatedDeps > 0);
  const isExpandable = !!(project.description?.trim() || stats?.nextMilestone);

  return (
    <div className={`welcome-row-wrap${expanded ? ' welcome-row-wrap-expanded' : ''}`}>
      <button
        type="button"
        className={`welcome-row${isArchived ? ' welcome-row--archived' : ''}`}
        onClick={() => onOpen(project.id)}
        aria-label={`Open ${project.name}${isArchived ? ', archived' : ''}, ${stats ? `${stats.doneTasks} of ${stats.totalTasks} done, ${stats.openIssues} open issues` : 'no stats yet'}`}
      >
        <span className="welcome-row-main">
          <span className="welcome-row-dot" style={{ background: dotColor }} aria-hidden="true" />
          <span className="welcome-row-title" title={project.name}>
            {project.name}
          </span>
          {isArchived && <span className="badge welcome-row-badge-archived">Archived</span>}
          <span className="welcome-row-team" title={project.teamName}>
            {project.teamName}
          </span>
        </span>

        <span className="welcome-row-meta">
          {hasTasks ? (
            <span className="welcome-row-progress" title={`${stats!.doneTasks} of ${stats!.totalTasks} tasks done`}>
              <span className="welcome-row-track" aria-hidden="true">
                <span className="welcome-row-fill" style={{ width: `${progressPct}%`, background: dotColor }} />
              </span>
              <span className="tabular welcome-row-done">
                {stats!.doneTasks}/{stats!.totalTasks}
              </span>
            </span>
          ) : statsLoading ? (
            <span className="welcome-row-skeleton">…</span>
          ) : (
            <span className="welcome-row-empty">—</span>
          )}

          {showIssues && (
            <span className="welcome-row-issues tabular" title={`${stats!.openIssues} open issues`}>
              <Bug size={11} aria-hidden="true" />
              {stats!.openIssues}
            </span>
          )}

          {showOutdated && (
            <span className="welcome-row-outdated tabular" title={`${stats!.outdatedDeps} outdated deps`}>
              <WarningCircle size={11} aria-hidden="true" />
              {stats!.outdatedDeps}
            </span>
          )}

          {stats?.nextMilestone ? (
            <span className="welcome-row-milestone" title={stats.nextMilestone.name}>
              <FolderOpen size={11} aria-hidden="true" />
              <span className="welcome-row-milestone-name">{stats.nextMilestone.name}</span>
              {stats.nextMilestone.targetDate && (
                <span className="welcome-row-milestone-date">{formatDate(stats.nextMilestone.targetDate)}</span>
              )}
            </span>
          ) : null}

          <span className="welcome-row-updated tabular" title={project.updatedAt}>
            <Clock size={10} aria-hidden="true" />
            {formatRelative(project.updatedAt)}
          </span>

          <CaretRight size={12} weight="bold" aria-hidden="true" className="welcome-row-chevron" />
        </span>
      </button>

      {isExpandable && (
        <button
          type="button"
          className="welcome-row-expand-btn"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          <CaretDown
            size={10}
            weight="bold"
            aria-hidden="true"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 120ms var(--ease-out)' }}
          />
          {expanded ? 'Less' : 'More'}
        </button>
      )}

      {expanded && (
        <div className="welcome-row-expanded">
          {project.description?.trim() ? (
            <p className="welcome-row-desc">{project.description}</p>
          ) : (
            <p className="welcome-row-desc welcome-row-desc-empty">No description — add context to remember why this project exists.</p>
          )}
          {stats?.nextMilestone && (
            <p className="welcome-row-next">
              Next: <strong>{stats.nextMilestone.name}</strong>
              {stats.nextMilestone.targetDate ? ` · ${formatDate(stats.nextMilestone.targetDate)}` : ''} · {stats.totalTasks - stats.doneTasks} tasks left
            </p>
          )}
        </div>
      )}
    </div>
  );
});
