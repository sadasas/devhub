import { Navigate, useSearchParams } from 'react-router';
import { useTeams } from '../../state/teams-context';
import { readLastActiveTeamId } from '../layout/WorkspaceSwitcher';
import { resolveDashboardTeamId } from './DashboardPage';
import { DashboardSkeleton } from '../../components/PageSkeletons';
import { ZeroTeamOnboarding } from '../onboarding/ZeroTeamOnboarding';

// HomeRedirect — Linear-style `/` resolver (no All-Team dashboard).
// `/` never renders a project list: it 302-replaces to the canonical team
// dashboard (/:slug/projects) preserving legacy query, or to /invites for
// invite-only users. The only render case is zero-team onboarding.
export function HomeRedirect() {
  const { teams, invitations } = useTeams();
  const [searchParams] = useSearchParams();

  if (teams === null) return <DashboardSkeleton />;

  if (teams.length === 0) {
    if (invitations.length > 0) return <Navigate to="/invites" replace />;
    return <ZeroTeamOnboarding />;
  }

  // Legacy `/` query mapping: ?team=X selects the team, ?tab selects the
  // workspace tab, list filters ride along to the projects tab.
  // Setup-return GitHub (?github=installed&installation_id=&setup_action=)
  // ikut diloloskan agar gate global bisa menyelesaikannya di halaman tim.
  const teamId = resolveDashboardTeamId(teams, searchParams.get('team'), readLastActiveTeamId());
  const team = teams.find((tm) => tm.id === teamId) ?? teams[0];
  if (!team) return <DashboardSkeleton />;
  const slug = encodeURIComponent(team.slug || team.id);
  const tab = searchParams.get('tab');
  const suffix = tab === 'members' || tab === 'settings' ? tab : 'projects';
  const next = new URLSearchParams();
  for (const key of ['q', 'sort', 'status', 'filter', 'new', 'github', 'installation_id', 'setup_action']) {
    const value = searchParams.get(key);
    if (value !== null && value !== '') next.set(key, value);
  }
  const qs = next.toString();
  return <Navigate to={`/${slug}/${suffix}${qs ? `?${qs}` : ''}`} replace />;
}
