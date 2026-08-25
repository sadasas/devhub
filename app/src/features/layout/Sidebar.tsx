import {
  BookmarkSimple,
  CurrencyCircleDollar,
  FolderSimple,
  Key,
  MagnifyingGlass,
  Plus,
  Receipt,
  ShieldStar,
} from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { NavLink, type NavLinkProps } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../state/auth-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Skeleton } from '../../components/Skeleton';
import { NewProjectModal } from '../dashboard/NewProjectModal';

interface SidebarProps {
  activeTeamId?: string | null;
  activeMain?: 'home' | 'team';
  onCreateTeam?: () => void;
}

export function Sidebar({ activeTeamId, activeMain = 'team', onCreateTeam }: SidebarProps) {
  const { user } = useAuth();
  const { projects } = useProjects();
  const { teams } = useTeams();
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

  const isHome = activeMain === 'home';

  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar-brand">
        <Logo size={18} />
        <span>DevHub</span>
      </div>

      {isHome ? (
        <>
          <div className="sidebar-section">
            <span>Tools</span>
          </div>
          <nav className="sidebar-nav" aria-label="Tools">
            <NavLink to="/keys" className={itemClass()} aria-label={t('sidebar.apiKeys')}>
              <Key size={15} weight="duotone" aria-hidden="true" />
              <span>{t('sidebar.apiKeys')}</span>
            </NavLink>
            <NavLink to="/templates" className={itemClass()} aria-label={t('sidebar.templatesNav')}>
              <BookmarkSimple size={15} weight="duotone" aria-hidden="true" />
              <span>{t('sidebar.templates')}</span>
            </NavLink>
          </nav>

          <div className="sidebar-section">
            <span>Billing</span>
          </div>
          <nav className="sidebar-nav" aria-label="Billing">
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
          </nav>
        </>
      ) : (
        <>
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
                  <span className="sidebar-item-label">{activeTeam.name}</span>
                </span>
                <span className="sidebar-count-muted" aria-label={`${teamProjectsAll.length} projects`}>
                  {teamProjectsAll.length}
                </span>
              </div>

              <button
                type="button"
                className="sidebar-create-project"
                aria-label={`New project in ${activeTeam.name}`}
                onClick={() => openCreateProject(activeTeam.id)}
              >
                <Plus size={14} weight="bold" aria-hidden="true" />
                <span>New project</span>
              </button>

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
        </>
      )}

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
