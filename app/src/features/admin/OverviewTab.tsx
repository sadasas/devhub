import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChartLine,
  CurrencyCircleDollar,
  FolderSimple,
  Key,
  Receipt,
  ShieldCheck,
  UsersThree,
  Warning,
} from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminActivityChart, AdminCharts, AdminStats } from '../../lib/types';
import { formatIdr } from '../../lib/format';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { BarChart, CHART_COLORS, Donut, StatCard, VerticalBarChart } from './charts';

const ACTIVITY_RANGES = ['1d', '7d', '1m', '6m', '12m'] as const;

interface OverviewTabProps {
  refreshKey: number;
  onSettled?: () => void;
}

export function OverviewTab({ refreshKey, onSettled }: OverviewTabProps) {
  const { t } = useTranslation('extras');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [charts, setCharts] = useState<AdminCharts | null>(null);
  const [activityRange, setActivityRange] = useState('7d');
  const [activityChart, setActivityChart] = useState<AdminActivityChart[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const pendingSettled = useRef(0);

  const loadOverview = useCallback(async () => {
    pendingSettled.current += 1;
    setStatsError(null);
    try {
      const [s, c] = await Promise.all([api.adminStats(), api.adminStatsCharts()]);
      setStats(s);
      setCharts(c);
    } catch (err) {
      setStatsError(getErrorMessage(err, t('admin.overview.errors.stats')));
    } finally {
      pendingSettled.current -= 1;
      if (pendingSettled.current <= 0) {
        pendingSettled.current = 0;
        onSettled?.();
      }
    }
  }, [t, onSettled]);

  const loadActivityChart = useCallback(async () => {
    pendingSettled.current += 1;
    setActivityError(null);
    try {
      const a = await api.adminStatsActivity(activityRange);
      setActivityChart(a);
    } catch (err) {
      setActivityError(getErrorMessage(err, t('admin.overview.errors.stats')));
    } finally {
      pendingSettled.current -= 1;
      if (pendingSettled.current <= 0) {
        pendingSettled.current = 0;
        onSettled?.();
      }
    }
  }, [activityRange, t, onSettled]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, refreshKey]);

  useEffect(() => {
    void loadActivityChart();
  }, [loadActivityChart, refreshKey]);

  return (
    <section className="tab-panel" aria-label={t('admin.overview.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {stats === null ? t('admin.loading') : t('admin.overview.loaded')}
      </p>
      {statsError && stats === null ? (
        <InlineError className="mb-12">
          {statsError}{' '}
          <Button variant="ghost" size="sm" onClick={() => void loadOverview()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : (
        <>
          {statsError && stats !== null && (
            <InlineError className="mb-12">
              {statsError}{' '}
              <Button variant="ghost" size="sm" onClick={() => void loadOverview()}>
                {t('admin.retry')}
              </Button>
            </InlineError>
          )}

          {/* Banner conditional: pendingPayments > 0 — quick action */}
          {stats && stats.pendingPayments > 0 && (
            <div className="admin-alert-banner" role="alert">
              <span className="admin-alert-banner-icon" aria-hidden="true">
                <Warning size={18} weight="duotone" />
              </span>
              <span className="admin-alert-banner-main">
                <span className="admin-alert-banner-title">
                  {t('admin.banner.pendingTitle', { count: stats.pendingPayments })}
                </span>
                <span className="admin-alert-banner-desc">{t('admin.banner.pendingDesc')}</span>
              </span>
              <a
                href="?tab=payments&status=pending"
                className="btn btn-ghost btn-sm admin-alert-banner-action"
              >
                {t('admin.banner.pendingAction')}
              </a>
            </div>
          )}

          {/* Seksi B: Keuangan & Monetisasi — hero */}
          <h2 className="admin-section-title">{t('admin.sections.finance')}</h2>
          <div className="admin-kpi-hero">
            <div className="stat-card--hero">
              <span className="stat-card-title">
                <span className="stat-card-icon" aria-hidden="true">
                  <CurrencyCircleDollar size={14} weight="duotone" />
                </span>
                {t('admin.overview.revenueTotal')}
              </span>
              <span className="stat-card-value tabular">
                {stats === null ? <Skeleton style={{ width: 120, height: 28 }} /> : formatIdr(stats.revenueTotal)}
              </span>
            </div>
            <div className="admin-kpi-stack">
              <StatCard
                icon={<ShieldCheck size={14} weight="duotone" aria-hidden="true" />}
                label={t('admin.overview.paidTeams')}
                value={stats?.paidTeams ?? null}
              />
              <StatCard
                icon={<Receipt size={14} weight="duotone" aria-hidden="true" />}
                label={t('admin.overview.pendingPayments')}
                value={stats?.pendingPayments ?? null}
              />
            </div>
          </div>

          {charts && (charts.revenueByDay.length > 0 || charts.revenueByPackage.length > 0) && (
            <div className="admin-charts-grid">
              {charts.revenueByDay.length > 0 && (
                <BarChart
                  rows={charts.revenueByDay.map((d) => ({
                    label: d.date.slice(5),
                    value: d.amount,
                  }))}
                  label={t('admin.overview.revenue30d')}
                />
              )}
              {charts.revenueByPackage.length > 0 && (
                <Donut
                  segments={charts.revenueByPackage.map((p, i) => ({
                    name: p.name,
                    value: p.amount,
                    color: CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--text-secondary)',
                  }))}
                  total={charts.revenueByPackage.reduce((s, p) => s + p.amount, 0)}
                  label={t('admin.overview.revenueByPackage')}
                />
              )}
            </div>
          )}

          {/* Seksi C: Kesehatan Platform */}
          <h2 className="admin-section-title">{t('admin.sections.health')}</h2>
          <div className="stats-grid">
            <StatCard
              icon={<UsersThree size={14} weight="duotone" aria-hidden="true" />}
              label={t('admin.overview.users')}
              value={stats?.users ?? null}
            />
            <StatCard
              icon={<UsersThree size={14} weight="duotone" aria-hidden="true" />}
              label={t('admin.overview.teams')}
              value={stats?.teams ?? null}
            />
            <StatCard
              icon={<FolderSimple size={14} weight="duotone" aria-hidden="true" />}
              label={t('admin.overview.projects')}
              value={stats?.projects ?? null}
            />
            <StatCard
              icon={<Key size={14} weight="duotone" aria-hidden="true" />}
              label={t('admin.overview.activeKeys')}
              value={stats?.activeKeys ?? null}
            />
          </div>

          {/* Seksi D: Aktivitas */}
          <h2 className="admin-section-title">{t('admin.sections.activity')}</h2>
          <div className="admin-chart">
            <div className="admin-activity-header">
              <h3 className="admin-chart-title" style={{ margin: 0 }}>
                {t('admin.activity')}
              </h3>
              <span className="admin-activity-ranges" role="group" aria-label={t('admin.activity')}>
                {ACTIVITY_RANGES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`sub-tab ${activityRange === r ? 'sub-tab-active' : ''}`}
                    onClick={() => setActivityRange(r)}
                    aria-pressed={activityRange === r}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </span>
            </div>

            {activityError ? (
              <InlineError className="mb-12">
                {activityError}{' '}
                <Button variant="ghost" size="sm" onClick={() => void loadActivityChart()}>
                  {t('admin.retry')}
                </Button>
              </InlineError>
            ) : activityChart && activityChart.length > 0 ? (
              <VerticalBarChart
                rows={activityChart.map((d) => ({
                  id: d.date,
                  label: d.label,
                  value: d.count,
                }))}
                label={t('admin.overview.activityRange', { range: activityRange })}
                formatValue={(v) => String(v)}
              />
            ) : activityChart !== null ? (
              <EmptyState
                icon={<ChartLine size={22} aria-hidden="true" />}
                title={t('admin.overview.noActivity')}
                description={t('admin.overview.noActivityDesc')}
              />
            ) : (
              <div aria-hidden="true">
                <Skeleton style={{ width: '100%', height: 140 }} />
                <Skeleton style={{ width: 160, height: 12, marginTop: 8 }} />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
