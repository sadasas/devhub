import type { ReactNode } from 'react';
import { useProject } from '../../state/project-context';
import { Skeleton } from '../../components/Skeleton';
import { TASK_STATUS, TASK_PRIORITY, ISSUE_SEVERITY } from '../../lib/labels';
import { computeProjectStats } from '../../lib/stats';
import { formatDate } from '../../lib/utils';
import type { TaskStatus, TaskPriority, IssueSeverity } from '../../lib/types';
import { InlineError } from '../../components/InlineError';

const STATUS_ORDER: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];
const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
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
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" className="chart" role="img" aria-label="Tasks by status">
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
        tasks
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
          <span className="bar-value">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, children }: { title: string; value: string; children?: ReactNode }) {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <span className="stat-card-title">{title}</span>
        <span className="stat-card-value">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function StatsPage() {
  const { state, loading, error } = useProject();

  if (loading) {
    return (
      <div className="stats-grid" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="data-row" />
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

  const stats = computeProjectStats(state);
  const donut = STATUS_ORDER.map((s) => ({
    value: state.tasks.filter((t) => t.status === s).length,
    color: STATUS_COLOR[s],
  }));
  const priorityRows = PRIORITY_ORDER.map((p) => ({
    label: TASK_PRIORITY[p].label,
    value: state.tasks.filter((t) => t.priority === p).length,
    color: PRIORITY_COLOR[p],
  }));
  const severityRows = SEVERITY_ORDER.map((s) => ({
    label: ISSUE_SEVERITY[s].label,
    value: state.issues.filter((i) => i.severity === s).length,
    color: SEVERITY_COLOR[s],
  }));
  const estimateHours = state.tasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0);
  const actualHours = state.tasks.reduce((sum, t) => sum + (t.actualHours ?? 0), 0);

  return (
    <div className="stats-grid">
      <StatCard title="Tasks completed" value={`${stats.doneTasks}/${stats.totalTasks}`} />
      <StatCard title="Open issues" value={String(stats.openIssues)} />
      <StatCard title="Outdated deps" value={String(stats.outdatedDeps)} />
      <StatCard title="Milestones released" value={`${stats.releasedMilestones}/${stats.totalMilestones}`} />
      <StatCard title="Tasks by status" value="">
        <div className="stat-body-row">
          <div className="donut-wrap">
            <Donut segments={donut} total={stats.totalTasks} />
          </div>
          <div className="chart-legend">
            {STATUS_ORDER.map((s) => (
              <div key={s} className="legend-row">
                <span className="legend-dot" style={{ background: STATUS_COLOR[s] }} />
                <span>{TASK_STATUS[s].label}</span>
                <span className="legend-count">{state.tasks.filter((t) => t.status === s).length}</span>
              </div>
            ))}
          </div>
        </div>
      </StatCard>
      <StatCard title="Tasks by priority" value="">
        <Bars rows={priorityRows} />
      </StatCard>
      <StatCard title="Issues by severity" value="">
        <Bars rows={severityRows} />
      </StatCard>
      <StatCard title="Estimated vs actual hours" value={`${actualHours}h / ${estimateHours}h`}>
        <Bars
          rows={[
            { label: 'Estimate', value: estimateHours, color: 'var(--accent)' },
            { label: 'Actual', value: actualHours, color: 'var(--status-warn)' },
          ]}
        />
      </StatCard>
      {stats.nextMilestone && (
        <p className="stat-note">
          Next milestone: <strong>{stats.nextMilestone.name}</strong>
          {stats.nextMilestone.targetDate ? ` · ${formatDate(stats.nextMilestone.targetDate)}` : ''}
        </p>
      )}
    </div>
  );
}
