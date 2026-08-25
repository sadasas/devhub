import {
  BookOpen,
  BookmarkSimple,
  CaretRight,
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
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, type NavLinkProps } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../state/auth-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { initialsOf } from '../../lib/initials';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Skeleton } from '../../components/Skeleton';
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { NewProjectModal } from '../dashboard/NewProjectModal';

const COLLAPSED_KEY = 'devhub:sidebar:collapsed';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { projects } = useProjects();
  const { teams, invitations } = useTeams();
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [prefillTeamId, setPrefillTeamId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const location = useLocation();
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
  const totalProjects = projects?.length ?? 0;
  const showFilter = (teams?.length ?? 0) > 3 || totalProjects > 8;

  const [collapsedIds, setCollapsedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsedIds));
    } catch {
      // ignore
    }
  }, [collapsedIds]);

  const toggleTeam = (teamId: string) => {
    setCollapsedIds((prev) => (prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]));
  };

  const activeTeamId = useMemo(() => {
    if (location.pathname.startsWith('/team/')) {
      return location.pathname.split('/')[2] ?? null;
    }
    if (location.pathname.startsWith('/project/')) {
      const pid = location.pathname.split('/')[2];
      const proj = (projects ?? []).find((p) => p.id === pid);
      return proj?.teamId ?? null;
    }
    return null;
  }, [location.pathname, projects]);

  useEffect(() => {
    if (activeTeamId && collapsedIds.includes(activeTeamId)) {
      setCollapsedIds((prev) => prev.filter((id) => id !== activeTeamId));
    }
  }, [activeTeamId, collapsedIds]);

  const lowerQuery = filterQuery.trim().toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!lowerQuery || !teams) return teams;
    return teams.filter((team) => {
      const teamMatch = team.name.toLowerCase().includes(lowerQuery);
      const teamProjects = projectsByTeam.get(team.id) ?? [];
      const projMatch = teamProjects.some((p) => p.name.toLowerCase().includes(lowerQuery));
      return teamMatch || projMatch;
    });
  }, [teams, projectsByTeam, lowerQuery]);

  const getFilteredProjects = (teamId: string) => {
    const list = projectsByTeam.get(teamId) ?? [];
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (!lowerQuery) return sorted;
    const team = teams?.find((tm) => tm.id === teamId);
    const teamMatch = team?.name.toLowerCase().includes(lowerQuery);
    if (teamMatch) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(lowerQuery));
  };

  const itemClass =
    (extra = ''): NavLinkProps['className'] =>
    ({ isActive }) =>
      `sidebar-item${extra ? ` ${extra}` : ''}${isActive ? ' sidebar-item-active' : ''}`;

  const openCreateProject = (teamId?: string) => {
    setPrefillTeamId(teamId ?? null);
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

      <div className="sidebar-section sidebar-section-row">
        <span>{t('sidebar.teams')}</span>
        <button
          type="button"
          className="sidebar-add-btn"
          title={t('sidebar.newTeam')}
          aria-label={t('sidebar.newTeam')}
          onClick={() => setCreateTeamOpen(true)}
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
            placeholder={t('sidebar.filterPlaceholder', { defaultValue: 'Filter teams & projects…' }) as string}
            aria-label={t('sidebar.filterPlaceholder', { defaultValue: 'Filter teams & projects' }) as string}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      )}

      <nav className="sidebar-nav sidebar-nav-grow" aria-label={t('sidebar.teamsNav')}>
        {teamsLoading ? (
          <>
            <Skeleton className="sidebar-skeleton" />
            <Skeleton className="sidebar-skeleton" />
            <Skeleton className="sidebar-skeleton" />
          </>
        ) : filteredTeams?.length === 0 ? (
          lowerQuery ? (
            <div className="sidebar-empty">
              <p>No matches for “{filterQuery}”</p>
              <Button variant="ghost" size="sm" onClick={() => setFilterQuery('')}>
                Clear filter
              </Button>
            </div>
          ) : teams?.length === 0 ? (
            <div className="sidebar-empty">
              <p>{t('sidebar.noTeamsYet')}</p>
              <Button variant="ghost" size="sm" onClick={() => setCreateTeamOpen(true)}>
                {t('sidebar.createTeam')}
              </Button>
            </div>
          ) : null
        ) : (
          filteredTeams?.map((team) => {
            const teamProjectsAll = projectsByTeam.get(team.id) ?? [];
            const teamProjects = getFilteredProjects(team.id);
            const collapsed = collapsedIds.includes(team.id);
            const isActiveTeam = activeTeamId === team.id;
            return (
              <div key={team.id} className="sidebar-team">
                <div className={`sidebar-team-header${isActiveTeam ? ' sidebar-team-head-active' : ''}`}>
                  <button
                    type="button"
                    className="sidebar-disclosure"
                    aria-expanded={!collapsed}
                    aria-controls={`team-projects-${team.id}`}
                    aria-label={collapsed ? `Expand ${team.name}` : `Collapse ${team.name}`}
                    onClick={() => toggleTeam(team.id)}
                  >
                    <CaretRight
                      size={12}
                      weight="bold"
                      aria-hidden="true"
                      style={{
                        transform: collapsed ? 'none' : 'rotate(90deg)',
                        transition: 'transform 120ms var(--ease-out)',
                      }}
                    />
                  </button>
                  <NavLink to={`/team/${team.id}`} className={itemClass('sidebar-team-head')} title={team.name}>
                    <UsersThree size={13} weight="duotone" aria-hidden="true" />
                    <span className="sidebar-item-label">{team.name}</span>
                    <span className="sidebar-count-muted" aria-label={`${teamProjectsAll.length} projects`}>
                      {teamProjectsAll.length}
                    </span>
                    <span className="sidebar-count-muted" aria-label={`${team.memberCount} members`}>
                      {team.memberCount}
                    </span>
                  </NavLink>
                  <button
                    type="button"
                    className="sidebar-add-btn sidebar-add-btn-team"
                    title={`New project in ${team.name}`}
                    aria-label={`New project in ${team.name}`}
                    onClick={() => openCreateProject(team.id)}
                  >
                    <Plus size={12} weight="bold" aria-hidden="true" />
                  </button>
                </div>
                <div
                  id={`team-projects-${team.id}`}
                  role="group"
                  hidden={collapsed}
                  aria-label={`${team.name} projects`}
                  className="sidebar-team-projects"
                >
                  {teamProjects.length === 0 ? (
                    lowerQuery ? (
                      <div className="sidebar-project-empty">No matches</div>
                    ) : (
                      <div className="sidebar-project-empty">
                        <span>No projects yet.</span>{' '}
                        <button type="button" className="sidebar-link-btn" onClick={() => openCreateProject(team.id)}>
                          Create project
                        </button>
                      </div>
                    )
                  ) : (
                    teamProjects.map((p) => (
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
                </div>
              </div>
            );
          })
        )}
      </nav>

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

      <CreateTeamModal open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
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
