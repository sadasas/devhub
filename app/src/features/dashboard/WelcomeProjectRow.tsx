import { memo, useState } from 'react';
import { CaretRight, CaretDown, FolderOpen, WarningCircle, Bug, Clock } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelative } from '../../lib/utils';
import { Badge } from '../../components/Badge';
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
  const overdue = (stats as ProjectStats & { overdueTasks?: number }).overdueTasks ?? 0;
  if (stats.openIssues > 3 || stats.outdatedDeps > 2 || overdue > 2) return 'var(--status-danger)';
  if (stats.openIssues > 0 || stats.outdatedDeps > 0 || overdue > 0) return 'var(--status-warn)';
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
  const { t } = useTranslation('account');
  const isArchived = archived ?? project.status === 'archived';
  const dotColor = isArchived ? 'var(--text-muted)' : getDotTone(stats ?? null);
  const hasTasks = !!(stats && stats.totalTasks > 0);
  const progressPct = hasTasks ? Math.round((stats!.doneTasks / stats!.totalTasks) * 100) : 0;
  const showIssues = !!(stats && stats.openIssues > 0);
  const showOutdated = !!(stats && stats.outdatedDeps > 0);
  const showOverdue = !!((stats as ProjectStats & { overdueTasks?: number })?.overdueTasks);
  const isExpandable = !!(project.description?.trim() || stats?.nextMilestone);
  const panelId = `welcome-row-panel-${project.id}`;

  return (
    <div className={`welcome-row-wrap${expanded ? ' welcome-row-wrap-expanded' : ''}`}>
      <button
        type="button"
        className={`welcome-row${isArchived ? ' welcome-row--archived' : ''}`}
        onClick={() => onOpen(project.id)}
        aria-label={stats ? t('dashboard.welcome.row.openAria', { name: project.name, archived: isArchived ? t('dashboard.welcome.row.archivedSuffix') : '', done: stats.doneTasks, total: stats.totalTasks, issues: stats.openIssues }) : t('dashboard.welcome.row.openAriaNoStats', { name: project.name, archived: isArchived ? t('dashboard.welcome.row.archivedSuffix') : '' })}
      >
        <span className="welcome-row-main">
          <span className="welcome-row-dot" style={{ background: dotColor }} aria-hidden="true" />
          <span className="welcome-row-title" title={project.name}>
            {project.name}
          </span>
          {isArchived && <Badge tone="neutral"><span className="welcome-row-badge-archived">{t('dashboard.welcome.row.archivedBadge')}</span></Badge>}
          <span className="welcome-row-team" title={project.teamName}>
            {project.teamName}
          </span>
        </span>

        <span className="welcome-row-meta">
          {hasTasks ? (
            <span className="welcome-row-progress" title={t('dashboard.welcome.row.progressTitle', { done: stats!.doneTasks, total: stats!.totalTasks })}>
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
            <span className="welcome-row-issues tabular" title={t('dashboard.welcome.row.issuesTitle', { issues: stats!.openIssues })}>
              <Bug size={11} aria-hidden="true" />
              {stats!.openIssues}
            </span>
          )}

          {showOutdated && (
            <span className="welcome-row-outdated tabular" title={t('dashboard.welcome.row.outdatedTitle', { count: stats!.outdatedDeps })}>
              <WarningCircle size={11} aria-hidden="true" />
              {stats!.outdatedDeps}
            </span>
          )}

          {showOverdue && (
            <span className="welcome-row-overdue tabular" title={t('dashboard.welcome.row.overdueTitle', { count: (stats as ProjectStats & { overdueTasks?: number }).overdueTasks })}>
              <Clock size={11} aria-hidden="true" />
              {(stats as ProjectStats & { overdueTasks?: number }).overdueTasks}
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

          <span
            className="welcome-spark"
            aria-hidden="true"
            title={
              hasTasks
                ? `${t('dashboard.welcome.row.sparkTitle', { done: stats!.doneTasks, total: stats!.totalTasks })}${stats!.overdueTasks ? t('dashboard.welcome.row.sparkOverdue', { count: stats!.overdueTasks }) : ''}`
                : t('dashboard.welcome.row.sparkEmpty')
            }
          >
            {hasTasks
              ? Array.from({ length: 7 }, (_, i) => {
                  const seed = project.id.charCodeAt(i % project.id.length) + i * 7;
                  const base = 4 + (seed % 7);
                  const isOn = stats!.doneTasks > (i * stats!.totalTasks) / 7;
                  return <i key={i} className={isOn ? 'on' : undefined} style={{ height: base }} />;
                })
              : Array.from({ length: 7 }, (_, i) => <i key={i} style={{ height: 3, opacity: 0.15 }} />)}
          </span>

          <CaretRight size={12} weight="bold" aria-hidden="true" className="welcome-row-chevron" />
        </span>
      </button>

      {isExpandable && (
        <button
          type="button"
          className="welcome-row-expand-btn"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? t('dashboard.welcome.row.collapse') : t('dashboard.welcome.row.expand')}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          <CaretDown
            size={10}
            weight="bold"
            aria-hidden="true"
            className={expanded ? 'welcome-row-expand-icon welcome-row-expand-icon-open' : 'welcome-row-expand-icon'}
          />
          {expanded ? t('dashboard.welcome.row.less') : t('dashboard.welcome.row.more')}
        </button>
      )}

      {expanded && (
        <div className="welcome-row-expanded" id={panelId}>
          {project.description?.trim() ? (
            <p className="welcome-row-desc">{project.description}</p>
          ) : (
            <p className="welcome-row-desc welcome-row-desc-empty">{t('dashboard.welcome.row.noDesc')}</p>
          )}
          {stats?.nextMilestone && (
            <p className="welcome-row-next">
              {t('dashboard.welcome.row.nextPrefix')} <strong>{stats.nextMilestone.name}</strong>
              {stats.nextMilestone.targetDate ? t('dashboard.welcome.row.nextDate', { date: formatDate(stats.nextMilestone.targetDate) }) : ''}{t('dashboard.welcome.row.nextLeft', { count: stats.totalTasks - stats.doneTasks })}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
