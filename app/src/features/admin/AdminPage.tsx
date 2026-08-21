import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowClockwise,
  ChartLine,
  EnvelopeSimple,
  FolderSimple,
  Key,
  MagnifyingGlass,
  ShieldStar,
  UsersThree,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminActivityEntry, AdminStats, AdminTeam, AdminUser } from '../../lib/types';
import { formatRelative } from '../../lib/utils';
import { useAuth } from '../../state/auth-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';

type Tab = 'users' | 'teams' | 'activity';

const PAGE_SIZE = 50;

const ROLE_BADGE: Record<'user' | 'admin', { label: string; tone: 'neutral' | 'info' }> = {
  user: { label: 'User', tone: 'neutral' },
  admin: { label: 'Admin', tone: 'info' },
};

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
}) {
  return (
    <div className="stat-card">
      <h3 className="stat-card-title">
        {icon}
        {label}
      </h3>
      <span className="stat-card-value">{value === null ? <Skeleton style={{ width: 48, height: 22 }} /> : value}</span>
    </div>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [usersTotal, setUsersTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [activity, setActivity] = useState<AdminActivityEntry[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const searchTimer = useRef<number | null>(null);

  const loadStats = useCallback(async () => {
    setStats(null);
    setStatsError(null);
    try {
      setStats(await api.adminStats());
    } catch (err) {
      setStatsError(getErrorMessage(err, 'Failed to load stats'));
    }
  }, []);

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
    async (q: string) => {
      try {
        const res = await api.listAdminUsers({ query: q, limit: PAGE_SIZE });
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
    void loadUsers(query);
  }, [query, loadUsers]);

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

  const loadActivity = useCallback(async () => {
    setActivityError(null);
    try {
      const a = await api.listAdminActivity();
      setActivity(a);
    } catch (err) {
      setActivity([]);
      setActivityError(getErrorMessage(err, 'Failed to load activity'));
    } finally {
      setActivityLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'teams' || teamsLoaded) return;
    void loadTeams();
  }, [tab, teamsLoaded, loadTeams]);

  useEffect(() => {
    if (tab !== 'activity' || activityLoaded) return;
    void loadActivity();
  }, [tab, activityLoaded, loadActivity]);

  async function onChangeRole(member: AdminUser, role: 'user' | 'admin') {
    if (role === member.role) return;
    setBusyUserId(member.id);
    setActionError(null);
    try {
      await api.setAdminUserRole(member.id, role);
      setUsers((prev) => (prev ? prev.map((u) => (u.id === member.id ? { ...u, role } : u)) : prev));
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to change role'));
    } finally {
      setBusyUserId(null);
    }
  }

  function refresh() {
    setTeams(null);
    setTeamsLoaded(false);
    setActivity(null);
    setActivityLoaded(false);
    void loadStats();
    void loadUsers(query);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">Platform-wide overview — users, teams, projects and activity.</p>
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
        <StatCard
          icon={<ChartLine size={14} weight="duotone" aria-hidden="true" />}
          label="Activity 24h"
          value={stats?.activity24h ?? null}
        />
        <StatCard
          icon={<ChartLine size={14} weight="duotone" aria-hidden="true" />}
          label="Activity 7d"
          value={stats?.activity7d ?? null}
        />
      </div>

      <div className="sub-tabs" role="tablist" aria-label="Admin sections">
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
          className={`sub-tab ${tab === 'activity' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('activity')}
          aria-selected={tab === 'activity'}
        >
          <ChartLine size={13} aria-hidden="true" />
          Activity
        </button>
      </div>

      {tab === 'users' && (
        <section className="tab-panel" role="tabpanel" aria-label="Platform users">
          <form
            className="form-stack"
            onSubmit={(e) => e.preventDefault()}
            style={{ marginBottom: 12 }}
          >
            <Input
              label="Search users"
              placeholder="Search by email or display name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              rightSlot={<MagnifyingGlass size={14} aria-hidden="true" />}
            />
          </form>
          {users === null ? (
            <>
              <Skeleton style={{ width: '100%', height: 48 }} />
              <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
            </>
          ) : users.length === 0 ? (
            <EmptyState
              icon={<UsersThree size={22} />}
              title="No users found"
              description={query ? `Nothing matches “${query}”.` : 'No registered users yet.'}
            />
          ) : (
            users.map((u) => {
              const isSelf = u.id === user?.id;
              return (
                <div key={u.id} className="data-row">
                  <div className="data-row-main">
                    <span className="data-row-title">
                      <span className="row-title-text">{u.email}</span>
                      <Badge tone={ROLE_BADGE[u.role].tone}>{ROLE_BADGE[u.role].label}</Badge>
                      {isSelf && <Badge tone="neutral">You</Badge>}
                    </span>
                    <span className="data-row-meta">
                      {u.teamCount} team{u.teamCount === 1 ? '' : 's'} · joined{' '}
                      {new Date(u.createdAt).toLocaleDateString()}
                      {u.lastActiveAt ? ` · active ${formatRelative(u.lastActiveAt)}` : ''}
                    </span>
                  </div>
                  <div className="data-row-side">
                    <select
                      className="select select-role"
                      value={u.role}
                      disabled={busyUserId === u.id}
                      aria-label={`Role for ${u.email}`}
                      title={isSelf ? 'You cannot demote yourself' : undefined}
                      onChange={(e) => void onChangeRole(u, e.target.value as 'user' | 'admin')}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
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
                  </span>
                  <span className="data-row-meta">
                    owner {t.ownerEmail ?? '—'} · created{' '}
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="data-row-side">
                  <Badge tone="neutral">{t.memberCount} members</Badge>
                  <Badge tone="neutral">{t.projectCount} projects</Badge>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'activity' && (
        <section className="tab-panel" role="tabpanel" aria-label="Platform activity">
          {activity === null ? (
            <>
              <Skeleton style={{ width: '100%', height: 48 }} />
              <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
            </>
          ) : activityError ? (
            <InlineError className="mb-12">
              {activityError}{' '}
              <Button variant="ghost" size="sm" onClick={() => void loadActivity()}>
                Retry
              </Button>
            </InlineError>
          ) : activity.length === 0 ? (
            <EmptyState
              icon={<EnvelopeSimple size={22} />}
              title="No recent activity"
              description="Changes made across all projects will show up here."
            />
          ) : (
            activity.map((a) => (
              <div key={a.id} className="data-row">
                <div className="data-row-main">
                  <span className="data-row-title">
                    <span className="row-title-text">{a.summary || `${a.action} ${a.entity}`}</span>
                  </span>
                  <span className="data-row-meta">
                    {a.authorName || 'Unknown'} · {formatRelative(a.createdAt)}
                  </span>
                </div>
                <div className="data-row-side">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${a.projectId}`)}>
                    {a.projectName}
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      <div className="page-footer">
        <p className="page-subtitle">
          <ShieldStar size={12} weight="duotone" aria-hidden="true" /> Admin access is granted per
          user via the global role. You cannot demote yourself.
        </p>
      </div>
    </div>
  );
}
