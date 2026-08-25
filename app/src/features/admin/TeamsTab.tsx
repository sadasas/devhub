import { useCallback, useEffect, useState } from 'react';
import { CaretLeft, CaretRight, FolderSimple } from '@phosphor-icons/react';
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

export function TeamsTab({ refreshKey, onSettled }: TeamsTabProps) {
  const { t } = useTranslation('extras');
  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<'' | 'free' | 'pro'>('');
  const [teamPlanModalOpen, setTeamPlanModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);

  const loadTeams = useCallback(async () => {
    setError(null);
    try {
      const loaded = await api.listAdminTeams();
      setTeams(loaded);
    } catch (err) {
      // Jangan set [] saat gagal (audit H3): error dan empty harus eksklusif.
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

  return (
    <section className="tab-panel" aria-label={t('admin.teams.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {teams === null ? t('admin.loading') : t('admin.teams.count', { count: teams.length })}
      </p>
      <div className="admin-filter-bar">
        <span className="admin-activity-ranges" role="group" aria-label={t('admin.users.filterPlanAria')}>
          <button type="button" className={`sub-tab ${planFilter === '' ? 'sub-tab-active' : ''}`} aria-pressed={planFilter === ''} onClick={() => setPlanFilter('')}>{t('admin.users.allPlans')}</button>
          <button type="button" className={`sub-tab ${planFilter === 'free' ? 'sub-tab-active' : ''}`} aria-pressed={planFilter === 'free'} onClick={() => setPlanFilter('free')}>{t('admin.plan.free')}</button>
          <button type="button" className={`sub-tab ${planFilter === 'pro' ? 'sub-tab-active' : ''}`} aria-pressed={planFilter === 'pro'} onClick={() => setPlanFilter('pro')}>{t('admin.plan.pro')}</button>
        </span>
        <span className="page-subtitle admin-filter-count">
          {filteredTeams !== null ? t('admin.teams.count', { count: filteredTeams.length }) : ''}
        </span>
      </div>
      {/* Kontrak eksklusif (audit H3): error ⊕ skeleton ⊕ empty ⊕ data */}
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
          icon={<FolderSimple size={22} />}
          title={t('admin.teams.emptyTitle')}
          description={t('admin.teams.emptyDesc')}
        />
      ) : (
        filteredTeams!.map((tm) => (
          <div key={tm.id} className="data-row">
            <div className="data-row-main">
              <span className="data-row-title">
                <span className="row-title-text">{tm.name}</span>
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
                variant="secondary" size="sm" leftIcon={<FolderSimple size={12} aria-hidden="true" />} onClick={() => { setEditingTeam(tm); setTeamPlanModalOpen(true); }}
              >
                {t('admin.teams.changePlan')}
              </Button>
            </div>
          </div>
        ))
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


