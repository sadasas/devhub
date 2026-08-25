import {
  BookOpen,
  BookmarkSimple,
  CurrencyCircleDollar,
  EnvelopeSimple,
  FolderSimple,
  Key,
  MagnifyingGlass,
  Plus,
  Receipt,
  ShieldStar,
  SignOut,
  SquaresFour,
  UsersThree,
} from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { NavLink, type NavLinkProps } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../state/auth-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { initialsOf } from '../../lib/initials';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Skeleton } from '../../components/Skeleton';
import { NewProjectModal } from '../dashboard/NewProjectModal';

interface SidebarProps {
  activeTeamId?: string | null;
  onCreateTeam?: () => void;
}

export function Sidebar({ activeTeamId, onCreateTeam }: SidebarProps) {
  const { user, logout } = useAuth();
  const { projects } = useProjects();
  const { teams, invitations } = useTeams();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [prefillTeamId, setPrefillTeamId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const { t } = useTranslation('shell');

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
  const activeTeam = teams?.find((tm) => tm.id === activeTeamId) ?? null;
  const teamProjectsAll = activeTeam ? (projectsByTeam.get(activeTeam.id) ?? []) : [];
  const showFilter = teamProjectsAll.length > 8;

  const lowerQuery = filterQuery.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    const list = [...teamProjectsAll].sort((a, b) => a.name.localeCompare(b.name));
    if (!lowerQuery) return list;
    return list.filter((p) => p.name.toLowerCase().includes(lowerQuery));
  }, [teamProjectsAll, lowerQuery]);

  const itemClass =
    (extra = ''): NavLinkProps['className'] =>
    ({ isActive }) =>
      `sidebar-item${extra ? ` ${extra}` : ''}${isActive ? ' sidebar-item-active' : ''}`;

  const openCreateProject = (teamId?: string) => {
    setPrefillTeamId(teamId ?? activeTeamId ?? null);
    setCreateProjectOpen(true);
  };

  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar-brand">
        <Logo size={18} />
        <span>DevHub</span>
      </div>

      <nav className="sidebar-nav" aria-label={t('sidebar.mainNav')}>
        <NavLink to="/" end className={itemClass()} aria-label={t('sidebar.dashboard')}>
          <SquaresFour size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.dashboard')}</span>
        </NavLink>
        <NavLink to="/invites" className={itemClass()} aria-label={t('sidebar.invitations')}>
          <EnvelopeSimple size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.invitations')}</span>
          {invitations.length > 0 && (
            <span className="sidebar-count-urgent" aria-label={`${invitations.length} invitations`}>
              {invitations.length > 99 ? '99+' : invitations.length}
            </span>
          )}
        </NavLink>
      </nav>

      <div className="sidebar-divider" aria-hidden="true" />

      {teamsLoading ? (
        <>
          <Skeleton className="sidebar-skeleton" />
          <Skeleton className="sidebar-skeleton" />
          <Skeleton className="sidebar-skeleton" />
        </>
      ) : !activeTeam ? (
        <div className="sidebar-empty">
          <p>{t('sidebar.noTeamsYet')}</p>
          <Button variant="ghost" size="sm" onClick={() => onCreateTeam?.()}>
            {t('sidebar.createTeam')}
          </Button>
        </div>
      ) : (
        <>
          <div className="sidebar-section sidebar-section-row">
            <span className="sidebar-team-active-label" title={activeTeam.name}>
              <UsersThree size={12} weight="duotone" aria-hidden="true" />
              <span className="sidebar-item-label">{activeTeam.name}</span>
            </span>
            <span className="sidebar-count-muted" aria-label={`${teamProjectsAll.length} projects`}>
              {teamProjectsAll.length}
            </span>
            <span className="sidebar-count-muted" aria-label={`${activeTeam.memberCount} members`}>
              {activeTeam.memberCount}
            </span>
            <button
              type="button"
              className="sidebar-add-btn"
              title={`New project in ${activeTeam.name}`}
              aria-label={`New project in ${activeTeam.name}`}
              onClick={() => openCreateProject(activeTeam.id)}
            >
              <Plus size={12} weight="bold" aria-hidden="true" />
            </button>
          </div>

          {showFilter && (
            <div className="sidebar-filter" role="search">
              <MagnifyingGlass size={14} aria-hidden="true" className="sidebar-filter-icon" />
              <input
                type="text"
                className="sidebar-filter-input"
                placeholder={t('sidebar.filterPlaceholder', { defaultValue: 'Filter projects…' }) as string}
                aria-label={t('sidebar.filterPlaceholder', { defaultValue: 'Filter projects' }) as string}
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>
          )}

          <nav className="sidebar-nav sidebar-nav-grow" aria-label={t('sidebar.teamsNav')}>
            {filteredProjects.length === 0 ? (
              lowerQuery ? (
                <div className="sidebar-empty">
                  <p>No matches for “{filterQuery}”</p>
                  <Button variant="ghost" size="sm" onClick={() => setFilterQuery('')}>
                    Clear filter
                  </Button>
                </div>
              ) : (
                <div className="sidebar-project-empty">
                  <span>No projects yet.</span>{' '}
                  <button type="button" className="sidebar-link-btn" onClick={() => openCreateProject(activeTeam.id)}>
                    Create project
                  </button>
                </div>
              )
            ) : (
              filteredProjects.map((p) => (
                <NavLink
                  key={p.id}
                  to={`/project/${p.id}`}
                  className={itemClass('sidebar-project-item')}
                  title={p.name}
                >
                  <FolderSimple size={14} weight="duotone" aria-hidden="true" />
                  <span className="sidebar-item-label">{p.name}</span>
                </NavLink>
              ))
            )}
            <div className="sidebar-team-footer">
              <NavLink to={`/team/${activeTeam.id}`} className="sidebar-team-link">
                View team →
              </NavLink>
            </div>
          </nav>
        </>
      )}

      <div className="sidebar-divider" aria-hidden="true" />

      <nav className="sidebar-nav" aria-label="Utility">
        <NavLink to="/keys" className={itemClass()} aria-label={t('sidebar.apiKeys')}>
          <Key size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.apiKeys')}</span>
        </NavLink>
        <NavLink to="/templates" className={itemClass()} aria-label={t('sidebar.templatesNav')}>
          <BookmarkSimple size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.templates')}</span>
        </NavLink>
        <NavLink to="/pricing" className={itemClass()} aria-label={t('sidebar.pricing')}>
          <CurrencyCircleDollar size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.pricing')}</span>
        </NavLink>
        <NavLink to="/payments" className={itemClass()} aria-label={t('sidebar.payments')}>
          <Receipt size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.payments')}</span>
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={itemClass()} aria-label={t('sidebar.admin')}>
            <ShieldStar size={15} weight="duotone" aria-hidden="true" />
            <span>{t('sidebar.admin')}</span>
          </NavLink>
        )}
        <NavLink to="/docs" className={itemClass()} aria-label={t('sidebar.docs')}>
          <BookOpen size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.docs')}</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/profile" className={itemClass('sidebar-user')} aria-label={t('sidebar.profile')}>
          <span className="sidebar-user-avatar" aria-hidden="true">
            {user ? initialsOf(user.displayName, user.email) : '?'}
          </span>
          <span className="sidebar-user-meta">
            <span className="sidebar-user-name" title={user?.email}>
              {user?.displayName.trim() || user?.email || t('sidebar.signedIn')}
            </span>
            <span className="sidebar-user-email">{user?.email}</span>
          </span>
        </NavLink>
        <button
          type="button"
          className="sidebar-signout"
          title={t('sidebar.signOut')}
          aria-label={t('sidebar.signOut')}
          onClick={() => void logout()}
        >
          <SignOut size={15} aria-hidden="true" />
        </button>
      </div>

      <NewProjectModal
        open={createProjectOpen}
        onClose={() => {
          setCreateProjectOpen(false);
          setPrefillTeamId(null);
        }}
        initialTeamId={prefillTeamId}
      />
    </aside>
  );
}
