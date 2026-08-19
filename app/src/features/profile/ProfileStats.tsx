import { useEffect, useMemo, useState } from 'react';
import {
  Bug,
  CalendarBlank,
  CheckCircle,
  Flame,
  Trophy,
} from '@phosphor-icons/react';
import { api } from '../../lib/api';
import type { ActivityDay, UserStats } from '../../lib/types';
import { Skeleton } from '../../components/Skeleton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LEVEL_STEPS = [
  { min: 1, level: 1 },
  { min: 2, level: 2 },
  { min: 4, level: 3 },
  { min: 7, level: 4 },
];

function levelOf(count: number): number {
  if (count <= 0) return 0;
  let level = 1;
  for (const step of LEVEL_STEPS) {
    if (count >= step.min) level = step.level;
  }
  return level;
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

type Cell = ActivityDay | null;

function buildWeeks(days: ActivityDay[]): Cell[][] {
  if (days.length === 0) return [];
  const first = new Date(`${days[0]!.date}T00:00:00`);
  const pad = first.getDay();
  const weeks: Cell[][] = [];
  let week: Cell[] = [];
  for (let i = 0; i < pad; i += 1) week.push(null);
  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function weekMonthKey(week: Cell[]): string | null {
  const first = week.find((c) => c !== null);
  if (!first) return null;
  const d = new Date(`${first.date}T00:00:00`);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function ContributionHeatmap({ days }: { days: ActivityDay[] }) {
  const weeks = useMemo(() => buildWeeks(days), [days]);
  const monthLabels = useMemo(() => {
    let prevKey: string | null = null;
    return weeks.map((week) => {
      const key = weekMonthKey(week);
      if (key === null || key === prevKey) return null;
      prevKey = key;
      const d = new Date(`${week.find((c) => c !== null)!.date}T00:00:00`);
      return MONTHS[d.getMonth()];
    });
  }, [weeks]);

  const dayLabels = ['Mon', 'Wed', 'Fri'];

  return (
    <div className="profile-heat-layout">
      <div className="profile-heat-days" aria-hidden="true">
        {Array.from({ length: 7 }, (_, row) => (
          <span key={row} className="profile-heat-daylabel">
            {dayLabels[row] ?? ''}
          </span>
        ))}
      </div>
      <div className="profile-heat-main">
        <div className="profile-heat-months" aria-hidden="true">
          {monthLabels.map((label, i) => (
            <span key={i} className="profile-heat-month">
              {label}
            </span>
          ))}
        </div>
        <div
          className="profile-heat-grid"
          role="grid"
          aria-label="Contribution activity in the last year"
        >
          {weeks.map((week, w) =>
            week.map((cell, r) => {
              if (!cell) {
                return <span key={`${w}-${r}`} className="profile-heat-cell" data-level="0" />;
              }
              const level = levelOf(cell.count);
              const contributions = cell.count === 1 ? '1 contribution' : `${cell.count} contributions`;
              return (
                <button
                  key={`${w}-${r}`}
                  type="button"
                  className="profile-heat-cell"
                  data-level={level}
                  role="gridcell"
                  tabIndex={0}
                  aria-label={`${contributions} on ${dayLabel(cell.date)}`}
                  title={`${contributions} on ${dayLabel(cell.date)}`}
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  suffix,
  loading,
  error,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  loading: boolean;
  error: boolean;
}) {
  return (
    <div className="profile-github-stat">
      <span className="profile-github-stat-label">
        {icon}
        {label}
      </span>
      {loading ? (
        <Skeleton className="skeleton-row-sm" style={{ width: 40, height: 22 }} />
      ) : (
        <span className="profile-github-stat-value">
          {error ? '—' : `${value}${suffix ?? ''}`}
        </span>
      )}
    </div>
  );
}

export function ProfileStats() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .meStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = stats === null && !error;

  return (
    <section className="profile-heat" aria-label="GitHub-style activity stats">
      <div className="profile-heat-head">
        <p className="profile-heat-total">
          {loading ? (
            <Skeleton className="skeleton-row" style={{ width: 220, height: 18 }} />
          ) : error ? (
            <span>Contributions unavailable</span>
          ) : (
            <>
              <strong className="profile-heat-count">{stats!.totalContributions}</strong>{' '}
              contributions in the last year
            </>
          )}
        </p>
      </div>

      {error ? null : loading ? (
        <div className="profile-heat-skeleton" aria-hidden="true">
          <Skeleton className="skeleton-row" style={{ width: '100%', height: 112 }} />
        </div>
      ) : (
        <ContributionHeatmap days={stats!.days} />
      )}

      {!loading && !error && (
        <div className="profile-heat-foot" aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="profile-heat-legend-cell" data-level={l} />
          ))}
          <span>More</span>
        </div>
      )}

      <div className="profile-github-stats">
        <StatTile
          icon={<CheckCircle size={15} weight="duotone" aria-hidden="true" />}
          label="Tasks completed"
          value={stats?.taskCompletions ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Bug size={15} weight="duotone" aria-hidden="true" />}
          label="Issues resolved"
          value={stats?.issuesResolved ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<CalendarBlank size={15} weight="duotone" aria-hidden="true" />}
          label="Active days"
          value={stats?.activeDays ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Flame size={15} weight="duotone" aria-hidden="true" />}
          label="Current streak"
          value={stats?.currentStreak ?? 0}
          suffix="d"
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Trophy size={15} weight="duotone" aria-hidden="true" />}
          label="Longest streak"
          value={stats?.longestStreak ?? 0}
          suffix="d"
          loading={loading}
          error={error}
        />
      </div>
    </section>
  );
}