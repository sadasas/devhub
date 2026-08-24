import { BookOpen, BookmarkSimple, CurrencyCircleDollar, EnvelopeSimple, FolderSimple, Key, Plus, Receipt, ShieldStar, SignOut, SquaresFour, UsersThree } from '@phosphor-icons/react';
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
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { projects } = useProjects();
  const { teams, invitations } = useTeams();
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
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

      <nav className="sidebar-nav" aria-label={t('sidebar.mainNav')}>
        <NavLink to="/" end className={itemClass()} aria-label={t('sidebar.dashboard')}>
          <SquaresFour size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.dashboard')}</span>
        </NavLink>
        <NavLink to="/invites" className={itemClass()} aria-label={t('sidebar.invitations')}>
          <EnvelopeSimple size={15} weight="duotone" aria-hidden="true" />
          <span>{t('sidebar.invitations')}</span>
          {invitations.length > 0 && <span className="sidebar-count">{invitations.length}</span>}
        </NavLink>
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
      <nav className="sidebar-nav sidebar-nav-grow" aria-label={t('sidebar.teamsNav')}>
        {teamsLoading ? (
          <>
            <Skeleton className="sidebar-skeleton" />
            <Skeleton className="sidebar-skeleton" />
            <Skeleton className="sidebar-skeleton" />
          </>
        ) : teams?.length === 0 ? (
          <div className="sidebar-empty">
            <p>{t('sidebar.noTeamsYet')}</p>
            <Button variant="ghost" size="sm" onClick={() => setCreateTeamOpen(true)}>
              {t('sidebar.createTeam')}
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
        <LanguageSwitcher triggerClassName="sidebar-lang-btn" up />
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
    </aside>
  );
}
