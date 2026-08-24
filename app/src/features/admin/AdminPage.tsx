import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowClockwise,
  ChartLine,
  CurrencyCircleDollar,
  FolderSimple,
  Key,
  MagnifyingGlass,
  Package,
  Receipt,
  ShieldCheck,
  UsersThree,
} from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type {
  AdminActivityChart,
  AdminCharts,
  AdminPackage,
  AdminPayment,
  AdminStats,
  AdminTeam,
  AdminUser,
} from '../../lib/types';
import { formatRelative } from '../../lib/utils';
import { useAuth } from '../../state/auth-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';
import { PackageModal } from './PackageModal';
import { TeamPlanModal } from './TeamPlanModal';

type Tab = 'overview' | 'users' | 'payments' | 'teams' | 'packages';

const PAGE_SIZE = 50;

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function Donut({
  segments,
  total,
  label,
}: {
  segments: { value: number; color: string; name: string }[];
  total: number;
  label: string;
}) {
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="admin-chart">
      <svg viewBox="0 0 100 100" className="admin-chart-donut" role="img" aria-label={label}>
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
          {label}
        </text>
      </svg>
      <div className="admin-chart-legend">
        {segments.map((s, i) => (
          <span key={i} className="admin-chart-legend-item">
            <span className="admin-chart-legend-dot" style={{ background: s.color }} />
            {s.name}: {formatIdr(s.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarChart({
  rows,
  label,
  formatValue = formatIdr,
}: {
  rows: { label: string; value: number }[];
  label: string;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="admin-chart">
      <h4 className="admin-chart-title">{label}</h4>
      <div className="admin-bars">
        {rows.map((r) => (
          <div key={r.label} className="admin-bar-row">
            <span className="admin-bar-label">{r.label}</span>
            <div className="admin-bar-track">
              <div
                className="admin-bar-fill"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            <span className="admin-bar-value">{formatValue(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  accent?: boolean;
}) {
  return (
    <div className={accent ? 'stat-card-revenue' : 'stat-card'}>
      <h3 className="stat-card-title">
        {icon}
        {label}
      </h3>
      <span className="stat-card-value">
        {value === null ? <Skeleton style={{ width: 48, height: 22 }} /> : value}
      </span>
    </div>
  );
}

export function AdminPage() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [charts, setCharts] = useState<AdminCharts | null>(null);
  const [activityRange, setActivityRange] = useState('7d');
  const [activityChart, setActivityChart] = useState<AdminActivityChart[] | null>(null);

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [usersTotal, setUsersTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');

  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  const [packages, setPackages] = useState<AdminPackage[] | null>(null);
  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<AdminPackage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<AdminPackage | null>(null);
  const [teamPlanModalOpen, setTeamPlanModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);

  const searchTimer = useRef<number | null>(null);

  const loadStats = useCallback(async () => {
    setStats(null);
    setStatsError(null);
    try {
      const [s, c, a] = await Promise.all([
        api.adminStats(),
        api.adminStatsCharts(),
        api.adminStatsActivity(activityRange),
      ]);
      setStats(s);
      setCharts(c);
      setActivityChart(a);
    } catch (err) {
      setStatsError(getErrorMessage(err, 'Failed to load stats'));
    }
  }, [activityRange]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setQuery(searchInput.trim());
    }, 300);
    return () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  const loadUsers = useCallback(
    async (q: string, plan?: string) => {
      try {
        const res = await api.listAdminUsers({ query: q, limit: PAGE_SIZE, plan: plan || undefined });
        setUsers(res.users);
        setUsersTotal(res.total);
        setActionError(null);
      } catch (err) {
        setUsers([]);
        setActionError(getErrorMessage(err, 'Failed to load users'));
      }
    },
    [],
  );

  useEffect(() => {
    setUsers(null);
    void loadUsers(query, planFilter);
  }, [query, planFilter, loadUsers]);

  const loadPayments = useCallback(
    async (status: string) => {
      setPaymentsError(null);
      try {
        const res = await api.listAdminPayments({ limit: PAGE_SIZE, status: status || undefined });
        setPayments(res.payments);
        setPaymentsTotal(res.total);
      } catch (err) {
        setPayments([]);
        setPaymentsError(getErrorMessage(err, 'Failed to load payments'));
      } finally {
        setPaymentsLoaded(true);
      }
    },
    [],
  );

  const loadTeams = useCallback(async () => {
    setTeamsError(null);
    try {
      const t = await api.listAdminTeams();
      setTeams(t);
    } catch (err) {
      setTeams([]);
      setTeamsError(getErrorMessage(err, 'Failed to load teams'));
    } finally {
      setTeamsLoaded(true);
    }
  }, []);

  const loadPackages = useCallback(async () => {
    setPackagesError(null);
    try {
      const p = await api.adminListPackages();
      setPackages(p);
    } catch (err) {
      setPackages([]);
      setPackagesError(getErrorMessage(err, 'Failed to load packages'));
    } finally {
      setPackagesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'payments' || paymentsLoaded) return;
    void loadPayments(paymentStatusFilter);
  }, [tab, paymentsLoaded, paymentStatusFilter, loadPayments]);

  useEffect(() => {
    if (tab !== 'teams' || teamsLoaded) return;
    void loadTeams();
  }, [tab, teamsLoaded, loadTeams]);

  useEffect(() => {
    if (tab !== 'packages' || packagesLoaded) return;
    void loadPackages();
  }, [tab, packagesLoaded, loadPackages]);

  async function onTogglePackageActive(pkg: AdminPackage) {
    setBusyPackageId(pkg.id);
    setActionError(null);
    try {
      await api.adminPatchPackage(pkg.id, { isActive: !pkg.isActive });
      setPackages((prev) =>
        prev ? prev.map((p) => (p.id === pkg.id ? { ...p, isActive: !p.isActive } : p)) : prev,
      );
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to update package'));
    } finally {
      setBusyPackageId(null);
    }
  }

  function onPackageSaved(saved: AdminPackage) {
    setPackages((prev) => {
      if (!prev) return [saved];
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  function onTeamSaved(saved: AdminTeam & { plan: string }) {
    setTeams((prev) =>
      prev ? prev.map((t) => (t.id === saved.id ? { ...t, plan: saved.plan } : t)) : prev,
    );
  }

  async function onDeletePackage(pkg: AdminPackage) {
    setDeletingPackage(pkg);
    setDeleteDialogOpen(true);
  }

  async function confirmDeletePackage() {
    if (!deletingPackage) return;
    setBusyPackageId(deletingPackage.id);
    setActionError(null);
    try {
      await api.adminDeletePackage(deletingPackage.id);
      setPackages((prev) => (prev ? prev.filter((p) => p.id !== deletingPackage.id) : prev));
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to delete package'));
    } finally {
      setBusyPackageId(null);
      setDeleteDialogOpen(false);
      setDeletingPackage(null);
    }
  }

  function refresh() {
    setTeams(null);
    setTeamsLoaded(false);
    setPayments(null);
    setPaymentsLoaded(false);
    setPackages(null);
    setPackagesLoaded(false);
    void loadStats();
    void loadUsers(query, planFilter);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">Platform-wide overview — users, teams, payments and packages.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowClockwise size={13} aria-hidden="true" />}
          onClick={refresh}
        >
          Refresh
        </Button>
      </header>

      {statsError && <InlineError>{statsError}</InlineError>}
      {actionError && <InlineError>{actionError}</InlineError>}

      <div className="sub-tabs" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'overview' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('overview')}
          aria-selected={tab === 'overview'}
        >
          <ChartLine size={13} aria-hidden="true" />
          Overview
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'users' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('users')}
          aria-selected={tab === 'users'}
        >
          <UsersThree size={13} aria-hidden="true" />
          Users{stats !== null ? ` (${stats.users})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'payments' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('payments')}
          aria-selected={tab === 'payments'}
        >
          <Receipt size={13} aria-hidden="true" />
          Payments
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'teams' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('teams')}
          aria-selected={tab === 'teams'}
        >
          <FolderSimple size={13} aria-hidden="true" />
          Teams{stats !== null ? ` (${stats.teams})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'packages' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('packages')}
          aria-selected={tab === 'packages'}
        >
          <Package size={13} aria-hidden="true" />
          Packages
        </button>
      </div>

      {tab === 'overview' && (
        <section className="tab-panel" role="tabpanel" aria-label="Platform overview">
          <div className="stats-grid mb-24">
            <StatCard
              icon={<UsersThree size={14} weight="duotone" aria-hidden="true" />}
              label="Users"
              value={stats?.users ?? null}
            />
            <StatCard
              icon={<UsersThree size={14} weight="duotone" aria-hidden="true" />}
              label="Teams"
              value={stats?.teams ?? null}
            />
            <StatCard
              icon={<FolderSimple size={14} weight="duotone" aria-hidden="true" />}
              label="Projects"
              value={stats?.projects ?? null}
            />
            <StatCard
              icon={<Key size={14} weight="duotone" aria-hidden="true" />}
              label="Active keys"
              value={stats?.activeKeys ?? null}
            />
          </div>
          <div className="stats-grid mb-24">
            <StatCard
              icon={<CurrencyCircleDollar size={14} weight="duotone" aria-hidden="true" />}
              label="Revenue Total"
              value={stats?.revenueTotal ?? null}
              accent
            />
            <StatCard
              icon={<ShieldCheck size={14} weight="duotone" aria-hidden="true" />}
              label="Paid Teams"
              value={stats?.paidTeams ?? null}
            />
            <StatCard
              icon={<Receipt size={14} weight="duotone" aria-hidden="true" />}
              label="Pending Payments"
              value={stats?.pendingPayments ?? null}
            />
          </div>

          <div className="admin-filter-bar mb-12">
            <h3 className="page-subtitle" style={{ margin: 0 }}>Activity</h3>
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
            <BarChart
              rows={activityChart.map((d) => ({
                label: d.date.slice(5),
                value: d.count,
              }))}
              label={`Activity (${activityRange})`}
              formatValue={(v) => String(v)}
            />
          ) : (
            <EmptyState
              icon={<ChartLine size={22} />}
              title="No activity data"
              description="Activity will appear here once users start working."
            />
          )}

          {charts && charts.revenueByDay.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <BarChart
                rows={charts.revenueByDay.map((d) => ({
                  label: d.date.slice(5),
                  value: d.amount,
                }))}
                label="Revenue last 30 days"
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
                label="Revenue by package"
              />
            </div>
          )}
        </section>
      )}

      {tab === 'users' && (
        <section className="tab-panel" role="tabpanel" aria-label="Platform users">
          <div className="admin-filter-bar">
            <Input
              placeholder="Search by email or display name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              rightSlot={<MagnifyingGlass size={14} aria-hidden="true" />}
              style={{ flex: 1, minWidth: 0 }}
            />
            <select
              className="select"
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setUsers(null);
              }}
              aria-label="Filter by plan"
            >
              <option value="">All plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
            <span className="page-subtitle">
              {users !== null ? `${usersTotal} user${usersTotal === 1 ? '' : 's'}` : ''}
            </span>
          </div>
          {users === null ? (
            <>
              <Skeleton style={{ width: '100%', height: 48 }} />
              <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
            </>
          ) : users.length === 0 ? (
            <EmptyState
              icon={<UsersThree size={22} />}
              title="No users found"
              description={query ? `Nothing matches "${query}".` : 'No registered users yet.'}
            />
          ) : (
            users.map((u) => {
              const isSelf = u.id === user?.id;
              return (
                <div key={u.id} className="data-row">
                  <div className="data-row-main">
                    <span className="data-row-title">
                      <span className="row-title-text">{u.email}</span>
                      <Badge tone={u.role === 'admin' ? 'info' : 'neutral'}>
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </Badge>
                      <Badge tone={u.plan === 'pro' ? 'success' : 'neutral'}>
                        {u.plan === 'pro' ? 'Pro' : 'Free'}
                      </Badge>
                      {isSelf && <Badge tone="neutral">You</Badge>}
                    </span>
                    <span className="data-row-meta">
                      {u.teamCount} team{u.teamCount === 1 ? '' : 's'} · joined{' '}
                      {new Date(u.createdAt).toLocaleDateString()}
                      {u.lastActiveAt ? ` · active ${formatRelative(u.lastActiveAt)}` : ''}
                      {u.lastPaymentAmount != null && u.lastPaymentAt
                        ? ` · last payment ${formatIdr(u.lastPaymentAmount)} (${new Date(u.lastPaymentAt).toLocaleDateString()})`
                        : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          {users !== null && users.length < usersTotal && (
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              Showing {users.length} of {usersTotal} users — refine the search to narrow down.
            </p>
          )}
        </section>
      )}

      {tab === 'payments' && (
        <section className="tab-panel" role="tabpanel" aria-label="Platform payments">
          <div className="admin-filter-bar">
            <select
              className="select"
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPaymentsLoaded(false);
                setPayments(null);
              }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
            <span className="page-subtitle">
              {payments !== null ? `${paymentsTotal} payment${paymentsTotal === 1 ? '' : 's'}` : ''}
            </span>
          </div>

          {payments === null && !paymentsError ? (
            <>
              <Skeleton style={{ width: '100%', height: 48 }} />
              <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
              <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
            </>
          ) : paymentsError ? (
            <InlineError className="mb-12">
              {paymentsError}{' '}
              <Button variant="ghost" size="sm" onClick={() => { setPaymentsLoaded(false); setPayments(null); }}>
                Retry
              </Button>
            </InlineError>
          ) : payments?.length === 0 ? (
            <EmptyState
              icon={<Receipt size={22} />}
              title="No payments yet"
              description="Completed and pending payments will appear here."
            />
          ) : (
            <div className="admin-payment-table">
              <div className="admin-payment-header">
                <span>Date</span>
                <span>Buyer</span>
                <span>Team</span>
                <span>Package</span>
                <span style={{ textAlign: 'right' }}>Amount</span>
                <span>Status</span>
              </div>
              {payments!.map((p) => (
                <div key={p.id} className="admin-payment-row">
                  <span className="admin-payment-date">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                  <span className="admin-payment-buyer" title={p.buyerEmail}>
                    {p.buyerEmail}
                  </span>
                  <span className="admin-payment-team" title={p.teamName}>
                    {p.teamName}
                  </span>
                  <span>{p.packageName}</span>
                  <span className="admin-payment-amount">{formatIdr(p.amount)}</span>
                  <Badge tone={p.status === 'completed' ? 'success' : 'neutral'}>
                    {p.status === 'completed' ? 'Paid' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'teams' && (
        <section className="tab-panel" role="tabpanel" aria-label="Platform teams">
          {teams === null ? (
            <>
              <Skeleton style={{ width: '100%', height: 48 }} />
              <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
            </>
          ) : teamsError ? (
            <InlineError className="mb-12">
              {teamsError}{' '}
              <Button variant="ghost" size="sm" onClick={() => void loadTeams()}>
                Retry
              </Button>
            </InlineError>
          ) : teams.length === 0 ? (
            <EmptyState
              icon={<FolderSimple size={22} />}
              title="No teams yet"
              description="Teams appear here as soon as users create them."
            />
          ) : (
            teams.map((t) => (
              <div key={t.id} className="data-row">
                <div className="data-row-main">
                  <span className="data-row-title">
                    <span className="row-title-text">{t.name}</span>
                    <Badge tone="neutral">{t.memberCount} members</Badge>
                    <Badge tone="neutral">{t.projectCount} projects</Badge>
                    <Badge tone={(t as AdminTeam & { plan?: string }).plan === 'pro' ? 'success' : 'neutral'}>
                      {(t as AdminTeam & { plan?: string }).plan === 'pro' ? 'Pro' : 'Free'}
                    </Badge>
                  </span>
                  <span className="data-row-meta">
                    owner {t.ownerEmail ?? '—'} · created{' '}
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="data-row-side">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingTeam(t); setTeamPlanModalOpen(true); }}
                  >
                    Change plan
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'packages' && (
        <section className="tab-panel" role="tabpanel" aria-label="Billing packages">
          <div className="admin-filter-bar mb-12">
            <span className="page-subtitle">
              {packages !== null ? `${packages.length} package${packages.length === 1 ? '' : 's'}` : ''}
            </span>
            <span style={{ flex: 1 }} />
            <Button
              size="sm"
              leftIcon={<Package size={13} aria-hidden="true" />}
              onClick={() => { setEditingPackage(null); setPackageModalOpen(true); }}
            >
              New package
            </Button>
          </div>
          {packages === null && !packagesError ? (
            <div className="admin-packages-grid">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ width: '100%', height: 160 }} />
              ))}
            </div>
          ) : packagesError ? (
            <InlineError className="mb-12">
              {packagesError}{' '}
              <Button variant="ghost" size="sm" onClick={() => { setPackagesLoaded(false); setPackages(null); }}>
                Retry
              </Button>
            </InlineError>
          ) : packages?.length === 0 ? (
            <EmptyState
              icon={<Package size={22} />}
              title="No packages"
              description="Create billing packages to define pricing tiers."
            />
          ) : (
            <div className="admin-packages-grid">
              {packages!.map((pkg) => (
                <div key={pkg.id} className="admin-package-card">
                  <div className="admin-package-card-head">
                    <span className="admin-package-name">{pkg.name}</span>
                    <Badge tone={pkg.isActive ? 'success' : 'neutral'}>
                      {pkg.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {pkg.description && (
                    <p className="admin-package-desc">{pkg.description}</p>
                  )}
                  <div className="admin-package-limits">
                    <span className="admin-package-limit">
                      Max members: {pkg.maxMembers === null ? 'Unlimited' : pkg.maxMembers}
                    </span>
                    <span className="admin-package-limit">
                      Max projects: {pkg.maxProjects === null ? 'Unlimited' : pkg.maxProjects}
                    </span>
                  </div>
                  {pkg.prices.length > 0 && (
                    <div className="admin-package-prices">
                      {pkg.prices.map((price) => (
                        <div key={price.id} className="admin-package-price-row">
                          <span className="admin-package-price-duration">
                            {price.durationDays} days
                          </span>
                          <span className="admin-package-price-amount">
                            {formatIdr(price.priceIdr)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="admin-package-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyPackageId === pkg.id}
                      onClick={() => { setEditingPackage(pkg); setPackageModalOpen(true); }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyPackageId === pkg.id}
                      onClick={() => void onTogglePackageActive(pkg)}
                    >
                      {pkg.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyPackageId === pkg.id}
                      onClick={() => void onDeletePackage(pkg)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <PackageModal
        open={packageModalOpen}
        pkg={editingPackage}
        onClose={() => { setPackageModalOpen(false); setEditingPackage(null); }}
        onSaved={onPackageSaved}
      />

      <TeamPlanModal
        open={teamPlanModalOpen}
        team={editingTeam}
        onClose={() => { setTeamPlanModalOpen(false); setEditingTeam(null); }}
        onSaved={onTeamSaved}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete package"
        description={`Delete "${deletingPackage?.name ?? ''}"? This cannot be undone.`}
        onConfirm={() => void confirmDeletePackage()}
        onClose={() => { setDeleteDialogOpen(false); setDeletingPackage(null); }}
      />
    </div>
  );
}
