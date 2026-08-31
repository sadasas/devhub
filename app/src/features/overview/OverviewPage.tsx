import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Archive, ArrowCounterClockwise, ChartBar, PencilSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { formatHours } from '../../lib/format';
import { todayIso } from '../../lib/due-dates';
import { avatarColor, initialsOf } from '../../lib/avatar';
import { PROJECT_STATUS, TEAM_ROLE } from '../../lib/labels';
import { TASK_PRIORITY_ORDER } from '../../lib/labels';
import { computeProjectStats } from '../../lib/stats';
import { PRD_SECTIONS } from '../../lib/prd';
import { MarkdownBlocks, renderInline } from '../../lib/markdown';
import type { TaskStatus, TaskPriority, IssueSeverity } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { EditPrdModal } from '../project/EditPrdModal';

const STATUS_ORDER: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];
const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: 'var(--text-muted)',
  inProgress: 'var(--status-info)',
  review: 'var(--status-warn)',
  done: 'var(--status-success)',
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: 'var(--status-danger)',
  high: 'var(--status-warn)',
  medium: 'var(--status-info)',
  low: 'var(--text-muted)',
};

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  critical: 'var(--status-danger)',
  high: 'var(--status-warn)',
  medium: 'var(--status-info)',
  low: 'var(--text-muted)',
};

