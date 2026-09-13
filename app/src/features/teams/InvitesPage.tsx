import { useState } from 'react';
import { Link } from 'react-router';
import { Envelope, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TEAM_ROLE } from '../../lib/labels';
import { useTeams } from '../../state/teams-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { InlineError } from '../../components/InlineError';
import { DataErrorState } from '../../components/DataErrorState';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { isPlanLimitError } from '../../lib/errors';

export function InvitesPage() {
  const { t } = useTranslation('account');
  const { invitations, loading, error, loadError, acceptInvitation, declineInvitation, refresh } = useTeams();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitTeamId, setLimitTeamId] = useState('');

  async function onAccept(invitationId: string, teamId: string) {
    setBusyId(invitationId);
    setActionError(null);
    try {
      await acceptInvitation(teamId, invitationId);
    } catch (err) {
      if (isPlanLimitError(err)) {
        setLimitTeamId(teamId);
        setLimitOpen(true);
      } else {
        setActionError(err instanceof Error ? err.message : t('teams.invites.acceptError'));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onDecline(invitationId: string, teamId: string) {
    setBusyId(invitationId);
    setActionError(null);
    try {
      await declineInvitation(teamId, invitationId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('teams.invites.declineError'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      {/* Flat content card wraps page content; modal stays as sibling portal target. */}
      <article className="pcard">
        <div className="pcard-body">
          <div className="narrow-center">
          <header className="page-header">
            <div>
              <h1 className="page-title">{t('teams.invites.title')}</h1>
              <p className="page-subtitle">{t('teams.invites.subtitle')}</p>
            </div>
            <Link className="sidebar-team-link" to="/">
              Buat team baru →
            </Link>
          </header>

          {error ? <DataErrorState error={loadError ?? error} onRetry={() => void refresh()} /> : null}
          {actionError && <InlineError>{actionError}</InlineError>}

          {loading ? (
            <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1].map((i) => (
                <div key={i} className="data-row">
                  <div className="data-row-main" style={{ gap: 6 }}>
                    <div className="data-row-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Skeleton style={{ width: '45%', height: 14 }} />
                      <Skeleton style={{ width: 56, height: 18, borderRadius: 6 }} />
                    </div>
                    <Skeleton style={{ width: '60%', height: 11 }} />
                  </div>
                  <div className="data-row-side" style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <Skeleton style={{ width: 72, height: 28, borderRadius: 8 }} />
                    <Skeleton style={{ width: 88, height: 28, borderRadius: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <div className="page-empty">
              <EmptyState
                icon={<Envelope size={24} weight="duotone" />}
                title={t('teams.invites.emptyTitle')}
                description={t('teams.invites.emptyDescription')}
              />
            </div>
          ) : (
            invitations.map((inv) => (
              <div key={inv.id} className="data-row">
                <div className="data-row-main">
                  <span className="data-row-title">
                    <span className="row-title-text">{inv.teamName}</span>
                    <Badge tone={TEAM_ROLE[inv.role].tone}>{TEAM_ROLE[inv.role].label}</Badge>
                  </span>
                  <span className="data-row-meta">
                    {t('teams.invites.meta', {
                      created: new Date(inv.createdAt).toLocaleDateString(),
                      expires: new Date(inv.expiresAt).toLocaleDateString(),
                    })}
                  </span>
                </div>
                <div className="data-row-side" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <Button
                    size="sm"
                    loading={busyId === inv.id}
                    onClick={() => void onAccept(inv.id, inv.teamId)}
                  >
                    {t('teams.invites.accept')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<Trash size={13} aria-hidden="true" />}
                    loading={busyId === inv.id}
                    onClick={() => void onDecline(inv.id, inv.teamId)}
                  >
                    {t('teams.invites.decline')}
                  </Button>
                </div>
              </div>
            ))
          )}

          {invitations.length > 0 && (
            <div className="page-footer">
              <Button variant="ghost" size="md" onClick={() => void refresh()}>
                {t('teams.invites.refresh')}
              </Button>
            </div>
          )}
          </div>
        </div>
      </article>

      <PlanLimitModal
        open={limitOpen}
        resource="members"
        teamId={limitTeamId}
        onClose={() => setLimitOpen(false)}
      />
    </div>
  );
}
