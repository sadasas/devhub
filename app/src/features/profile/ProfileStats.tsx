import { useEffect, useMemo, useState } from 'react';
import {
  Bug,
  CalendarBlank,
  CheckCircle,
  Flame,
  Trophy,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { ActivityDay, UserStats } from '../../lib/types';
import { Skeleton } from '../../components/Skeleton';

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

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
  const { t } = useTranslation('account');
  const weeks = useMemo(() => buildWeeks(days), [days]);
  const monthLabels = useMemo(() => {
    let prevKey: string | null = null;
    return weeks.map((week) => {
      const key = weekMonthKey(week);
      if (key === null || key === prevKey) return null;
      prevKey = key;
      const d = new Date(`${week.find((c) => c !== null)!.date}T00:00:00`);
      return t(`profile.months.${MONTH_KEYS[d.getMonth()]}`);
    });
  }, [weeks, t]);

  const dayLabels = [t('profile.days.mon'), t('profile.days.wed'), t('profile.days.fri')];

  function dayLabel(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    return `${t(`profile.months.${MONTH_KEYS[d.getMonth()]}`)} ${d.getDate()}, ${d.getFullYear()}`;
  }

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
          aria-label={t('profile.heat.gridAria')}
        >
          {weeks.map((week, w) =>
            week.map((cell, r) => {
              if (!cell) {
                return <span key={`${w}-${r}`} className="profile-heat-cell" data-level="0" />;
              }
              const level = levelOf(cell.count);
              const contributions = t('profile.heat.contributions', { count: cell.count });
              const cellLabel = t('profile.heat.cellAria', {
                contributions,
                date: dayLabel(cell.date),
              });
              return (
                <button
                  key={`${w}-${r}`}
                  type="button"
                  className="profile-heat-cell"
                  data-level={level}
                  role="gridcell"
                  tabIndex={0}
                  aria-label={cellLabel}
                  title={cellLabel}
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
  const { t } = useTranslation('account');
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
    <section className="profile-heat" aria-label={t('profile.activity.sectionAria')}>
      <div className="profile-heat-head">
        <p className="profile-heat-total">
          {loading ? (
            <Skeleton className="skeleton-row" style={{ width: 220, height: 18 }} />
          ) : error ? (
            <span>{t('profile.activity.unavailable')}</span>
          ) : (
            <>
              <strong className="profile-heat-count">{stats!.totalContributions}</strong>{' '}
              {t('profile.activity.totalSuffix')}
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
          <span>{t('profile.heat.less')}</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="profile-heat-legend-cell" data-level={l} />
          ))}
          <span>{t('profile.heat.more')}</span>
        </div>
      )}

      <div className="profile-github-stats">
        <StatTile
          icon={<CheckCircle size={15} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.tasksCompleted')}
          value={stats?.taskCompletions ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Bug size={15} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.issuesResolved')}
          value={stats?.issuesResolved ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<CalendarBlank size={15} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.activeDays')}
          value={stats?.activeDays ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Flame size={15} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.currentStreak')}
          value={stats?.currentStreak ?? 0}
          suffix={t('profile.activity.streakSuffix')}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Trophy size={15} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.longestStreak')}
          value={stats?.longestStreak ?? 0}
          suffix={t('profile.activity.streakSuffix')}
          loading={loading}
          error={error}
        />
      </div>
    </section>
  );
}