import { ArrowLeft, Envelope } from '@phosphor-icons/react';
import { TEAM_ROLE } from '../../lib/labels';
import { useNavigation } from '../../state/navigation-context';
import { useTeams } from '../../state/teams-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';

export function InvitesPage() {
  const { invitations, loading, error, acceptInvitation, declineInvitation, refresh } = useTeams();
  const { openDashboard } = useNavigation();

  async function onAccept(invitationId: string, teamId: string) {
    try {
      await acceptInvitation(teamId, invitationId);
    } catch (err) {
      void err;
    }
  }

  async function onDecline(invitationId: string, teamId: string) {
    try {
      await declineInvitation(teamId, invitationId);
    } catch (err) {
      void err;
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button type="button" className="back-btn" onClick={openDashboard}>
            <ArrowLeft size={14} aria-hidden="true" />
            Dashboard
          </button>
          <h1 className="page-title">Invitations</h1>
          <p className="page-subtitle">Team invitations waiting for your decision.</p>
        </div>
      </header>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

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
                onClick={() => void onAccept(inv.id, inv.teamId)}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() => void onDecline(inv.id, inv.teamId)}
              >
                Decline
              </Button>
            </div>
          </div>
        ))
      )}

      {invitations.length > 0 && (
        <div className="page-footer" style={{ marginTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      )}
    </div>
  );
}
