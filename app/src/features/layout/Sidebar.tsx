import {
  BookmarkSimple,
  CurrencyCircleDollar,
  EnvelopeSimple,
  FolderSimple,
  MagnifyingGlass,
  Notebook,
  Plugs,
  Plus,
  Receipt,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, type NavLinkProps } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Skeleton } from '../../components/Skeleton';
import { NewProjectModal } from '../dashboard/NewProjectModal';
import { useSidebarUnread } from '../../hooks/useSidebarUnread';

interface SidebarProps {
  activeTeamId?: string | null;
  activeMain?: 'home' | 'team';
  onCreateTeam?: () => void;
}

export function Sidebar({ activeTeamId, activeMain = 'team', onCreateTeam }: SidebarProps) {
  const { projects } = useProjects();
  const { teams, invitations } = useTeams();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [prefillTeamId, setPrefillTeamId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { t } = useTranslation('shell');

  // Reset local UI when switching team context (flyout preview or real nav)
  useEffect(() => {
    setFilterQuery('');
    setShowArchived(false);
  }, [activeTeamId]);

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
  const { filteredActive, filteredArchived } = useMemo(() => {
    const list = [...teamProjectsAll].sort((a, b) => a.name.localeCompare(b.name));
    const filtered = !lowerQuery ? list : list.filter((p) => p.name.toLowerCase().includes(lowerQuery));
    return {
      filteredActive: filtered.filter((p) => p.status !== 'archived'),
      filteredArchived: filtered.filter((p) => p.status === 'archived'),
    };
  }, [teamProjectsAll, lowerQuery]);
  const filteredProjects = filteredActive;

  // Badge unread per project — hanya active, archived TIDAK (req 1)
  const unreadByProject = useSidebarUnread(
    activeMain === 'team' ? activeTeamId ?? null : null,
    filteredActive.map((p) => p.id),
  );

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
          <nav className="sidebar-nav" aria-label={t('sidebar.invitations')}>
            <NavLink to="/invites" className={itemClass()} aria-label={t('sidebar.invitations')}>
              <EnvelopeSimple size={15} weight="duotone" aria-hidden="true" />
              <span>{t('sidebar.invitations')}</span>
              {invitations.length > 0 && (
                <span className="sidebar-count" aria-label={`${invitations.length} pending invitations`}>
                  {invitations.length > 99 ? '99+' : invitations.length}
                </span>
              )}
            </NavLink>
          </nav>

          <div className="sidebar-section">
            <span>Tools</span>
          </div>
          <nav className="sidebar-nav" aria-label="Tools">
            <NavLink to="/connected" className={itemClass()} aria-label={t('sidebar.apiKeys')}>
              <Plugs size={15} weight="duotone" aria-hidden="true" />
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
          </nav>

          <div className="sidebar-section">
            <span>{t('sidebar.docs')}</span>
          </div>
          <nav className="sidebar-nav" aria-label="Docs">
            <NavLink to="/docs" className={itemClass()} aria-label={t('sidebar.docs')}>
              <Notebook size={15} weight="duotone" aria-hidden="true" />
              <span>{t('sidebar.docs')}</span>
            </NavLink>
          </nav>
        </>
      ) : (
        <>
          {teamsLoading ? (
            <div role="status" aria-label="Loading teams" aria-busy="true">
              <span className="sr-only">Loading teams…</span>
              <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 8px' }}>
                <Skeleton style={{ width: '70%', height: 11, marginBottom: 4 }} />
                <Skeleton style={{ width: '100%', height: 36, borderRadius: 8 }} />
                <Skeleton style={{ width: '100%', height: 28, borderRadius: 8, marginTop: 4 }} />
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 6px' }}>
                    <Skeleton style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} />
                    <Skeleton style={{ width: `${60 + i * 5}%`, height: 12 }} />
                    <Skeleton style={{ width: 16, height: 16, borderRadius: 999, marginLeft: 'auto', opacity: 0.6 }} />
                  </div>
                ))}
              </div>
            </div>
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
                  {activeTeam.icon?.trim() ? (
                    <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{activeTeam.icon.trim()}</span>
                  ) : null}
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
                    maxLength={100}
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
                    </div>
                  )
                ) : (
                  filteredProjects.map((p) => {
                    const badge = unreadByProject[p.id];
                    const hasBadge = badge && badge.total > 0;
                    return (
                      <NavLink
                        key={p.id}
                        to={`/project/${p.id}`}
                        className={itemClass('sidebar-project-item')}
                        title={p.name}
                      >
                        <FolderSimple size={14} weight="duotone" aria-hidden="true" />
                        <span className="sidebar-item-label">{p.name}</span>
                        {hasBadge && (
                          <span
                            className="sidebar-project-badges"
                            aria-label={`${badge.new} new, ${badge.deleted} deleted in ${p.name}`}
                            title={`${badge.new} new · ${badge.deleted} deleted`}
                          >
                            {badge.new > 0 && (
                              <span className="tab-badge tab-badge-new" aria-hidden="true">
                                {badge.new > 99 ? '99+' : badge.new}
                              </span>
                            )}
                            {badge.deleted > 0 && (
                              <span className="tab-badge tab-badge-deleted" aria-hidden="true">
                                {badge.deleted > 99 ? '99+' : badge.deleted}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    );
                  })
                )}
                {filteredArchived.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="sidebar-archived-toggle"
                      aria-expanded={showArchived}
                      onClick={() => setShowArchived((v) => !v)}
                    >
                      <span>{showArchived ? '▾' : '▸'}</span> Archived
                      <span className="sidebar-count-muted">{filteredArchived.length}</span>
                    </button>
                    {showArchived &&
                      filteredArchived.map((p) => (
                        <NavLink
                          key={p.id}
                          to={`/project/${p.id}`}
                          className={itemClass('sidebar-project-item sidebar-project-item--archived')}
                          title={`${p.name} — archived`}
                        >
                          <FolderSimple size={14} weight="duotone" aria-hidden="true" />
                          <span className="sidebar-item-label">{p.name}</span>
                        </NavLink>
                      ))}
                  </>
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



