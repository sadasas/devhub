import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Archive, ArrowCounterClockwise, ChartBar, PencilSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { formatHours } from '../../lib/format';
import { todayIso } from '../../lib/due-dates';
import { Avatar } from '../../components/Avatar';
import { PROJECT_STATUS, TEAM_ROLE } from '../../lib/labels';
import { TASK_PRIORITY_ORDER } from '../../lib/labels';
import { TaskPriorityIcon } from '../../lib/task-icons';
import { computeProjectStats } from '../../lib/stats';
import { PRD_SECTIONS } from '../../lib/prd';
import { MarkdownBlocks, renderInline } from '../../lib/markdown';
import type { TaskStatus, TaskPriority, IssueSeverity } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DataErrorState } from '../../components/DataErrorState';
import { Skeleton } from '../../components/Skeleton';
import { EditPrdSectionModal, type PrdEditKey } from '../project/EditPrdSectionModal';

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

function Bars({
  rows,
  formatValue,
  ariaLabel,
}: {
  rows: { label: string; value: number; color: string; tab?: string; projectId?: string; icon?: ReactNode }[];
  formatValue?: (v: number) => string;
  ariaLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const fmt = formatValue ?? ((v: number) => String(v));
  return (
    <div className="bars" role="img" aria-label={ariaLabel}>
      {rows.map((r) => {
        const row = (
          <>
            <span className="bar-label">{r.icon}{r.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
            </div>
            <span className="bar-value tabular">{fmt(r.value)}</span>
          </>
        );
        return r.tab && r.projectId ? (
          <Link
            key={r.label}
            className="bar-row bar-row-link"
            to={`/project/${encodeURIComponent(r.projectId)}?tab=${r.tab}`}
            aria-label={`${r.label}: ${fmt(r.value)}`}
          >
            {row}
          </Link>
        ) : (
          <div key={r.label} className="bar-row">
            {row}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  title,
  value,
  children,
  linkTo,
}: {
  title: string;
  value: string;
  children?: ReactNode;
  linkTo?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <h3 className="stat-card-title">{title}</h3>
        {linkTo && (
          <Link className="stat-card-link" to={linkTo}>
            &rarr;
            <span className="sr-only">{title}</span>
          </Link>
        )}
      </div>
      {value !== '' && <span className="stat-card-value">{value}</span>}
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
  avatarUrl?: string | null;
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

function MemberRow({ stat, lateHint }: { stat: MemberStat; lateHint: string }) {
  const total = stat.open + stat.done;
  const pct = total > 0 ? Math.round((stat.done / total) * 100) : 0;
  const unassigned = stat.id === null;
  return (
    <div className={`member-row${unassigned ? ' member-row-unassigned' : ''}`} role="row">
      {stat.id ? (
        <Avatar
          src={stat.avatarUrl ?? null}
          name={stat.email}
          email={stat.email}
          id={stat.id}
          size={28}
          className="member-avatar"
        />
      ) : (
        <span className="member-avatar member-avatar-unassigned" aria-hidden="true">
          —
        </span>
      )}
      <span className="member-name" title={stat.email} role="cell">
        {stat.email}
      </span>
      <div className="member-bar-wrap" role="cell">
        <MemberBars open={stat.open} done={stat.done} />
      </div>
      <span className="member-nums tabular" role="cell">
        <span>{stat.open}</span>
        <span>{stat.done}</span>
        <span>{stat.est}</span>
        <span
          className={stat.overdue > 0 ? 'member-overdue' : undefined}
          title={lateHint}
        >
          {stat.overdue}
        </span>
      </span>
      <span
        className="member-pct tabular"
        role="cell"
        title={`${stat.done}/${total}`}
      >
        {pct}%
      </span>
    </div>
  );
}

export function OverviewPage({ project }: { project: Project }) {
  const { t } = useTranslation('project');
  const { state, loading, error, loadError, canEdit, teamId, retryLoad } = useProject();
  const { update } = useProjects();
  const [editingKey, setEditingKey] = useState<PrdEditKey | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!teamId) {
      setMemberNames({});
      setMemberAvatars({});
      setMembersLoaded(true);
      return;
    }
    let cancelled = false;
    api
      .listMembers(teamId)
      .then((list) => {
        if (!cancelled) {
          setMemberNames(Object.fromEntries(list.map((m) => [m.id, m.displayName || m.email])));
          setMemberAvatars(Object.fromEntries(list.map((m) => [m.id, (m as { avatarUrl?: string | null }).avatarUrl ?? null])));
          setMembersLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMemberNames({});
          setMemberAvatars({});
          setMembersLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading) {
    return (
      <div role="status" aria-busy="true" aria-live="polite" aria-label="Loading overview">
        <span className="sr-only">Loading overview…</span>
        <div aria-hidden="true">
          <div className="data-list-header">
            <Skeleton style={{ width: 130, height: 15 }} />
          </div>
          <div className="about-hero">
            <Skeleton style={{ width: "90%", height: 14 }} />
            <p className="about-meta" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[96, 130, 130, 72, 72].map((w, i) => (
                <Skeleton key={i} style={{ width: w, height: 20, borderRadius: 999 }} />
              ))}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 22, marginTop: 16 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} style={{ height: 68, borderRadius: 12 }} />
            ))}
          </div>
          <div className="stats-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid var(--border-hairline)", borderRadius: 12 }}>
                <Skeleton style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Skeleton style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0 }} />
                      <Skeleton style={{ width: "55%", height: 11 }} />
                      <Skeleton style={{ width: 24, height: 11, marginLeft: "auto" }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="member-row member-row-head" aria-hidden="true" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 28 }} />
              <Skeleton style={{ width: 90, height: 11 }} />
              <span style={{ flex: 1 }} />
              <Skeleton style={{ width: 130, height: 11 }} />
              <Skeleton style={{ width: 36, height: 11 }} />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="member-row" style={{ gap: 12, alignItems: "center" }}>
                <Skeleton style={{ width: 28, height: 28, borderRadius: "50%" }} />
                <Skeleton style={{ width: 120, height: 14 }} />
                <div className="member-bar-track" style={{ flex: 1, display: "flex", height: 8, borderRadius: 999, overflow: "hidden" }}>
                  <Skeleton style={{ width: "45%", height: 8, borderRadius: 0 }} />
                  <Skeleton style={{ width: "30%", height: 8, borderRadius: 0 }} />
                </div>
                <span className="member-nums tabular" style={{ display: "flex", gap: 8 }}>
                  <Skeleton style={{ width: 20, height: 11 }} />
                  <Skeleton style={{ width: 20, height: 11 }} />
                  <Skeleton style={{ width: 20, height: 11 }} />
                  <Skeleton style={{ width: 20, height: 11 }} />
                </span>
                <Skeleton style={{ width: 36, height: 11 }} />
              </div>
            ))}
          </div>
          <div className="about-cards" style={{ display: "grid", gap: 12, marginTop: 22 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <section key={i} className="about-card" style={{ padding: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <Skeleton style={{ width: 14, height: 14, borderRadius: 4 }} />
                  <Skeleton style={{ width: 120, height: 13 }} />
                </div>
                <Skeleton style={{ width: "100%", height: 12 }} />
                <Skeleton style={{ width: "75%", height: 12, marginTop: 6 }} />
              </section>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <DataErrorState error={loadError ?? error} onRetry={retryLoad} />;
  }

  if (!state) return null;

  const stats = computeProjectStats(state);
  const hasChartData = state.tasks.length > 0 || state.issues.length > 0;
  const prdSetCount = PRD_SECTIONS.filter((s) => project.prd[s.key].trim()).length;

  const projectTabTo = (tab: string) => `/project/${encodeURIComponent(project.id)}?tab=${tab}`;
  const openTasks = state.tasks.filter((task) => task.status !== 'done');
  const openIssues = state.issues.filter((i) => !['resolved', 'wontfix'].includes(i.status));

  const counts = [
    {
      label: t('overview.counts.tasks'),
      value: stats.totalTasks > 0 ? `${stats.doneTasks}/${stats.totalTasks}` : '0',
      tab: 'board',
    },
    { label: t('overview.counts.openIssues'), value: String(stats.openIssues), tab: 'issues' },
    { label: t('overview.counts.overdue'), value: String(stats.overdueTasks), tab: 'board' },
    { label: t('overview.counts.outdatedDeps'), value: String(stats.outdatedDeps), tab: 'stack' },
    { label: t('overview.counts.testCases'), value: String(state.testCases.length), tab: 'tests' },
    { label: t('overview.counts.stackEntries'), value: String(state.techEntries.length), tab: 'stack' },
    { label: t('overview.counts.tables'), value: String(state.tables.length), tab: 'schema' },
    { label: t('overview.counts.decisions'), value: String(state.decisions.length), tab: 'decisions' },
    {
      label: t('overview.counts.milestones'),
      value:
        stats.totalMilestones > 0
          ? `${stats.releasedMilestones}/${stats.totalMilestones}`
          : '0',
      tab: 'releases',
    },
  ];

  const donut = STATUS_ORDER.map((s) => ({
    value: state.tasks.filter((task) => task.status === s).length,
    color: STATUS_COLOR[s],
  }));
  // Urgent-first: paling penting di atas. Hanya task open agar tim yang sudah
  // selesai tidak terlihat masih menumpuk.
  const priorityRows = [...TASK_PRIORITY_ORDER].reverse().map((p) => ({
    label: t(`overview.priority.${p}`),
    value: openTasks.filter((task) => task.priority === p).length,
    color: PRIORITY_COLOR[p],
    tab: 'board',
    projectId: project.id,
    icon: <TaskPriorityIcon priority={p} size={12} />,
  }));
  // Hanya issue open — konsisten dengan counter Open issues.
  const severityRows = SEVERITY_ORDER.map((s) => ({
    label: t(`overview.severity.${s}`),
    value: openIssues.filter((i) => i.severity === s).length,
    color: SEVERITY_COLOR[s],
    tab: 'issues',
    projectId: project.id,
  }));
  const estimateHours = Math.round(openTasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0) * 10) / 10;
  const actualHours =
    Math.round(state.tasks.reduce((sum, t) => sum + (t.actualHours ?? 0), 0) * 10) / 10;
  const variancePct =
    estimateHours > 0 ? Math.round(((actualHours - estimateHours) / estimateHours) * 100) : null;
  const varianceLabel =
    variancePct === null ? '' : ` · ${variancePct > 0 ? '+' : ''}${variancePct}%`;

  // Fallback next milestone: jangan hilang diam-diam saat paling dibutuhkan
  // (overdue / in-progress tanpa tanggal valid).
  const nowMs = Date.now();
  const overdueMilestones = state.milestones
    .filter((m) => m.status !== 'released' && m.targetDate && Date.parse(m.targetDate) < nowMs)
    .sort((a, b) => Date.parse(a.targetDate!) - Date.parse(b.targetDate!));
  const unscheduledMilestones = state.milestones.filter(
    (m) => m.status !== 'released' && !m.targetDate,
  );

  const today = todayIso();
  const memberMap = new Map<string | null, MemberStat>();
  for (const task of state.tasks) {
    const key = task.assigneeId ?? null;
    let s = memberMap.get(key);
    if (!s) {
      s = {
        id: key,
        email: key ? (memberNames[key] ?? t('overview.unknownMember')) : t('overview.unassigned'),
        avatarUrl: key ? (memberAvatars[key] ?? null) : null,
        open: 0,
        done: 0,
        est: 0,
        overdue: 0,
      };
      memberMap.set(key, s);
    }
    if (task.status === 'done') s.done += 1;
    else {
      s.open += 1;
      // Workload = sisa kerja open saja; task done tidak ikut membengkakkan est.
      s.est = Math.round((s.est + (task.estimate ?? 0)) * 10) / 10;
    }
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
      </div>

      <div className="about-hero">
        <div className="about-hero-top">
          <p className={`about-description${project.description.trim() ? '' : ' about-description-empty'}`}>
            {project.description.trim() ? renderInline(project.description) : t('overview.noDescriptionYet')}
          </p>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="about-desc-edit"
              leftIcon={<PencilSimple size={12} aria-hidden="true" />}
              onClick={() => setEditingKey('description')}
              aria-label={`${t('overview.editPrd')}: ${t('prd.titleLabel')}`}
            >
              {t('overview.editSection')}
            </Button>
          )}
        </div>
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
            <Badge tone={TEAM_ROLE[project.role].tone}>
              {t('overview.yourRole', { role: t(`overview.teamRole.${project.role}`) })}
            </Badge>
          </span>
        </p>
        {project.status === 'archived' && canEdit && (
          <div style={{ marginTop: 10 }}>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<ArrowCounterClockwise size={14} aria-hidden="true" />}
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
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Archived projects are read-only.</span>
          </div>
        )}
        {project.status === 'archived' && !canEdit && (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            <Archive size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" />
            This project is archived — read-only.
          </p>
        )}
      </div>

      <div className="about-stats">
        {counts.map((c) => (
          <Link
            key={c.label}
            className="about-stat about-stat-link"
            to={projectTabTo(c.tab)}
            aria-label={`${c.label}: ${c.value}`}
          >
            <span className="about-stat-title">{c.label}</span>
            <span className="about-stat-value">{c.value}</span>
          </Link>
        ))}
      </div>

      <section className="overview-group" aria-label={t('overview.chartsSectionAria')}>
        <OverviewGroupHead title={t('overview.chartsSectionAria')} />
        {hasChartData ? (
          <>
            <div className="stats-grid">
              <StatCard
                title={t('overview.stat.tasksByStatus')}
                value=""
                linkTo={projectTabTo('board')}
              >
                <div className="stat-body-row">
                  <div className="donut-wrap">
                    <Donut segments={donut} total={stats.totalTasks} />
                  </div>
                  <div className="chart-legend">
                    {STATUS_ORDER.map((s) => (
                      <Link
                        key={s}
                        className="legend-row legend-row-link"
                        to={projectTabTo('board')}
                        aria-label={`${t(`overview.legend.${s}`)}: ${state.tasks.filter((task) => task.status === s).length}`}
                      >
                        <span className="legend-dot" style={{ background: STATUS_COLOR[s] }} />
                        <span>{t(`overview.legend.${s}`)}</span>
                        <span className="legend-count">{state.tasks.filter((task) => task.status === s).length}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </StatCard>
              <StatCard
                title={t('overview.stat.tasksByPriority')}
                value=""
                linkTo={projectTabTo('board')}
              >
                <Bars rows={priorityRows} ariaLabel={t('overview.stat.tasksByPriority')} />
              </StatCard>
              <StatCard
                title={t('overview.stat.issuesBySeverity')}
                value=""
                linkTo={projectTabTo('issues')}
              >
                <Bars rows={severityRows} ariaLabel={t('overview.stat.issuesBySeverity')} />
              </StatCard>
              <StatCard
                title={t('overview.stat.estVsActual')}
                value={`${formatHours(actualHours)}h / ${formatHours(estimateHours)}h${varianceLabel}`}
              >
                <Bars
                  rows={[
                    { label: t('overview.stat.estimate'), value: estimateHours, color: 'var(--accent)' },
                    { label: t('overview.stat.actual'), value: actualHours, color: 'var(--status-warn)' },
                  ]}
                  formatValue={(v) => `${formatHours(v)}h`}
                  ariaLabel={t('overview.stat.estVsActual')}
                />
              </StatCard>
            </div>
            {stats.nextMilestone ? (
              <p className="stat-note">
                {t('overview.nextMilestone')} <strong>{stats.nextMilestone.name}</strong>
                {stats.nextMilestone.targetDate
                  ? ` ${t('overview.nextMilestoneDate', { date: formatDate(stats.nextMilestone.targetDate) })}`
                  : ''}
              </p>
            ) : overdueMilestones.length > 0 ? (
              <p className="stat-note stat-note-warn">
                {t('overview.overdueMilestones', { count: overdueMilestones.length })}{' '}
                <strong>{overdueMilestones[0]!.name}</strong>
              </p>
            ) : unscheduledMilestones.length > 0 ? (
              <p className="stat-note">
                {t('overview.noDatedMilestones', { count: unscheduledMilestones.length })}
              </p>
            ) : null}
          </>
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
            <div className="member-list" role="status" aria-busy="true" aria-label="Loading members">
              <span className="sr-only">Loading members…</span>
              <div aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="member-row" style={{ height: 40, gap: 12, alignItems: 'center' }}>
                    <Skeleton style={{ width: 28, height: 28, borderRadius: '50%' }} />
                    <Skeleton style={{ width: 120, height: 14 }} />
                    <Skeleton style={{ width: '40%', height: 6, borderRadius: 999 }} />
                    <Skeleton style={{ width: 44, height: 11 }} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="member-list" role="table" aria-label={t('overview.membersSectionAria')}>
              {memberStats.filter((s) => s.id !== null).length <= 1 && (
                <p className="member-small-note">{t('overview.smallTeamNote')}</p>
              )}
              <div className="member-row member-row-head" role="row">
                <span aria-hidden="true" />
                <span className="member-name" role="columnheader">{t('overview.memberHead.member')}</span>
                <div className="member-bar-wrap" aria-hidden="true" />
                <span className="member-nums tabular" role="columnheader">
                  <span>{t('overview.memberHead.open')}</span>
                  <span>{t('overview.memberHead.done')}</span>
                  <span>{t('overview.memberHead.estHours')}</span>
                  <span title={t('overview.lateHint')}>{t('overview.memberHead.late')}</span>
                </span>
                <span className="member-pct tabular" role="columnheader">{t('overview.memberHead.pctDone')}</span>
              </div>
              {memberStats.map((s) => (
                <MemberRow key={s.id ?? 'unassigned'} stat={s} lateHint={t('overview.lateHint')} />
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
                <div className="about-card-head">
                  <h3 className="section-title">
                    <s.icon size={14} weight="bold" aria-hidden="true" />
                    {t(`prd.section.${s.key}.label`)}
                  </h3>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="about-card-edit"
                      leftIcon={<PencilSimple size={12} aria-hidden="true" />}
                      onClick={() => setEditingKey(s.key)}
                      aria-label={`${t('overview.editPrd')}: ${t(`prd.section.${s.key}.label`)}`}
                    >
                      {t('overview.editSection')}
                    </Button>
                  )}
                </div>
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

      <EditPrdSectionModal
        open={editingKey !== null}
        section={editingKey ?? 'description'}
        onClose={() => setEditingKey(null)}
        project={project}
      />
    </div>
  );
}