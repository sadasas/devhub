import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarBlank,
  FolderSimple,
  IdentificationBadge,
  Key,
  LockKey,
  PencilSimple,
  ShieldCheck,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { initialsOf } from '../../lib/initials';
import { avatarColor } from '../../lib/avatar';
import type { TeamRole } from '../../lib/types';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ProfileEditModal } from './ProfileEditModal';
import { ProfileStats } from './ProfileStats';
import { useAuth } from '../../state/auth-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';

type ProfileTab = 'profile' | 'security' | 'account';

const ROLE_LABEL_KEYS: Record<TeamRole, string> = {
  owner: 'profile.role.owner',
  admin: 'profile.role.admin',
  editor: 'profile.role.editor',
  viewer: 'profile.role.viewer',
};

function StatItem({
  icon,
  label,
  value,
  loading,
  error,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  error: boolean;
}) {
  return (
    <div className="profile-stat">
      <span className="profile-stat-label">
        {icon}
        {label}
      </span>
      {loading ? (
        <Skeleton className="skeleton-row-sm" style={{ width: 44, height: 22 }} />
      ) : (
        <span className="profile-stat-value">{error ? '—' : value}</span>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { t } = useTranslation('account');
  const { user } = useAuth();
  const { teams } = useTeams();
  const { projects } = useProjects();
  const [activeKeys, setActiveKeys] = useState<number | null>(null);
  const [keysError, setKeysError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const tab: ProfileTab =
    tabParam === 'security' || tabParam === 'account' ? tabParam : 'profile';

  function setTab(next: ProfileTab) {
    setSearchParams(next === 'profile' ? {} : { tab: next }, { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    api
      .listKeys()
      .then((res) => {
        // List hanya key aktif — total = jumlah Active API keys
        if (!cancelled) setActiveKeys(res.total);
      })
      .catch(() => {
        if (!cancelled) setKeysError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const name = user.displayName.trim() || user.email;

  const roleOrder: TeamRole[] = ['viewer', 'editor', 'admin', 'owner'];
  const topRole: TeamRole | null = teams?.length
    ? teams.reduce<TeamRole>(
        (acc, t) => (roleOrder.indexOf(t.role) > roleOrder.indexOf(acc) ? t.role : acc),
        'viewer',
      )
    : null;
  const roleLabel = topRole ? t(ROLE_LABEL_KEYS[topRole]) : null;
  const avatarStyle = { '--avatar-fg': avatarColor(user.id) } as React.CSSProperties;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('profile.title')}</h1>
          <p className="page-subtitle">{t('profile.subtitle')}</p>
        </div>
      </header>

      <div className="profile-layout">
        <aside className="profile-side">
          <section className="profile-card" aria-label={t('profile.summaryAria')}>
            <div
              className="profile-avatar"
              aria-hidden="true"
              style={avatarStyle}
            >
              {initialsOf(name, user.email)}
            </div>
            <h2 className="profile-name">{name}</h2>
            <p className="profile-email">{user.email}</p>
            {user.bio.trim() !== '' ? (
              <p className="profile-bio">{user.bio}</p>
            ) : (
              <button
                type="button"
                className="profile-bio-empty"
                onClick={() => setEditOpen(true)}
              >
                {t('profile.addBio')}
              </button>
            )}
            <div className="profile-chips">
              <span className="profile-chip">
                <CalendarBlank size={12} weight="duotone" aria-hidden="true" />
                {t('profile.joined', { date: formatDate(user.createdAt) })}
              </span>
              {roleLabel && (
                <span className="profile-chip">
                  <ShieldCheck size={12} weight="duotone" aria-hidden="true" />
                  {roleLabel}
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              className="profile-edit-btn"
              leftIcon={<PencilSimple size={14} weight="bold" aria-hidden="true" />}
              onClick={() => setEditOpen(true)}
            >
              {t('profile.edit')}
            </Button>
          </section>
        </aside>

        <main className="profile-main">
          <div className="sub-tabs" role="tablist" aria-label={t('profile.tabsAria')}>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'profile' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('profile')}
          aria-selected={tab === 'profile'}
        >
          <UserCircle size={13} aria-hidden="true" />
          {t('profile.tab.profile')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'security' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('security')}
          aria-selected={tab === 'security'}
        >
          <LockKey size={13} aria-hidden="true" />
          {t('profile.tab.security')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'account' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('account')}
          aria-selected={tab === 'account'}
        >
          <IdentificationBadge size={13} aria-hidden="true" />
          {t('profile.tab.account')}
        </button>
      </div>

      {tab === 'profile' && (
        <section className="profile-tab-panel" aria-label={t('profile.statsAria')}>
          <ProfileStats />

          <div className="profile-stats">
            <StatItem
              icon={<UsersThree size={16} weight="duotone" aria-hidden="true" />}
              label={t('profile.stat.teams')}
              value={teams?.length ?? 0}
              loading={teams === null}
              error={false}
            />
            <StatItem
              icon={<FolderSimple size={16} weight="duotone" aria-hidden="true" />}
              label={t('profile.stat.projects')}
              value={projects?.length ?? 0}
              loading={projects === null}
              error={false}
            />
            <StatItem
              icon={<Key size={16} weight="duotone" aria-hidden="true" />}
              label={t('profile.stat.activeKeys')}
              value={activeKeys ?? 0}
              loading={activeKeys === null && !keysError}
              error={keysError}
            />
          </div>

          <div className="profile-collections">
            <section className="profile-panel" aria-label={t('profile.yourTeams')}>
              <h3 className="profile-panel-title">
                <UsersThree size={13} weight="duotone" aria-hidden="true" />
                {t('profile.yourTeams')}
              </h3>
              {teams === null ? (
                <Skeleton className="skeleton-row-sm" style={{ width: 180, height: 18 }} />
              ) : teams.length === 0 ? (
                <p className="profile-panel-empty">{t('profile.noTeams')}</p>
              ) : (
                <ul className="profile-collection-list">
                  {teams.slice(0, 5).map((team) => (
                    <li key={team.id}>
                      <Link to={`/team/${team.id}`} className="profile-collection-link">
                        <span className="profile-collection-name">{team.name}</span>
                        <span className="profile-collection-meta">
                          {team.role} · {t('profile.members', { count: team.memberCount })}
                        </span>
                        <ArrowRight size={12} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="profile-panel" aria-label={t('profile.yourProjects')}>
              <h3 className="profile-panel-title">
                <FolderSimple size={13} weight="duotone" aria-hidden="true" />
                {t('profile.yourProjects')}
              </h3>
              {projects === null ? (
                <Skeleton className="skeleton-row-sm" style={{ width: 180, height: 18 }} />
              ) : projects.length === 0 ? (
                <p className="profile-panel-empty">{t('profile.noProjects')}</p>
              ) : (
                <ul className="profile-collection-list">
                  {projects.slice(0, 5).map((project) => (
                    <li key={project.id}>
                      <Link to={`/project/${project.id}`} className="profile-collection-link">
                        <span className="profile-collection-name">{project.name}</span>
                        <span className="profile-collection-meta">{project.teamName}</span>
                        <ArrowRight size={12} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <nav className="settings-links" aria-label={t('profile.relatedAria')}>
            <Link to="/keys">
              {t('profile.links.apiKeys')}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
            <Link to="/docs/mcp">
              {t('profile.links.mcpGuide')}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </nav>
        </section>
      )}

      {tab === 'security' && (
        <section className="profile-tab-panel" aria-label={t('profile.securityPanelAria')}>
          <div className="profile-panel">
            <div className="settings-action">
              <div className="settings-action-main">
                <span className="settings-action-title">{t('profile.security.password')}</span>
                <span className="settings-action-desc">
                  {t('profile.security.passwordDesc')}
                </span>
              </div>
              <Button variant="secondary" onClick={() => setChangeOpen(true)}>
                {t('profile.security.changePassword')}
              </Button>
            </div>
          </div>
        </section>
      )}

      {tab === 'account' && (
        <section className="profile-tab-panel" aria-label={t('profile.accountPanelAria')}>
          <div className="profile-panel">
            <dl className="settings-rows">
              <div className="settings-row">
                <dt>{t('profile.account.email')}</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="settings-row">
                <dt>{t('profile.account.memberSince')}</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
              <div className="settings-row">
                <dt>{t('profile.account.accountId')}</dt>
                <dd className="settings-mono" title={user.id}>
                  {user.id}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      )}
      </main>
      </div>

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
      <ChangePasswordModal open={changeOpen} onClose={() => setChangeOpen(false)} />
    </div>
  );
}