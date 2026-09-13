import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EnvelopeSimple, Notebook, Plus } from '@phosphor-icons/react';
import { useTeams } from '../../state/teams-context';
import { readLastActiveTeamId } from '../layout/WorkspaceSwitcher';
import { resolveDashboardTeamId } from './DashboardPage';
import { DashboardSkeleton } from '../../components/PageSkeletons';
import { Button } from '../../components/Button';
import { CreateTeamModal } from '../teams/CreateTeamModal';

// HomeRedirect — Linear-style `/` resolver (no All-Team dashboard).
// `/` never renders a project list: it 302-replaces to the canonical team
// dashboard (/:slug/projects) preserving legacy query, or to /invites for
// invite-only users. The only render case is zero-team onboarding.
export function HomeRedirect() {
  const { t } = useTranslation('account');
  const { teams, invitations } = useTeams();
  const [searchParams] = useSearchParams();
  const [teamCreateOpen, setTeamCreateOpen] = useState(false);

  if (teams === null) return <DashboardSkeleton />;

  if (teams.length === 0) {
    if (invitations.length > 0) return <Navigate to="/invites" replace />;
    return (
      <div className="dashboard__onboarding" role="status" aria-live="polite">
        <p className="dashboard__eyebrow" aria-hidden="true">
          WORKSPACE / start
        </p>
        <h1 className="page-title dashboard__onboarding-title">{t('dashboard.team.onboardingTitle')}</h1>
        <p className="page-subtitle dashboard__onboarding-desc">{t('dashboard.team.onboardingDesc')}</p>
        <div className="dashboard__onboarding-actions">
          <Button
            leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
            onClick={() => setTeamCreateOpen(true)}
            data-tour-id="create-team"
          >
            {t('dashboard.welcome.empty.createTeam')}
          </Button>
          <Link className="btn btn-secondary btn-md dashboard__onboarding-link" to="/invites">
            <EnvelopeSimple size={14} aria-hidden="true" />
            {t('dashboard.team.viewInvites')}
          </Link>
          <Link className="btn btn-ghost btn-md dashboard__onboarding-link" to="/docs">
            <Notebook size={14} aria-hidden="true" />
            {t('dashboard.team.viewDocs')}
          </Link>
        </div>
        <CreateTeamModal open={teamCreateOpen} onClose={() => setTeamCreateOpen(false)} />
      </div>
    );
  }

  // Legacy `/` query mapping: ?team=X selects the team, ?tab selects the
  // workspace tab, list filters ride along to the projects tab.
  const teamId = resolveDashboardTeamId(teams, searchParams.get('team'), readLastActiveTeamId());
  const team = teams.find((tm) => tm.id === teamId) ?? teams[0];
  if (!team) return <DashboardSkeleton />;
  const slug = encodeURIComponent(team.slug || team.id);
  const tab = searchParams.get('tab');
  const suffix = tab === 'members' || tab === 'settings' ? tab : 'projects';
  const next = new URLSearchParams();
  for (const key of ['q', 'sort', 'status', 'filter', 'new']) {
    const value = searchParams.get(key);
    if (value !== null && value !== '') next.set(key, value);
  }
  const qs = next.toString();
  return <Navigate to={`/${slug}/${suffix}${qs ? `?${qs}` : ''}`} replace />;
}
