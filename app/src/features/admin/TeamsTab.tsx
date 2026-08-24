import { useCallback, useEffect, useState } from 'react';
import { FolderSimple } from '@phosphor-icons/react';
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
      setError(getErrorMessage(err, 'Failed to load teams'));
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [refreshKey, loadTeams]);

  function onTeamSaved(saved: AdminTeam & { plan: string }) {
    setTeams((prev) =>
      prev ? prev.map((t) => (t.id === saved.id ? { ...t, plan: saved.plan } : t)) : prev,
    );
  }

  return (
    <section className="tab-panel" role="tabpanel" aria-label="Platform teams">
      {teams === null ? (
        <>
          <Skeleton style={{ width: '100%', height: 48 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
        </>
      ) : error ? (
        <InlineError className="mb-12">
          {error}{' '}
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
                <Badge tone="neutral">{t.memberCount} members</Badge>
                <Badge tone="neutral">{t.projectCount} projects</Badge>
                <Badge tone={(t as AdminTeam & { plan?: string }).plan === 'pro' ? 'success' : 'neutral'}>
                  {(t as AdminTeam & { plan?: string }).plan === 'pro' ? 'Pro' : 'Free'}
                </Badge>
              </span>
              <span className="data-row-meta">
                owner {t.ownerEmail ?? '—'} · created{' '}
                {new Date(t.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="data-row-side">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingTeam(t); setTeamPlanModalOpen(true); }}
              >
                Change plan
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
