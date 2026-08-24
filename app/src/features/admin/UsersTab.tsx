import { useCallback, useEffect, useRef, useState } from 'react';
import { MagnifyingGlass, UsersThree } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('extras');
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
        setError(getErrorMessage(err, t('admin.users.errors.load')));
      }
    },
    [t],
  );

  useEffect(() => {
    setUsers(null);
    void loadUsers(query, planFilter);
  }, [query, planFilter, refreshKey, loadUsers]);

  return (
    <section className="tab-panel" role="tabpanel" aria-label={t('admin.users.aria')}>
      <div className="admin-filter-bar">
        <Input
          label={t('admin.users.searchLabel')}
          placeholder={t('admin.users.searchPlaceholder')}
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
          aria-label={t('admin.users.filterPlanAria')}
        >
          <option value="">{t('admin.users.allPlans')}</option>
          <option value="free">{t('admin.plan.free')}</option>
          <option value="pro">{t('admin.plan.pro')}</option>
        </select>
        <span className="page-subtitle" style={{ marginLeft: 'auto' }}>
          {users !== null ? t('admin.users.count', { count: usersTotal }) : ''}
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
          title={t('admin.users.emptyTitle')}
          description={query ? t('admin.users.emptyQueryDesc', { query }) : t('admin.users.emptyDesc')}
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
                    {u.role === 'admin' ? t('admin.role.admin') : t('admin.role.user')}
                  </Badge>
                  <Badge tone={u.plan === 'pro' ? 'success' : 'neutral'}>
                    {u.plan === 'pro' ? t('admin.plan.pro') : t('admin.plan.free')}
                  </Badge>
                  {isSelf && <Badge tone="neutral">{t('admin.you')}</Badge>}
                </span>
                <span className="data-row-meta">
                  {t('admin.users.joined', {
                    count: u.teamCount,
                    joined: new Date(u.createdAt).toLocaleDateString(),
                  })}
                  {u.lastActiveAt ? ` · ${t('admin.users.active', { when: formatRelative(u.lastActiveAt) })}` : ''}
                  {u.lastPaymentAmount != null && u.lastPaymentAt
                    ? ` · ${t('admin.users.lastPayment', {
                        amount: formatIdr(u.lastPaymentAmount),
                        date: new Date(u.lastPaymentAt).toLocaleDateString(),
                      })}`
                    : ''}
                </span>
              </div>
            </div>
          );
        })
      )}
      {users !== null && users.length < usersTotal && (
        <p className="page-subtitle" style={{ marginTop: 8 }}>
          {t('admin.users.showing', { shown: users.length, total: usersTotal })}
        </p>
      )}
    </section>
  );
}
