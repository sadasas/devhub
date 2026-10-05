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
import { SearchableSelect } from '../../components/SearchableSelect';
import { Tooltip } from '../../components/Tooltip';

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

export interface HeatSemester {
  year: number;
  half: 1 | 2;
}

export function currentSemester(now = new Date()): HeatSemester {
  return { year: now.getFullYear(), half: now.getMonth() < 6 ? 1 : 2 };
}

export function prevSemester(sem: HeatSemester): HeatSemester {
  return sem.half === 2 ? { year: sem.year, half: 1 } : { year: sem.year - 1, half: 2 };
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

  /* Grid Minggu-dulu (baris 0 = Minggu): label di baris 1/3/5. */

  const dayLabels = ['', t('profile.days.mon'), '', t('profile.days.wed'), '', t('profile.days.fri'), ''];

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
            role="img"
            aria-label={t('profile.heat.gridAria')}
          >
            {weeks.map((week, w) =>
              week.map((cell, r) => {
                const key = `${w}-${r}`;
                /* Sel padding (null) polos; sel nol ikut tooltip "0 kontribusi". */
                if (!cell) {
                  return (
                    <span
                      key={key}
                      className="profile-heat-cell"
                      data-level={0}
                      aria-hidden="true"
                    />
                  );
                }
                return (
                  <Tooltip
                    key={key}
                    title={t('profile.heat.cellAria', {
                      contributions: t('profile.heat.contributions', { count: cell.count }),
                      date: new Date(`${cell.date}T00:00:00`).toLocaleDateString(),
                    })}
                  >
                    <span
                      className="profile-heat-cell"
                      data-level={levelOf(cell.count)}
                      aria-hidden="true"
                    />
                  </Tooltip>
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

  /* Opsi T: semester kalender dari server (?semester=) — semua angka
     (total, tiles, streak) sudah scoped, tak ada olah klien. */
  const today = useMemo(() => new Date(), []);
  const curSemester = useMemo(() => currentSemester(today), [today]);
  const [semOverride, setSemOverride] = useState<HeatSemester | null>(null);
  const semester = semOverride ?? curSemester;
  const semValue = `${semester.year}-H${semester.half}`;

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setError(false);
    api
      .meStats(semValue)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [semValue]);

  const loading = stats === null && !error;

  const semName = t(semester.half === 1 ? 'profile.semester.h1' : 'profile.semester.h2');
  const semOptions = useMemo(
    () =>
      [curSemester, prevSemester(curSemester)].map((sem) => ({
        value: `${sem.year}-H${sem.half}`,
        label: `${sem.year} · ${t(sem.half === 1 ? 'profile.semester.h1' : 'profile.semester.h2')}`,
      })),
    [curSemester, t],
  );

  return (
    <section className="profile-heat" aria-label={t('profile.activity.sectionAria')}>
      <div className="profile-heat-head">
        <div className="profile-heat-total">
          {loading ? (
            <Skeleton className="skeleton-row" style={{ width: 220, height: 18 }} />
          ) : error ? (
            <span>{t('profile.activity.unavailable')}</span>
          ) : (
            <>
              <strong className="profile-heat-count">{stats!.totalContributions}</strong>{' '}
              {t('profile.heat.semesterTotal', { semester: semName, year: semester.year })}
            </>
          )}
        </div>
        {!loading && !error ? (
          <div className="profile-heat-semselect">
            <SearchableSelect
              id="profile-heat-semester"
              ariaLabel={t('profile.semester.label')}
              value={semValue}
              options={semOptions}
              allowEmpty={false}
              searchable={false}
              onChange={(v) => {
                const m = /^(\d+)-H([12])$/.exec(v ?? '');
                const yearRaw = m?.[1];
                const halfRaw = m?.[2];
                if (yearRaw !== undefined && (halfRaw === '1' || halfRaw === '2')) {
                  setSemOverride({ year: Number(yearRaw), half: halfRaw === '1' ? 1 : 2 });
                }
              }}
            />
          </div>
        ) : null}
      </div>

      {error ? null : loading ? (
        <div className="profile-heat-skeleton" role="status" aria-live="polite" aria-busy="true" aria-label="Loading heatmap">
          <span className="sr-only">Loading heatmap…</span>
          <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(26, 10px)', gap: 4, overflow: 'hidden', height: 84 }}>
            {Array.from({ length: 26 * 7 }).map((_, i) => (
              <Skeleton key={i} style={{ width: 10, height: 10, borderRadius: 4, opacity: 0.5 + (i % 7) * 0.07 }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8, opacity: 0.6 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} style={{ width: 28, height: 6, borderRadius: 4 }} />
            ))}
          </div>
        </div>
      ) : (
        <ContributionHeatmap days={stats?.days ?? []} />
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
        {!loading && !error ? (
          <p className="field-helper profile-heat-scope">{t('profile.activity.scopeNote')}</p>
        ) : null}
        <StatTile
          icon={<CheckCircle size={16} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.tasksCompleted')}
          value={stats?.taskCompletions ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Bug size={16} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.issuesResolved')}
          value={stats?.issuesResolved ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<CalendarBlank size={16} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.activeDays')}
          value={stats?.activeDays ?? 0}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Flame size={16} weight="duotone" aria-hidden="true" />}
          label={t('profile.activity.currentStreak')}
          value={stats?.currentStreak ?? 0}
          suffix={t('profile.activity.streakSuffix')}
          loading={loading}
          error={error}
        />
        <StatTile
          icon={<Trophy size={16} weight="duotone" aria-hidden="true" />}
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