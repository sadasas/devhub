import { EnvelopeSimple, FolderSimple, Key, Plus, Robot, SignOut, SquaresFour, UsersThree } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../state/auth-context';
import { useNavigation } from '../../state/navigation-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Skeleton } from '../../components/Skeleton';
import { CreateTeamModal } from '../teams/CreateTeamModal';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { projects } = useProjects();
  const { teams, invitations } = useTeams();
  const { view, openDashboard, openProject, openTeam, openInvites, openKeys, openMcpGuide } =
    useNavigation();
  const [createTeamOpen, setCreateTeamOpen] = useState(false);

  const projectsByTeam = useMemo(() => {
    const map = new Map<string, typeof projects>();
    for (const p of projects ?? []) {
      const list = map.get(p.teamId) ?? [];
      list.push(p);
      map.set(p.teamId, list);
    }
    return map;
  }, [projects]);

  const teamsLoading = teams === null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo size={18} />
        <span>DevHub</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <button
          type="button"
          className={`sidebar-item ${view.name === 'dashboard' ? 'sidebar-item-active' : ''}`}
          aria-current={view.name === 'dashboard' ? 'page' : undefined}
          onClick={openDashboard}
        >
          <SquaresFour size={15} weight="duotone" aria-hidden="true" />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`sidebar-item ${view.name === 'invites' ? 'sidebar-item-active' : ''}`}
          aria-current={view.name === 'invites' ? 'page' : undefined}
          onClick={openInvites}
        >
          <EnvelopeSimple size={15} weight="duotone" aria-hidden="true" />
          <span>Invitations</span>
          {invitations.length > 0 && <span className="sidebar-count">{invitations.length}</span>}
        </button>
        <button
          type="button"
          className={`sidebar-item ${view.name === 'keys' ? 'sidebar-item-active' : ''}`}
          aria-current={view.name === 'keys' ? 'page' : undefined}
          onClick={openKeys}
        >
          <Key size={15} weight="duotone" aria-hidden="true" />
          <span>API Keys</span>
        </button>
        <button
          type="button"
          className={`sidebar-item ${view.name === 'mcp' ? 'sidebar-item-active' : ''}`}
          aria-current={view.name === 'mcp' ? 'page' : undefined}
          onClick={openMcpGuide}
        >
          <Robot size={15} weight="duotone" aria-hidden="true" />
          <span>MCP Guide</span>
        </button>
      </nav>

      <div className="sidebar-section sidebar-section-row">
        <span>Teams</span>
        <button
          type="button"
          className="sidebar-add-btn"
          title="New team"
          aria-label="New team"
          onClick={() => setCreateTeamOpen(true)}
        >
          <Plus size={12} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <nav className="sidebar-nav sidebar-nav-grow" aria-label="Teams and projects">
        {teamsLoading ? (
          <>
            <Skeleton className="sidebar-skeleton" />
            <Skeleton className="sidebar-skeleton" />
            <Skeleton className="sidebar-skeleton" />
          </>
        ) : teams?.length === 0 ? (
          <div className="sidebar-empty">
            <p>No teams yet.</p>
            <Button variant="ghost" size="sm" onClick={() => setCreateTeamOpen(true)}>
              Create team
            </Button>
          </div>
        ) : (
          teams?.map((t) => {
            const teamProjects = projectsByTeam.get(t.id) ?? [];
            const teamActive = view.name === 'team' && view.teamId === t.id;
            return (
              <div key={t.id} className="sidebar-team">
                <button
                  type="button"
                  className={`sidebar-item sidebar-team-head ${teamActive ? 'sidebar-item-active' : ''}`}
                  aria-current={teamActive ? 'page' : undefined}
                  onClick={() => openTeam(t.id)}
                >
                  <UsersThree size={13} weight="duotone" aria-hidden="true" />
                  <span className="sidebar-item-label" title={t.name}>
                    {t.name}
                  </span>
                  <span className="sidebar-count">{t.memberCount}</span>
                </button>
                {teamProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`sidebar-item sidebar-project-item ${
                      view.name === 'project' && view.projectId === p.id ? 'sidebar-item-active' : ''
                    }`}
                    aria-current={view.name === 'project' && view.projectId === p.id ? 'page' : undefined}
                    onClick={() => openProject(p.id)}
                  >
                    <FolderSimple size={14} weight="duotone" aria-hidden="true" />
                    <span className="sidebar-item-label" title={p.name}>
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-email" title={user?.email}>
            {user?.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<SignOut size={14} aria-hidden="true" />}
          onClick={() => void logout()}
        >
          Sign out
        </Button>
      </div>

      <CreateTeamModal open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
    </aside>
  );
}
