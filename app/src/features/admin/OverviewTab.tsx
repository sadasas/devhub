import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChartLine,
  CurrencyCircleDollar,
  FolderSimple,
  Key,
  Receipt,
  ShieldCheck,
  UsersThree,
} from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminActivityChart, AdminCharts, AdminStats } from '../../lib/types';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { BarChart, CHART_COLORS, Donut, StatCard, VerticalBarChart } from './charts';

export function OverviewTab({ refreshKey }: { refreshKey: number }) {
  const { t } = useTranslation('extras');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [charts, setCharts] = useState<AdminCharts | null>(null);
  const [activityRange, setActivityRange] = useState('7d');
  const [activityChart, setActivityChart] = useState<AdminActivityChart[] | null>(null);

  const loadOverview = useCallback(async () => {
    setStats(null);
    setStatsError(null);
    try {
      const [s, c] = await Promise.all([api.adminStats(), api.adminStatsCharts()]);
      setStats(s);
      setCharts(c);
    } catch (err) {
      setStatsError(getErrorMessage(err, t('admin.overview.errors.stats')));
    }
  }, [t]);

  const loadActivityChart = useCallback(async () => {
    try {
      const a = await api.adminStatsActivity(activityRange);
      setActivityChart(a);
    } catch {
      setActivityChart([]);
    }
  }, [activityRange]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, refreshKey]);

  useEffect(() => {
    void loadActivityChart();
  }, [loadActivityChart, refreshKey]);

  return (
    <section className="tab-panel" role="tabpanel" aria-label={t('admin.overview.aria')}>
      {statsError && <InlineError>{statsError}</InlineError>}
      <div className="stats-grid mb-24">
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
      <div className="stats-grid mb-24">
        <StatCard
          icon={<CurrencyCircleDollar size={14} weight="duotone" aria-hidden="true" />}
          label={t('admin.overview.revenueTotal')}
          value={stats?.revenueTotal ?? null}
          accent
        />
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

      <div className="admin-filter-bar mb-12">
        <h3 className="page-subtitle" style={{ margin: 0 }}>{t('admin.activity')}</h3>
        <span style={{ flex: 1 }} />
        {(['1d', '7d', '1m', '6m', '12m'] as const).map((r) => (
          <button
            key={r}
            type="button"
            className={`sub-tab ${activityRange === r ? 'sub-tab-active' : ''}`}
            onClick={() => setActivityRange(r)}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {activityChart && activityChart.length > 0 ? (
        <VerticalBarChart
          rows={activityChart.map((d) => ({
            id: d.date,
            label: d.label,
            value: d.count,
          }))}
          label={t('admin.overview.activityRange', { range: activityRange })}
          formatValue={(v) => String(v)}
        />
      ) : (
        <EmptyState
          icon={<ChartLine size={22} />}
          title={t('admin.overview.noActivity')}
          description={t('admin.overview.noActivityDesc')}
        />
      )}

      {charts && charts.revenueByDay.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <BarChart
            rows={charts.revenueByDay.map((d) => ({
              label: d.date.slice(5),
              value: d.amount,
            }))}
            label={t('admin.overview.revenue30d')}
          />
        </div>
      )}

      {charts && charts.revenueByPackage.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Donut
            segments={charts.revenueByPackage.map((p, i) => ({
              name: p.name,
              value: p.amount,
              color: CHART_COLORS[i % CHART_COLORS.length] ?? '#6b7280',
            }))}
            total={charts.revenueByPackage.reduce((s, p) => s + p.amount, 0)}
            label={t('admin.overview.revenueByPackage')}
          />
        </div>
      )}
    </section>
  );
}
