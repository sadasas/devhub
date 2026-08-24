import { useCallback, useEffect, useState } from 'react';
import { FolderSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminTeam } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { TeamPlanModal } from './TeamPlanModal';

export function TeamsTab({ refreshKey }: { refreshKey: number }) {
  const { t } = useTranslation('extras');
  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamPlanModalOpen, setTeamPlanModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminTeam | null>(null);

  const loadTeams = useCallback(async () => {
    setError(null);
    try {
      const t = await api.listAdminTeams();
      setTeams(t);
    } catch (err) {
      setTeams([]);
      setError(getErrorMessage(err, t('admin.teams.errors.load')));
    }
  }, [t]);

  useEffect(() => {
    void loadTeams();
  }, [refreshKey, loadTeams]);

  function onTeamSaved(saved: AdminTeam & { plan: string }) {
    setTeams((prev) =>
      prev ? prev.map((t) => (t.id === saved.id ? { ...t, plan: saved.plan } : t)) : prev,
    );
  }

  return (
    <section className="tab-panel" role="tabpanel" aria-label={t('admin.teams.aria')}>
      {teams === null ? (
        <>
          <Skeleton style={{ width: '100%', height: 48 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
        </>
      ) : error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={() => void loadTeams()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : teams.length === 0 ? (
        <EmptyState
          icon={<FolderSimple size={22} />}
          title={t('admin.teams.emptyTitle')}
          description={t('admin.teams.emptyDesc')}
        />
      ) : (
        teams.map((tm) => (
          <div key={tm.id} className="data-row">
            <div className="data-row-main">
              <span className="data-row-title">
                <span className="row-title-text">{tm.name}</span>
                <Badge tone="neutral">{t('admin.teams.memberCount', { count: tm.memberCount })}</Badge>
                <Badge tone="neutral">{t('admin.teams.projectCount', { count: tm.projectCount })}</Badge>
                <Badge tone={(tm as AdminTeam & { plan?: string }).plan === 'pro' ? 'success' : 'neutral'}>
                  {(tm as AdminTeam & { plan?: string }).plan === 'pro' ? t('admin.plan.pro') : t('admin.plan.free')}
                </Badge>
              </span>
              <span className="data-row-meta">
                {t('admin.teams.meta', {
                  owner: tm.ownerEmail ?? '—',
                  created: new Date(tm.createdAt).toLocaleDateString(),
                })}
              </span>
            </div>
            <div className="data-row-side">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingTeam(tm); setTeamPlanModalOpen(true); }}
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