function Donut({ segments, total }: { segments: { value: number; color: string }[]; total: number }) {
  const { t } = useTranslation('project');
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" className="chart" role="img" aria-label={t('overview.donutAria')}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-inset)" strokeWidth="14" />
      {total > 0 &&
        segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 50 50)"
            />
          );
          acc += len;
          return el;
        })}
      <text x="50" y="47" textAnchor="middle" className="donut-total">
        {total}
      </text>
      <text x="50" y="61" textAnchor="middle" className="donut-label">
        {t('overview.donutUnit')}
      </text>
    </svg>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} className="bar-row">
          <span className="bar-label">{r.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
          <span className="bar-value">{formatHours(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, children }: { title: string; value: string; children?: ReactNode }) {
  return (
    <div className="stat-card">
      <h3 className="stat-card-title">{title}</h3>
      <span className="stat-card-value">{value}</span>
      {children}
    </div>
  );
}

function OverviewGroupHead({ title, count }: { title: string; count?: string }) {
  return (
    <div className="overview-group-head">
      <h2 className="overview-group-title">{title}</h2>
      {count && <span className="overview-group-count">{count}</span>}
    </div>
  );
}

interface MemberStat {
  id: string | null;
  email: string;
  open: number;
  done: number;
  est: number;
  overdue: number;
}

function MemberBars({ open, done }: { open: number; done: number }) {
  const { t } = useTranslation('project');
  const total = open + done;
  const openPct = total > 0 ? (open / total) * 100 : 0;
  const donePct = total > 0 ? (done / total) * 100 : 0;
  return (
    <div
      className="member-bar-track"
      role="img"
      aria-label={t('overview.memberBarAria', { open, done })}
      title={t('overview.memberBarTitle', { open, done })}
    >
      <div
        className="member-bar-fill member-bar-open"
        style={{ width: `${openPct}%`, minWidth: open > 0 ? 2 : 0 }}
      />
      <div
        className="member-bar-fill member-bar-done"
        style={{ width: `${donePct}%`, minWidth: done > 0 ? 2 : 0 }}
      />
    </div>
  );
}

function MemberRow({ stat }: { stat: MemberStat }) {
  const total = stat.open + stat.done;
  const pct = total > 0 ? Math.round((stat.done / total) * 100) : 0;
  const unassigned = stat.id === null;
  return (
    <div className={`member-row${unassigned ? ' member-row-unassigned' : ''}`}>
      {stat.id ? (
        <span className="member-avatar" style={{ backgroundColor: avatarColor(stat.id) }} aria-hidden="true">
          {initialsOf(stat.email)}
        </span>
      ) : (
        <span className="member-avatar member-avatar-unassigned" aria-hidden="true">
          —
        </span>
      )}
      <span className="member-name" title={stat.email}>
        {stat.email}
      </span>
      <div className="member-bar-wrap">
        <MemberBars open={stat.open} done={stat.done} />
      </div>
      <span className="member-nums tabular">
        <span>{stat.open}</span>
        <span>{stat.done}</span>
        <span>{stat.est}</span>
        <span className={stat.overdue > 0 ? 'member-overdue' : undefined}>{stat.overdue}</span>
      </span>
      <span className="member-pct tabular">{pct}%</span>
    </div>
  );
}

export function OverviewPage({ project }: { project: Project }) {
  const { t } = useTranslation('project');
  const { state, loading, error, canEdit, teamId } = useProject();
  const { update } = useProjects();
  const [editOpen, setEditOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!teamId) {
      setMemberNames({});
      setMembersLoaded(true);
      return;
    }
    let cancelled = false;
    api
      .listMembers(teamId)
      .then((list) => {
        if (!cancelled) {
          setMemberNames(Object.fromEntries(list.map((m) => [m.id, m.displayName || m.email])));
          setMembersLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMemberNames({});
          setMembersLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading) {
    return (
      <div aria-hidden="true">
        <Skeleton style={{ width: 220, height: 20, marginBottom: 16 }} />
        <Skeleton style={{ width: '100%', height: 14, marginBottom: 8 }} />
        <Skeleton style={{ width: '70%', height: 14, marginBottom: 24 }} />
        <div className="stats-grid">
          <Skeleton className="data-row" />
          <Skeleton className="data-row" />
          <Skeleton className="data-row" />
          <Skeleton className="data-row" />
        </div>
        <Skeleton style={{ width: '100%', height: 200, marginTop: 22 }} />
      </div>
    );
  }

  if (error) {
    return <InlineError>{error}</InlineError>;
  }

  if (!state) return null;

  const stats = computeProjectStats(state);
  const hasChartData = state.tasks.length > 0 || state.issues.length > 0;
  const prdSetCount = PRD_SECTIONS.filter((s) => project.prd[s.key].trim()).length;

  const counts = [
    {
      label: t('overview.counts.tasks'),
      value: stats.totalTasks > 0 ? `${stats.doneTasks}/${stats.totalTasks}` : '0',
    },
    { label: t('overview.counts.openIssues'), value: String(stats.openIssues) },
    { label: t('overview.counts.outdatedDeps'), value: String(stats.outdatedDeps) },
    { label: t('overview.counts.testCases'), value: String(state.testCases.length) },
    { label: t('overview.counts.stackEntries'), value: String(state.techEntries.length) },
    { label: t('overview.counts.tables'), value: String(state.tables.length) },
    { label: t('overview.counts.decisions'), value: String(state.decisions.length) },
    {
      label: t('overview.counts.milestones'),
      value:
        stats.totalMilestones > 0
          ? `${stats.releasedMilestones}/${stats.totalMilestones}`
          : '0',
    },
  ];

  const donut = STATUS_ORDER.map((s) => ({
    value: state.tasks.filter((task) => task.status === s).length,
    color: STATUS_COLOR[s],
  }));
  const priorityRows = TASK_PRIORITY_ORDER.map((p) => ({
    label: t(`overview.priority.${p}`),
    value: state.tasks.filter((task) => task.priority === p).length,
    color: PRIORITY_COLOR[p],
  }));
  const severityRows = SEVERITY_ORDER.map((s) => ({
    label: t(`overview.severity.${s}`),
    value: state.issues.filter((i) => i.severity === s).length,
    color: SEVERITY_COLOR[s],
  }));
  const estimateHours = Math.round(state.tasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0) * 10) / 10;
  const actualHours = Math.round(state.tasks.reduce((sum, t) => sum + (t.actualHours ?? 0), 0) * 10) / 10;

  const today = todayIso();
  const memberMap = new Map<string | null, MemberStat>();
  for (const task of state.tasks) {
    const key = task.assigneeId ?? null;
    let s = memberMap.get(key);
    if (!s) {
      s = {
        id: key,
        email: key ? (memberNames[key] ?? t('overview.unknownMember')) : t('overview.unassigned'),
        open: 0,
        done: 0,
        est: 0,
        overdue: 0,
      };
      memberMap.set(key, s);
    }
    if (task.status === 'done') s.done += 1;
    else s.open += 1;
    s.est += task.estimate ?? 0;
    if (task.dueDate && task.status !== 'done' && task.dueDate < today) s.overdue += 1;
  }
  const memberStats = [...memberMap.values()].sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return b.open - a.open;
  });

  return (
    <div className="about-body">
      <div className="data-list-header">
        <span className="data-list-count">{t('overview.heading')}</span>
        {canEdit && (
          <Button
            size="sm"
            leftIcon={<PencilSimple size={13} aria-hidden="true" />}
            onClick={() => setEditOpen(true)}
          >
            {t('overview.editPrd')}
          </Button>
        )}
      </div>

      <div className="about-hero">
        <p className={`about-description${project.description.trim() ? '' : ' about-description-empty'}`}>
          {project.description.trim() ? renderInline(project.description) : t('overview.noDescriptionYet')}
        </p>
        <p className="about-meta">
          <span className="about-meta-chip">{t('overview.teamChip', { name: project.teamName })}</span>
          <span className="about-meta-chip">{t('overview.createdChip', { date: formatDate(project.createdAt) })}</span>
          <span className="about-meta-chip">{t('overview.updatedChip', { date: formatDate(project.updatedAt) })}</span>
          <span className="about-meta-chip">
            <Badge tone={PROJECT_STATUS[project.status].tone}>
              {project.status === 'active' ? t('overview.projectStatus.active') : t('overview.projectStatus.archived')}
            </Badge>
          </span>
          <span className="about-meta-chip">
            <Badge tone={TEAM_ROLE[project.role].tone}>{t(`overview.teamRole.${project.role}`)}</Badge>
          </span>
        </p>
        {project.status === 'archived' && canEdit && (
          <div style={{ marginTop: 10 }}>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<ArrowCounterClockwise size={13} aria-hidden="true" />}
              loading={restoring}
              onClick={async () => {
                setRestoring(true);
                try {
                  await update(project.id, { status: 'active' });
                } finally {
                  setRestoring(false);
                }
              }}
            >
              Restore project
            </Button>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>Archived projects are read-only.</span>
          </div>
        )}
        {project.status === 'archived' && !canEdit && (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            <Archive size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" />
            This project is archived — read-only.
          </p>
        )}
      </div>

      <div className="about-stats">
        {counts.map((c) => (
          <div key={c.label} className="about-stat">
            <span className="about-stat-title">{c.label}</span>
            <span className="about-stat-value">{c.value}</span>
          </div>
        ))}
      </div>

      <section className="overview-group" aria-label={t('overview.chartsSectionAria')}>
        <OverviewGroupHead title={t('overview.chartsSectionAria')} />
        {hasChartData ? (
          <div className="stats-grid">
            <StatCard title={t('overview.stat.tasksByStatus')} value="">
              <div className="stat-body-row">
                <div className="donut-wrap">
                  <Donut segments={donut} total={stats.totalTasks} />
                </div>
                <div className="chart-legend">
                  {STATUS_ORDER.map((s) => (
                    <div key={s} className="legend-row">
                      <span className="legend-dot" style={{ background: STATUS_COLOR[s] }} />
                      <span>{t(`overview.legend.${s}`)}</span>
                      <span className="legend-count">{state.tasks.filter((task) => task.status === s).length}</span>
                    </div>
                  ))}
                </div>
              </div>
            </StatCard>
            <StatCard title={t('overview.stat.tasksByPriority')} value="">
              <Bars rows={priorityRows} />
            </StatCard>
            <StatCard title={t('overview.stat.issuesBySeverity')} value="">
              <Bars rows={severityRows} />
            </StatCard>
            <StatCard title={t('overview.stat.estVsActual')} value={`${formatHours(actualHours)}h / ${formatHours(estimateHours)}h`}>
              <Bars
                rows={[
                  { label: t('overview.stat.estimate'), value: estimateHours, color: 'var(--accent)' },
                  { label: t('overview.stat.actual'), value: actualHours, color: 'var(--status-warn)' },
                ]}
              />
            </StatCard>
            {stats.nextMilestone && (
              <p className="stat-note">
                {t('overview.nextMilestone')} <strong>{stats.nextMilestone.name}</strong>
                {stats.nextMilestone.targetDate
                  ? ` ${t('overview.nextMilestoneDate', { date: formatDate(stats.nextMilestone.targetDate) })}`
                  : ''}
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            icon={<ChartBar size={22} />}
            title={t('overview.chartsEmptyTitle')}
            description={t('overview.chartsEmptyDesc')}
          />
        )}
      </section>

      {state.tasks.length > 0 && (
        <section className="overview-group" aria-label={t('overview.membersSectionAria')}>
          <OverviewGroupHead title={t('overview.membersTitle')} count={t('overview.assignedCount', { count: memberStats.filter((s) => s.id !== null).length })} />
          {!membersLoaded ? (
            <div className="member-list" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="member-row">
                  <Skeleton className="skeleton-row" style={{ width: 120, height: 14 }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="member-list">
              <div className="member-row member-row-head" aria-hidden="true">
                <span aria-hidden="true" />
                <span className="member-name">{t('overview.memberHead.member')}</span>
                <div className="member-bar-wrap" />
                <span className="member-nums tabular">
                  <span>{t('overview.memberHead.open')}</span>
                  <span>{t('overview.memberHead.done')}</span>
                  <span>{t('overview.memberHead.estHours')}</span>
                  <span>{t('overview.memberHead.late')}</span>
                </span>
                <span className="member-pct tabular">{t('overview.memberHead.pctDone')}</span>
              </div>
              {memberStats.map((s) => (
                <MemberRow key={s.id ?? 'unassigned'} stat={s} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="overview-group" aria-label={t('overview.briefSectionAria')}>
        <OverviewGroupHead title={t('overview.briefTitle')} count={t('overview.briefCount', { set: prdSetCount, total: PRD_SECTIONS.length })} />
        <div className="about-cards">
          {PRD_SECTIONS.map((s) => {
            const value = project.prd[s.key];
            return (
              <section key={s.key} className="about-card">
                <h3 className="about-card-head">
                  <s.icon size={14} weight="bold" aria-hidden="true" />
                  <span className="about-card-title">{t(`prd.section.${s.key}.label`)}</span>
                </h3>
                {value.trim() ? (
                  <div className="about-card-body">
                    <MarkdownBlocks text={value} />
                  </div>
                ) : (
                  <p className="about-card-empty">{t('overview.notSetYet')}</p>
                )}
              </section>
            );
          })}
        </div>
      </section>

      <EditPrdModal open={editOpen} onClose={() => setEditOpen(false)} project={project} />
    </div>
  );
}