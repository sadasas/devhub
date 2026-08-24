import { BookOpen, BookmarkSimple, CurrencyCircleDollar, EnvelopeSimple, FolderSimple, Key, Plus, Receipt, ShieldStar, SignOut, SquaresFour, UsersThree } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { NavLink, type NavLinkProps } from 'react-router';
import { useAuth } from '../../state/auth-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { initialsOf } from '../../lib/initials';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Skeleton } from '../../components/Skeleton';
import { CreateTeamModal } from '../teams/CreateTeamModal';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { projects } = useProjects();
  const { teams, invitations } = useTeams();
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

  const itemClass =
    (extra = ''): NavLinkProps['className'] =>
    ({ isActive }) =>
      `sidebar-item${extra ? ` ${extra}` : ''}${isActive ? ' sidebar-item-active' : ''}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo size={18} />
        <span>DevHub</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <NavLink to="/" end className={itemClass()} aria-label="Dashboard">
          <SquaresFour size={15} weight="duotone" aria-hidden="true" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/invites" className={itemClass()} aria-label="Invitations">
          <EnvelopeSimple size={15} weight="duotone" aria-hidden="true" />
          <span>Invitations</span>
          {invitations.length > 0 && <span className="sidebar-count">{invitations.length}</span>}
        </NavLink>
        <NavLink to="/keys" className={itemClass()} aria-label="API Keys">
          <Key size={15} weight="duotone" aria-hidden="true" />
          <span>API Keys</span>
        </NavLink>
        <NavLink to="/templates" className={itemClass()} aria-label="Project Templates">
          <BookmarkSimple size={15} weight="duotone" aria-hidden="true" />
          <span>Templates</span>
        </NavLink>
        <NavLink to="/pricing" className={itemClass()} aria-label="Pricing">
          <CurrencyCircleDollar size={15} weight="duotone" aria-hidden="true" />
          <span>Pricing</span>
        </NavLink>
        <NavLink to="/payments" className={itemClass()} aria-label="Payment History">
          <Receipt size={15} weight="duotone" aria-hidden="true" />
          <span>Payment History</span>
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={itemClass()} aria-label="Admin">
            <ShieldStar size={15} weight="duotone" aria-hidden="true" />
            <span>Admin</span>
          </NavLink>
        )}
        <NavLink to="/docs" className={itemClass()} aria-label="Docs">
          <BookOpen size={15} weight="duotone" aria-hidden="true" />
          <span>Docs</span>
        </NavLink>
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
            return (
              <div key={t.id} className="sidebar-team">
                <NavLink to={`/team/${t.id}`} className={itemClass('sidebar-team-head')}>
                  <UsersThree size={13} weight="duotone" aria-hidden="true" />
                  <span className="sidebar-item-label" title={t.name}>
                    {t.name}
                  </span>
                  <span className="sidebar-count">{t.memberCount}</span>
                </NavLink>
                {teamProjects.map((p) => (
                  <NavLink
                    key={p.id}
                    to={`/project/${p.id}`}
                    className={itemClass('sidebar-project-item')}
                  >
                    <FolderSimple size={14} weight="duotone" aria-hidden="true" />
                    <span className="sidebar-item-label" title={p.name}>
                      {p.name}
                    </span>
                  </NavLink>
                ))}
              </div>
            );
          })
        )}
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/profile" className={itemClass('sidebar-user')} aria-label="Profile">
          <span className="sidebar-user-avatar" aria-hidden="true">
            {user ? initialsOf(user.displayName, user.email) : '?'}
          </span>
          <span className="sidebar-user-meta">
            <span className="sidebar-user-name" title={user?.email}>
              {user?.displayName.trim() || user?.email || 'Signed in'}
            </span>
            <span className="sidebar-user-email">{user?.email}</span>
          </span>
        </NavLink>
        <button
          type="button"
          className="sidebar-signout"
          title="Sign out"
          aria-label="Sign out"
          onClick={() => void logout()}
        >
          <SignOut size={15} aria-hidden="true" />
        </button>
      </div>

      <CreateTeamModal open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
    </aside>
  );
}
