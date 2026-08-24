import { useCallback, useEffect, useRef, useState } from 'react';
import { MagnifyingGlass, UsersThree } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminUser } from '../../lib/types';
import { formatRelative } from '../../lib/utils';
import { useAuth } from '../../state/auth-context';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';
import { formatIdr } from './charts';

const PAGE_SIZE = 50;

export function UsersTab({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [usersTotal, setUsersTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const searchTimer = useRef<number | null>(null);

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
        setError(null);
      } catch (err) {
        setUsers([]);
        setError(getErrorMessage(err, 'Failed to load users'));
      }
    },
    [],
  );

  useEffect(() => {
    setUsers(null);
    void loadUsers(query, planFilter);
  }, [query, planFilter, refreshKey, loadUsers]);

  return (
    <section className="tab-panel" role="tabpanel" aria-label="Platform users">
      <div className="admin-filter-bar">
        <Input
          label="Search users"
          placeholder="Search by email or display name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          rightSlot={<MagnifyingGlass size={14} aria-hidden="true" />}
          style={{ width: 280 }}
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
        <span className="page-subtitle" style={{ marginLeft: 'auto' }}>
          {users !== null ? `${usersTotal} user${usersTotal === 1 ? '' : 's'}` : ''}
        </span>
      </div>
      {error && <InlineError>{error}</InlineError>}
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
  );
}
