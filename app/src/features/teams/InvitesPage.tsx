import { useState } from 'react';
import { ArrowLeft, Envelope } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { TEAM_ROLE } from '../../lib/labels';
import { useTeams } from '../../state/teams-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { InlineError } from '../../components/InlineError';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { isPlanLimitError } from '../../lib/errors';

export function InvitesPage() {
  const { invitations, loading, error, acceptInvitation, declineInvitation, refresh } = useTeams();
  const navigate = useNavigate();
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
        setActionError(err instanceof Error ? err.message : 'Failed to accept invitation');
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
      setActionError(err instanceof Error ? err.message : 'Failed to decline invitation');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button type="button" className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={14} aria-hidden="true" />
            Dashboard
          </button>
          <h1 className="page-title">Invitations</h1>
          <p className="page-subtitle">Team invitations waiting for your decision.</p>
        </div>
      </header>

      {error && <InlineError>{error}</InlineError>}
      {actionError && <InlineError>{actionError}</InlineError>}

      {loading ? (
        <Skeleton style={{ width: '100%', height: 48 }} />
      ) : invitations.length === 0 ? (
        <div className="page-empty">
          <EmptyState
            icon={<Envelope size={22} />}
            title="No pending invitations"
            description="When someone invites you to a team, it will appear here."
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
                invited {new Date(inv.createdAt).toLocaleDateString()} · expires{' '}
                {new Date(inv.expiresAt).toLocaleDateString()}
              </span>
            </div>
            <div className="data-row-side">
              <Button
                size="sm"
                loading={busyId === inv.id}
                onClick={() => void onAccept(inv.id, inv.teamId)}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                loading={busyId === inv.id}
                onClick={() => void onDecline(inv.id, inv.teamId)}
              >
                Decline
              </Button>
            </div>
          </div>
        ))
      )}

      {invitations.length > 0 && (
        <div className="page-footer">
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      )}

      <PlanLimitModal
        open={limitOpen}
        resource="members"
        teamId={limitTeamId}
        onClose={() => setLimitOpen(false)}
      />
    </div>
  );
}
