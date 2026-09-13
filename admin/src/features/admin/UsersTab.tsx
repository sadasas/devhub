import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminUser } from '../../lib/types';
import { formatRelative } from '../../lib/utils';
import { formatDateAdmin, formatIdr } from '../../lib/format';
import { downloadCsv, toCsv } from '../../lib/csv';
import { useAuth } from '../../state/auth-context';
import { AdminTable } from '../../components/AdminTable';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { FilterBar } from '../../components/FilterBar';
import { InlineError } from '../../components/InlineError';
import { Pager } from '../../components/Pager';
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

  function setPlanFilterAtomic(nextPlan: string | null): void {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (nextPlan) n.set('plan', nextPlan);
        else n.delete('plan');
        n.delete('page');
        return n;
      },
      { replace: true },
    );
  }

  function resetFilters(): void {
    setSearchInput('');
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete('q');
        n.delete('plan');
        n.delete('page');
        return n;
      },
      { replace: true },
    );
  }

  // Sync input bila URL berubah dari luar (reset filter / back button)
  useEffect(() => {
    setSearchInput((cur) => (cur === qParam ? cur : qParam));
  }, [qParam]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const cur = (prev.get('q') ?? '').trim();
          if (trimmed === cur) return prev;
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

  function handleExport(): void {
    if (!users || users.length === 0) return;
    const csv = toCsv(
      users.map((u) => ({
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        plan: u.plan ?? '',
        teamCount: u.teamCount,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt ?? '',
        lastPaymentAmount: u.lastPaymentAmount ?? '',
        lastPaymentAt: u.lastPaymentAt ?? '',
      })),
      [
        { key: 'email', label: 'email' },
        { key: 'displayName', label: 'displayName' },
        { key: 'role', label: 'role' },
        { key: 'plan', label: 'plan' },
        { key: 'teamCount', label: 'teamCount' },
        { key: 'createdAt', label: 'createdAt' },
        { key: 'lastActiveAt', label: 'lastActiveAt' },
        { key: 'lastPaymentAmount', label: 'lastPaymentAmount' },
        { key: 'lastPaymentAt', label: 'lastPaymentAt' },
      ],
    );
    downloadCsv(`admin-users-p${page}`, csv);
  }

  const isFiltered = qParam !== '' || planParam !== '';

  return (
    <section className="tab-panel" aria-label={t('admin.users.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {users === null ? t('admin.loading') : t('admin.users.count', { count: usersTotal })}
      </p>

      <div className="tab-toolbar">
        <span className="tab-toolbar-title">{t('admin.tabs.users')}</span>
        <span className="tab-toolbar-actions">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<DownloadSimple size={13} aria-hidden="true" />}
            disabled={!users || users.length === 0}
            onClick={handleExport}
            aria-label={t('admin.export')}
            title={t('admin.export')}
          >
            {t('admin.export')}
          </Button>
        </span>
      </div>

      <FilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchLabel={t('admin.users.searchLabel')}
        searchPlaceholder={t('admin.users.searchPlaceholder')}
        segments={[
          { value: '', label: t('admin.users.allPlans') },
          { value: 'free', label: t('admin.plan.free') },
          { value: 'pro', label: t('admin.plan.pro') },
        ]}
        selectedSegment={planParam}
        onSegmentChange={setPlanFilterAtomic}
        segmentsAriaLabel={t('admin.users.filterPlanAria', { defaultValue: 'Filter plan' })}
        countText={users !== null ? t('admin.users.count', { count: usersTotal }) : undefined}
        hintText={
          users !== null && users.length > 0 && users.length < usersTotal
            ? t('admin.users.showing', { shown: users.length, total: usersTotal })
            : undefined
        }
      />

      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" leftIcon={<ArrowClockwise size={13} aria-hidden="true" />} onClick={() => void loadUsers()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : users === null ? (
        <div role="status" aria-busy="true" aria-label="Loading users">
          <span className="sr-only">Loading users…</span>
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1].map((i) => (
              <div key={i} className="data-row" style={{ height: 56, gap: 12, gridTemplateColumns: 'auto 1fr' }}>
                <Skeleton style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                <div className="data-row-main" style={{ gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Skeleton style={{ width: 120, height: 14 }} />
                    <Skeleton style={{ width: 48, height: 16, borderRadius: 6 }} />
                    <Skeleton style={{ width: 36, height: 16, borderRadius: 6, opacity: 0.7 }} />
                  </div>
                  <Skeleton style={{ width: '75%', height: 11, opacity: 0.8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <AdminTable<AdminUser>
            caption={t('admin.users.aria')}
            columns={[
              {
                key: 'user',
                label: t('admin.users.aria'),
                render: (u) => {
                  const isSelf = u.id === user?.id;
                  const uname = u.displayName?.trim() ? u.displayName : u.email;
                  return (
                    <span className="cell-stack">
                      {/* Baris 1: identitas */}
                      <span className="data-row-title">
                        <Avatar
                          src={(u as { avatarUrl?: string | null }).avatarUrl ?? null}
                          name={uname}
                          email={u.email}
                          id={u.id}
                          size={28}
                        />
                        <span className="row-title-text">{uname}</span>
                        <Badge tone={u.role === 'admin' ? 'info' : 'neutral'}>
                          {u.role === 'admin' ? t('admin.role.admin') : t('admin.role.user')}
                        </Badge>
                        <Badge tone={u.plan === 'pro' ? 'success' : 'neutral'}>
                          {u.plan === 'pro' ? t('admin.plan.pro') : t('admin.plan.free')}
                        </Badge>
                        {isSelf && <Badge tone="neutral">{t('admin.you')}</Badge>}
                      </span>
                      {/* Baris 2: identitas meta */}
                      <span className="data-row-meta">
                        {u.displayName?.trim() && u.displayName !== u.email ? `${u.email} · ` : u.displayName?.trim() ? '' : `${u.email} · `}
                        {t('admin.users.joined', {
                          count: u.teamCount,
                          joined: formatDateAdmin(u.createdAt),
                        })}
                        {u.lastActiveAt ? ` · ${t('admin.users.active', { when: formatRelative(u.lastActiveAt) })}` : ''}
                      </span>
                    </span>
                  );
                },
              },
              {
                key: 'payment',
                label: t('admin.payments.amount'),
                align: 'right',
                numeric: true,
                render: (u) =>
                  u.lastPaymentAmount != null && u.lastPaymentAt ? (
                    <span
                      className="cell-stack"
                      style={{ alignItems: 'flex-end' }}
                      aria-label={t('admin.users.lastPayment', {
                        amount: formatIdr(u.lastPaymentAmount),
                        date: formatDateAdmin(u.lastPaymentAt),
                      })}
                    >
                      <span className="tabular" aria-hidden="true" style={{ fontWeight: 600 }}>
                        {formatIdr(u.lastPaymentAmount)}
                      </span>
                      <span className="data-row-meta" aria-hidden="true" style={{ justifyContent: 'flex-end' }}>
                        {formatDateAdmin(u.lastPaymentAt)}
                      </span>
                    </span>
                  ) : (
                    <span className="data-row-meta" aria-hidden="true">
                      —
                    </span>
                  ),
              },
            ]}
            rows={users}
            getRowId={(u) => u.id}
            isFiltered={isFiltered}
            emptyFilteredTitle={t('admin.users.emptyTitle')}
            emptyFilteredDesc={qParam ? t('admin.users.emptyQueryDesc', { query: qParam }) : t('admin.users.emptyDesc')}
            emptyTotalTitle={t('admin.users.emptyTitle')}
            emptyTotalDesc={t('admin.users.emptyDesc')}
            onResetFilters={resetFilters}
          />
          <Pager
            page={page}
            totalPages={totalPages}
            totalItems={usersTotal}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => updateParam('page', String(p))}
            ariaLabel={t('admin.users.paginationAria')}
          />
        </>
      )}
    </section>
  );
}
