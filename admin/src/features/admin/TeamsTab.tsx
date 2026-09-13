import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowClockwise, DownloadSimple, PencilSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminTeam } from '../../lib/types';
import { downloadCsv, toCsv } from '../../lib/csv';
import { AdminTable } from '../../components/AdminTable';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { FilterBar } from '../../components/FilterBar';
import { InlineError } from '../../components/InlineError';
import { Pager } from '../../components/Pager';
import { RowMenu } from '../../components/RowMenu';
import { Skeleton } from '../../components/Skeleton';
import { ToastStack, useToastStack } from '../../components/ToastStack';
import { formatDateAdmin } from '../../lib/format';
import { formatExpiry } from '../../lib/utils';
import { TeamPlanModal } from './TeamPlanModal';

interface TeamsTabProps {
  refreshKey: number;
  onSettled?: () => void;
}

const PAGE_SIZE = 25;

/**
 * TECH-DEBT (Fase 1): listAdminTeams belum dukung offset/total server-side
 * (hanya limit). Pager tetap bernomor via client slice seperti Users,
 * tapi total = hasil filter server. Bila dataset >200, perlu tambah
 * limit/offset/total di server (mirror listPlatformUsers) + update client.
 */
export function TeamsTab({ refreshKey, onSettled }: TeamsTabProps) {
  const { t } = useTranslation('extras');
  const [searchParams, setSearchParams] = useSearchParams();
  const planFilter = (searchParams.get('plan') as '' | 'free' | 'pro') || '';
  const qParam = searchParams.get('q') ?? '';
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [searchInput, setSearchInput] = useState(() => qParam);
  const [error, setError] = useState<string | null>(null);
  const [teamPlanModalOpen, setTeamPlanModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);
  // Fase 2: ToastStack global reuse — feedback save plan (role=status, aria-live)
  const { toasts, pushToast, dismissToast } = useToastStack(5000);
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

  const loadTeams = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const loaded = await api.listAdminTeams({
        q: qParam || undefined,
        plan: planFilter || undefined,
      });
      if (latestRequest.current !== requestId) return;
      setTeams(loaded);
      setError(null);
    } catch (err) {
      if (latestRequest.current !== requestId) return;
      setError(getErrorMessage(err, t('admin.teams.errors.load')));
    } finally {
      if (latestRequest.current === requestId) onSettled?.();
    }
  }, [qParam, planFilter, t, onSettled]);

  useEffect(() => {
    void loadTeams();
  }, [refreshKey, loadTeams]);

  function onTeamSaved(saved: AdminTeam) {
    setTeams((prev) =>
      prev ? prev.map((tm) => (tm.id === saved.id ? saved : tm)) : prev,
    );
    pushToast(t('admin.teams.planUpdated', { name: saved.name }));
  }

  // Server-side filtering (opsi B): `teams` sudah difilter ?q + plan oleh server.
  const filteredTeams = teams;
  const totalPages = Math.max(1, Math.ceil((filteredTeams?.length ?? 0) / PAGE_SIZE));
  const pagedTeams = filteredTeams ? filteredTeams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : null;

  useEffect(() => {
    if (error === null && filteredTeams !== null && filteredTeams.length > 0 && page > totalPages) {
      updateParam('page', String(totalPages));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTeams, page, totalPages]);

  function handleExport(): void {
    if (!filteredTeams || filteredTeams.length === 0) return;
    const csv = toCsv(
      filteredTeams.map((tm) => ({
        name: tm.name,
        plan: tm.plan,
        planExpiresAt: tm.planExpiresAt ?? '',
        ownerEmail: tm.ownerEmail ?? '',
        memberCount: tm.memberCount,
        projectCount: tm.projectCount,
        createdAt: tm.createdAt,
      })),
      [
        { key: 'name', label: 'name' },
        { key: 'plan', label: 'plan' },
        { key: 'planExpiresAt', label: 'planExpiresAt' },
        { key: 'ownerEmail', label: 'ownerEmail' },
        { key: 'memberCount', label: 'memberCount' },
        { key: 'projectCount', label: 'projectCount' },
        { key: 'createdAt', label: 'createdAt' },
      ],
    );
    downloadCsv(`admin-teams-p${page}`, csv);
  }

  function openChangePlan(tm: AdminTeam): void {
    setEditingTeam(tm);
    setTeamPlanModalOpen(true);
  }

  const isFiltered = qParam !== '' || planFilter !== '';

  return (
    <section className="tab-panel" aria-label={t('admin.teams.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {teams === null ? t('admin.loading') : t('admin.teams.count', { count: teams.length })}
      </p>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="tab-toolbar">
        <span className="tab-toolbar-title">{t('admin.tabs.teams')}</span>
        <span className="tab-toolbar-actions">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<DownloadSimple size={13} aria-hidden="true" />}
            disabled={!filteredTeams || filteredTeams.length === 0}
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
        searchLabel={t('admin.teams.searchLabel')}
        searchPlaceholder={t('admin.teams.searchPlaceholder')}
        segments={[
          { value: '', label: t('admin.users.allPlans') },
          { value: 'free', label: t('admin.plan.free') },
          { value: 'pro', label: t('admin.plan.pro') },
        ]}
        selectedSegment={planFilter}
        onSegmentChange={setPlanFilterAtomic}
        segmentsAriaLabel={t('admin.teams.filterPlanAria')}
        countText={filteredTeams !== null ? t('admin.teams.count', { count: filteredTeams.length }) : undefined}
      />

      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" leftIcon={<ArrowClockwise size={13} aria-hidden="true" />} onClick={() => void loadTeams()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : teams === null ? (
        <div role="status" aria-busy="true" aria-label="Loading teams">
          <span className="sr-only">Loading teams…</span>
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1].map((i) => (
              <div key={i} className="data-row" style={{ height: 56 }}>
                <div className="data-row-main" style={{ gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Skeleton style={{ width: '40%', height: 14 }} />
                    <Skeleton style={{ width: 64, height: 18, borderRadius: 999 }} />
                    <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                  </div>
                  <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
                </div>
                <Skeleton style={{ width: 88, height: 28, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <AdminTable<AdminTeam>
            caption={t('admin.teams.aria')}
            columns={[
              {
                key: 'team',
                label: t('admin.tabs.teams'),
                render: (tm) => (
                  <span className="cell-stack">
                    <span className="data-row-title">
                      <span className="row-title-text" title={tm.name}>
                        {tm.name}
                      </span>
                      <Badge tone="neutral">{t('admin.teams.memberCount', { count: tm.memberCount })}</Badge>
                      <Badge tone="neutral">{t('admin.teams.projectCount', { count: tm.projectCount })}</Badge>
                      <Badge tone={tm.plan === 'pro' ? 'success' : 'neutral'}>
                        {tm.plan === 'pro' ? t('admin.plan.pro') : t('admin.plan.free')}
                      </Badge>
                    </span>
                    <span className="data-row-meta">
                      {t('admin.teams.meta', {
                        owner: tm.ownerEmail ?? '—',
                        created: formatDateAdmin(tm.createdAt),
                      })}
                    </span>
                  </span>
                ),
              },
              {
                key: 'expiry',
                label: t('admin.plan.pro'),
                align: 'right',
                render: (tm) =>
                  tm.plan === 'pro' && tm.planExpiresAt ? (
                    <span className="cell-stack" style={{ alignItems: 'flex-end' }}>
                      <span className="data-row-meta" style={{ justifyContent: 'flex-end' }}>
                        {t('admin.teams.proUntil', { date: formatDateAdmin(tm.planExpiresAt) })}
                      </span>
                      <Badge tone="neutral" title={tm.planExpiresAt}>
                        {t('admin.teams.proLeft', { when: formatExpiry(tm.planExpiresAt) })}
                      </Badge>
                    </span>
                  ) : tm.plan === 'pro' ? (
                    <Badge tone="success">{t('admin.plan.pro')}</Badge>
                  ) : (
                    <span className="data-row-meta" aria-hidden="true">
                      —
                    </span>
                  ),
              },
            ]}
            rows={pagedTeams ?? []}
            getRowId={(tm) => tm.id}
            rowMenu={(tm) => (
              <RowMenu
                label={t('admin.table.rowActions')}
                items={[
                  {
                    key: 'change-plan',
                    label: t('admin.teams.changePlan'),
                    icon: <PencilSimple size={13} aria-hidden="true" />,
                    onSelect: () => openChangePlan(tm),
                  },
                ]}
              />
            )}
            isFiltered={isFiltered}
            emptyFilteredTitle={t('admin.teams.emptyTitle')}
            emptyFilteredDesc={qParam ? t('admin.teams.emptyQueryDesc', { query: qParam }) : t('admin.teams.emptyDesc')}
            emptyTotalTitle={t('admin.teams.emptyTitle')}
            emptyTotalDesc={t('admin.teams.emptyDesc')}
            onResetFilters={resetFilters}
          />
          <Pager
            page={page}
            totalPages={totalPages}
            totalItems={filteredTeams?.length ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => updateParam('page', String(p))}
            ariaLabel={t('admin.teams.paginationAria', { defaultValue: 'Teams pagination' })}
          />
        </>
      )}

      <TeamPlanModal
        open={teamPlanModalOpen}
        team={editingTeam}
        onClose={() => { setTeamPlanModalOpen(false); setEditingTeam(null); }}
        onSaved={onTeamSaved}
      />
    </section>
  );
}
