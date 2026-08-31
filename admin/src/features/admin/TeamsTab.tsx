import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminTeam } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { formatDateAdmin } from '../../lib/format';
import { TeamPlanModal } from './TeamPlanModal';

interface TeamsTabProps {
  refreshKey: number;
  onSettled?: () => void;
}

const PAGE_SIZE = 25;

export function TeamsTab({ refreshKey, onSettled }: TeamsTabProps) {
  const { t } = useTranslation('extras');
  const [searchParams, setSearchParams] = useSearchParams();
  const planFilter = (searchParams.get('plan') as '' | 'free' | 'pro') || '';
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamPlanModalOpen, setTeamPlanModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);
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

  const loadTeams = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const loaded = await api.listAdminTeams();
      if (latestRequest.current !== requestId) return;
      setTeams(loaded);
      setError(null);
    } catch (err) {
      if (latestRequest.current !== requestId) return;
      setError(getErrorMessage(err, t('admin.teams.errors.load')));
    } finally {
      if (latestRequest.current === requestId) onSettled?.();
    }
  }, [t, onSettled]);

  useEffect(() => {
    void loadTeams();
  }, [refreshKey, loadTeams]);

  function onTeamSaved(saved: AdminTeam) {
    setTeams((prev) =>
      prev ? prev.map((tm) => (tm.id === saved.id ? saved : tm)) : prev,
    );
  }

  const filteredTeams = teams ? teams.filter((tm) => {
    if (planFilter === 'free') return tm.plan === 'free';
    if (planFilter === 'pro') return tm.plan === 'pro';
    return true;
  }) : null;
  const totalPages = Math.max(1, Math.ceil((filteredTeams?.length ?? 0) / PAGE_SIZE));
  const pagedTeams = filteredTeams ? filteredTeams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : null;

  useEffect(() => {
    if (error === null && filteredTeams !== null && filteredTeams.length > 0 && page > totalPages) {
      updateParam('page', String(totalPages));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTeams, page, totalPages]);

  return (
    <section className="tab-panel" aria-label={t('admin.teams.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {teams === null ? t('admin.loading') : t('admin.teams.count', { count: teams.length })}
      </p>
      <div className="admin-filter-bar">
        <span className="admin-activity-ranges" role="radiogroup" aria-label={t('admin.teams.filterPlanAria', { defaultValue: 'Filter plan' })}>
          <button type="button" role="radio" aria-checked={planFilter === ''} className={`sub-tab ${planFilter === '' ? 'sub-tab-active' : ''}`} tabIndex={planFilter === '' ? 0 : -1} onClick={() => setPlanFilterAtomic(null)}>{t('admin.users.allPlans')}</button>
          <button type="button" role="radio" aria-checked={planFilter === 'free'} className={`sub-tab ${planFilter === 'free' ? 'sub-tab-active' : ''}`} tabIndex={planFilter === 'free' ? 0 : -1} onClick={() => setPlanFilterAtomic('free')}>{t('admin.plan.free')}</button>
          <button type="button" role="radio" aria-checked={planFilter === 'pro'} className={`sub-tab ${planFilter === 'pro' ? 'sub-tab-active' : ''}`} tabIndex={planFilter === 'pro' ? 0 : -1} onClick={() => setPlanFilterAtomic('pro')}>{t('admin.plan.pro')}</button>
        </span>
        <span className="page-subtitle admin-filter-count">
          {filteredTeams !== null ? t('admin.teams.count', { count: filteredTeams.length }) : ''}
        </span>
      </div>
      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void loadTeams()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : teams === null ? (
        <>
          <Skeleton style={{ width: '100%', height: 48 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
        </>
      ) : filteredTeams!.length === 0 ? (
        <EmptyState
          icon={<span aria-hidden="true" />}
          title={t('admin.teams.emptyTitle')}
          description={t('admin.teams.emptyDesc')}
        />
      ) : (
        <div role="list">
          {pagedTeams!.map((tm) => (
            <div key={tm.id} className="data-row" role="listitem">
              <div className="data-row-main">
                <span className="data-row-title">
                  <span className="row-title-text" title={tm.name}>{tm.name}</span>
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
              </div>
              <div className="data-row-side">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setEditingTeam(tm); setTeamPlanModalOpen(true); }}
                >
                  {t('admin.teams.changePlan')}
                </Button>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <nav className="pager" aria-label={t('admin.teams.paginationAria', { defaultValue: 'Teams pagination' })}>
              <Button size="sm" variant="secondary" leftIcon={<CaretLeft size={12} aria-hidden="true" />} disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))}>{t('admin.pager.previous')}</Button>
              <span className="pager-status">{t('admin.pager.status', { page, total: totalPages })}</span>
              <Button size="sm" variant="secondary" leftIcon={<CaretRight size={12} aria-hidden="true" />} disabled={page >= totalPages} onClick={() => updateParam('page', String(page + 1))}>{t('admin.pager.next')}</Button>
            </nav>
          )}
        </div>
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
