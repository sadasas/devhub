import { useCallback, useEffect, useRef, useState } from 'react';
import { MagnifyingGlass, UsersThree } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminUser } from '../../lib/types';
import { formatRelative } from '../../lib/utils';
import { formatDateAdmin, formatIdr } from '../../lib/format';
import { useAuth } from '../../state/auth-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';

const PAGE_SIZE = 25;

interface UsersTabProps {
  refreshKey: number;
  onSettled?: () => void;
}

export function UsersTab({ refreshKey, onSettled }: UsersTabProps) {
  const { t } = useTranslation('extras');
  const { user } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  const planParam = searchParams.get('plan') ?? '';
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [usersTotal, setUsersTotal] = useState(0);
  const [searchInput, setSearchInput] = useState(() => qParam);
  const [error, setError] = useState<string | null>(null);

  const latestRequest = useRef(0);

  function updateParam(key: string, value: string | null): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) next.set('q', trimmed);
          else next.delete('q');
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  const loadUsers = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const res = await api.listAdminUsers({
        query: qParam || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        plan: planParam || undefined,
      });
      if (latestRequest.current !== requestId) return;
      setUsers(res.users);
      setUsersTotal(res.total);
      setError(null);
    } catch (err) {
      if (latestRequest.current !== requestId) return;
      setError(getErrorMessage(err, t('admin.users.errors.load')));
    } finally {
      if (latestRequest.current === requestId) onSettled?.();
    }
  }, [qParam, planParam, page, t, onSettled]);

  // Filter/halaman berubah → muat ulang; refreshKey → muat ulang tanpa reset ke skeleton.
  useEffect(() => {
    void loadUsers();
  }, [loadUsers, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(usersTotal / PAGE_SIZE));

  // Clamp halaman bila total menyusut (mis. filter mempersempit hasil).
  useEffect(() => {
    if (error === null && usersTotal > 0 && page > totalPages) {
      updateParam('page', String(totalPages));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersTotal, page, totalPages]);

  return (
    <section className="tab-panel" aria-label={t('admin.users.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {users === null ? t('admin.loading') : t('admin.users.count', { count: usersTotal })}
      </p>
      <div className="admin-filter-bar">
        <Input
          label={t('admin.users.searchLabel')}
          placeholder={t('admin.users.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          rightSlot={<MagnifyingGlass size={14} aria-hidden="true" />}
          className="admin-filter-input"
        />
        <select
          className="select"
          value={planParam}
          onChange={(e) => {
            updateParam('plan', e.target.value || null);
            updateParam('page', null);
          }}
          aria-label={t('admin.users.filterPlanAria')}
        >
          <option value="">{t('admin.users.allPlans')}</option>
          <option value="free">{t('admin.plan.free')}</option>
          <option value="pro">{t('admin.plan.pro')}</option>
        </select>
        <span className="page-subtitle admin-filter-count">
          {users !== null ? t('admin.users.count', { count: usersTotal }) : ''}
        </span>
      </div>
      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={() => void loadUsers()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : users === null ? (
        <>
          <Skeleton style={{ width: '100%', height: 48 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
        </>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UsersThree size={22} />}
          title={t('admin.users.emptyTitle')}
          description={qParam ? t('admin.users.emptyQueryDesc', { query: qParam }) : t('admin.users.emptyDesc')}
        />
      ) : (
        <>
          {users.map((u) => {
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
                      joined: formatDateAdmin(u.createdAt),
                    })}
                    {u.lastActiveAt ? ` · ${t('admin.users.active', { when: formatRelative(u.lastActiveAt) })}` : ''}
                    {u.lastPaymentAmount != null && u.lastPaymentAt
                      ? ` · ${t('admin.users.lastPayment', {
                          amount: formatIdr(u.lastPaymentAmount),
                          date: formatDateAdmin(u.lastPaymentAt),
                        })}`
                      : ''}
                  </span>
                </div>
              </div>
            );
          })}
          {totalPages > 1 && (
            <nav className="pager" aria-label={t('admin.users.paginationAria')}>
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
              >
                {t('admin.pager.previous')}
              </Button>
              <span className="pager-status">{t('admin.pager.status', { page, total: totalPages })}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= totalPages}
                onClick={() => updateParam('page', String(page + 1))}
              >
                {t('admin.pager.next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
