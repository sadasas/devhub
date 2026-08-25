import { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise, CaretLeft, CaretRight, FolderSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
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
  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<'' | 'free' | 'pro'>('');
  const [page, setPage] = useState(1);
  const [teamPlanModalOpen, setTeamPlanModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);

  const loadTeams = useCallback(async () => {
    setError(null);
    try {
      const loaded = await api.listAdminTeams();
      setTeams(loaded);
    } catch (err) {
      setError(getErrorMessage(err, t('admin.teams.errors.load')));
    } finally {
      onSettled?.();
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
    setPage(1);
  }, [planFilter]);

  return (
    <section className="tab-panel" aria-label={t('admin.teams.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {teams === null ? t('admin.loading') : t('admin.teams.count', { count: teams.length })}
      </p>
      <div className="admin-filter-bar">
        <span className="admin-activity-ranges" role="group" aria-label={t('admin.users.filterPlanAria')}>
          <button type="button" className={`sub-tab ${planFilter === '' ? 'sub-tab-active' : ''}`} aria-pressed={planFilter === ''} onClick={() => setPlanFilter('')}>{t('admin.users.allPlans')}</button>
          <button type="button" className={`sub-tab ${planFilter === 'free' ? 'sub-tab-active' : ''}`} aria-pressed={planFilter === 'free'} onClick={() => setPlanFilter('free')}>{t('admin.plan.free')}</button>
          <button type="button" className={`sub-tab ${planFilter === 'pro' ? 'sub-tab-active' : ''}`} aria-pressed={planFilter === 'pro'} onClick={() => setPlanFilter('pro')}>{t('admin.plan.paid')}</button>
        </span>
        <span className="page-subtitle admin-filter-count">
          {filteredTeams !== null ? t('admin.teams.count', { count: filteredTeams.length }) : ''}
        </span>
      </div>
      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="secondary" size="sm" leftIcon={<ArrowClockwise size={12} aria-hidden="true" />} onClick={() => void loadTeams()}>
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
          icon={<FolderSimple size={22} />}
          title={t('admin.teams.emptyTitle')}
          description={t('admin.teams.emptyDesc')}
        />
      ) : (
        <>
          {pagedTeams!.map((tm) => (
            <div key={tm.id} className="data-row">
              <div className="data-row-main">
                <span className="data-row-title">
                  <span className="row-title-text">{tm.name}</span>
                  <Badge tone="neutral">{t('admin.teams.memberCount', { count: tm.memberCount })}</Badge>
                  <Badge tone="neutral">{t('admin.teams.projectCount', { count: tm.projectCount })}</Badge>
                  <Badge tone={tm.plan === 'pro' ? 'success' : 'neutral'}>
                    {tm.plan === 'pro' ? t('admin.plan.paid') : t('admin.plan.free')}
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
                  leftIcon={<FolderSimple size={12} aria-hidden="true" />}
                  onClick={() => { setEditingTeam(tm); setTeamPlanModalOpen(true); }}
                >
                  {t('admin.teams.changePlan')}
                </Button>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <nav className="pager" aria-label={t('admin.teams.paginationAria', { defaultValue: 'Teams pagination' })}>
              <Button size="sm" variant="secondary" leftIcon={<CaretLeft size={12} aria-hidden="true" />} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t('admin.pager.previous')}</Button>
              <span className="pager-status">{t('admin.pager.status', { page, total: totalPages })}</span>
              <Button size="sm" variant="secondary" leftIcon={<CaretRight size={12} aria-hidden="true" />} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{t('admin.pager.next')}</Button>
            </nav>
          )}
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
