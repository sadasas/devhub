import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarBlank,
  Check,
  Copy,
  FolderSimple,
  GithubLogo,
  GoogleLogo,
  IdentificationBadge,
  Key,
  LockKey,
  PencilSimple,
  ShieldCheck,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { copyText, formatDate, shortId } from '../../lib/utils';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ProfileEditModal } from './ProfileEditModal';
import { ProfileStats } from './ProfileStats';
import { UnlinkProviderModal } from './UnlinkProviderModal';
import { useAuth } from '../../state/auth-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';

type ProfileTab = 'profile' | 'security' | 'account';

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
  const { user, refresh } = useAuth();
  const { teams } = useTeams();
  const { projects } = useProjects();
  const [activeKeys, setActiveKeys] = useState<number | null>(null);
  const [keysError, setKeysError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [linked, setLinked] = useState<{ provider: string; email: string | null }[] | null>(null);
  const [linkedError, setLinkedError] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<'google' | 'github' | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [showFullId, setShowFullId] = useState(false);

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

  const fetchLinked = async () => {
    try {
      const res = await api.getLinked();
      setLinked(res.linked);
      setLinkedError(null);
    } catch (err) {
      setLinkedError(getErrorMessage(err, 'Failed to load linked accounts'));
    }
  };

  useEffect(() => {
    if (tab === 'security') fetchLinked();
  }, [tab]);

  const handleUnlinkConfirm = async () => {
    if (!unlinkTarget) return;
    setUnlinkBusy(true);
    setUnlinkError(null);
    setLinkedError(null);
    try {
      await api.unlinkProvider(unlinkTarget);
      await fetchLinked();
      await refresh();
      setUnlinkTarget(null);
    } catch (err) {
      const msg = getErrorMessage(err, t('profile.security.unlinkFailed', { defaultValue: 'Failed to unlink' }));
      setUnlinkError(msg);
      setLinkedError(msg);
    } finally {
      setUnlinkBusy(false);
    }
  };

  const handleCopyId = async () => {
    const ok = await copyText(user!.id);
    if (ok) {
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const isGoogleLinked = linked?.some((l) => l.provider === 'google') ?? false;
  const isGithubLinked = linked?.some((l) => l.provider === 'github') ?? false;
  const returnToProfile = typeof window !== 'undefined' ? `${window.location.origin}/profile?tab=security` : '/profile?tab=security';

  if (!user) return null;

  const name = user.displayName.trim() || user.email;

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
            <Avatar
              src={user.avatarUrl ?? null}
              name={name}
              email={user.email}
              id={user.id}
              size={72}
              rounded={16}
              className="profile-avatar"
              alt={name}
            />
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
              {user.providers?.includes('google') && (
                <span className="profile-chip">
                  <GoogleLogo size={12} weight="bold" /> Google
                </span>
              )}
              {user.providers?.includes('github') && (
                <span className="profile-chip">
                  <GithubLogo size={12} weight="fill" /> GitHub
                </span>
              )}
              {user.hasPassword === false && <span className="profile-chip">OAuth only</span>}
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
                <div role="status" aria-busy="true" aria-label="Loading teams">
                  <span className="sr-only">Loading teams…</span>
                  <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Skeleton style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0 }} />
                        <Skeleton style={{ width: 96 + i * 12, height: 14 }} />
                      </div>
                    ))}
                  </div>
                </div>
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
                <div role="status" aria-busy="true" aria-label="Loading projects">
                  <span className="sr-only">Loading projects…</span>
                  <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Skeleton style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0 }} />
                        <Skeleton style={{ width: 96 + i * 10, height: 14 }} />
                      </div>
                    ))}
                  </div>
                </div>
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
            <Link to="/connected">
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
                  {user.hasPassword === false ? t('profile.security.passwordSetDesc', { defaultValue: 'No password yet \u2014 set one to enable email login. You can keep using Google/GitHub.' }) : t('profile.security.passwordDesc')}
                </span>
              </div>
              <Button variant="secondary" onClick={() => setChangeOpen(true)}>
                {user.hasPassword === false
                  ? t('profile.security.setPassword', { defaultValue: 'Set password' })
                  : t('profile.security.changePassword')}
              </Button>
            </div>
            {user.hasPassword === false && (
              <p className="field-helper" style={{ marginTop: 8, color: 'var(--status-warn)' }}>
                This account uses Google/GitHub login. Set a password to enable email login and allow unlinking OAuth.
              </p>
            )}
          </div>

          <div className="profile-panel">
            <h3 className="profile-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={14} weight="duotone" /> Connected accounts
            </h3>
            <p className="field-helper" style={{ marginBottom: 12 }}>
              Link Google or GitHub to sign in with one click. Keep your email/password — OAuth is additive.
            </p>
            {linkedError && <div className="inline-error" style={{ marginBottom: 10 }}>{linkedError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="settings-action" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div className="settings-action-main" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <GoogleLogo size={18} weight="bold" />
                  <div>
                    <div className="settings-action-title">Google</div>
                    <div className="settings-action-desc">
                      {isGoogleLinked ? linked?.find((l) => l.provider === 'google')?.email ?? 'Linked' : 'Not linked — scope openid email profile'}
                    </div>
                  </div>
                </div>
                {isGoogleLinked ? (
                  <Button variant="ghost" onClick={() => { setUnlinkError(null); setUnlinkTarget('google'); }}>
                    {t('profile.security.unlink', { defaultValue: 'Unlink' })}
                  </Button>
                ) : (
                    <a
                     href={`/api/v1/auth/google?intent=link&returnTo=${encodeURIComponent(returnToProfile)}`}
                     rel="external"
                     data-external="true"
                     className="btn btn-secondary"
                     style={{ textDecoration: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 600 }}
                  >
                     Connect
                  </a>
                 )}
              </div>
              <div className="settings-action" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div className="settings-action-main" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <GithubLogo size={18} weight="fill" />
                  <div>
                    <div className="settings-action-title">GitHub</div>
                    <div className="settings-action-desc">
                      {isGithubLinked ? linked?.find((l) => l.provider === 'github')?.email ?? 'Linked' : 'Not linked — scope user:email read:user'}
                    </div>
                  </div>
                </div>
                {isGithubLinked ? (
                  <Button variant="ghost" onClick={() => { setUnlinkError(null); setUnlinkTarget('github'); }}>
                    {t('profile.security.unlink', { defaultValue: 'Unlink' })}
                  </Button>
                ) : (
                    <a
                     href={`/api/v1/auth/github?intent=link&returnTo=${encodeURIComponent(returnToProfile)}`}
                     rel="external"
                     data-external="true"
                     className="btn btn-secondary"
                     style={{ textDecoration: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 600 }}
                  >
                     Connect
                  </a>
                 )}
              </div>
            </div>
            {linked === null && !linkedError && <p className="field-helper" style={{ marginTop: 8 }}>Loading linked accounts…</p>}
          </div>
        </section>
      )}

      {tab === 'account' && (
        <section className="profile-tab-panel" aria-label={t('profile.accountPanelAria')}>
          <div className="profile-panel profile-panel--primary">
            <h3 className="profile-panel-title profile-panel-title--primary">
              {t('profile.account.detailTitle', { defaultValue: 'Account details' })}
            </h3>
            <p className="field-helper" style={{ marginBottom: 14 }}>
              {t('profile.account.detailHelper', {
                defaultValue: 'Email & ID for login, invites, and support.',
              })}
            </p>
            <dl className="settings-rows">
              <div className="settings-row">
                <dt>{t('profile.account.email')}</dt>
                <dd style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span>{user.email}</span>
                  {(() => {
                    const isVerified = user.emailVerified ?? (user.providers?.length ?? 0) > 0;
                    return (
                      <Badge tone={isVerified ? 'success' : 'warn'} dot>
                        {isVerified
                          ? t('profile.account.verified', { defaultValue: 'Verified' })
                          : t('profile.account.unverified', { defaultValue: 'Unverified' })}
                      </Badge>
                    );
                  })()}
                </dd>
              </div>
              <p className="field-helper field-helper--row">
                {t('profile.account.emailHelper', { defaultValue: 'Email for login & team invites.' })}
              </p>
              <div className="settings-row">
                <dt>{t('profile.account.memberSince')}</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
              <div className="settings-row settings-row--accountId">
                <dt>{t('profile.account.accountId')}</dt>
                <dd className="settings-row-value">
                  <span className="settings-mono" title={user.id} style={{ maxWidth: showFullId ? '100%' : 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: showFullId ? 'normal' : 'nowrap', wordBreak: showFullId ? 'break-all' : undefined }}>
                    {showFullId ? user.id : shortId(user.id)}
                  </span>
                  <span className="settings-row-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={copiedId ? <Check size={13} weight="bold" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                      onClick={() => void handleCopyId()}
                      aria-label={t('profile.account.copyIdAria', { defaultValue: 'Copy account ID' })}
                      title={user.id}
                    >
                      {copiedId
                        ? t('profile.account.copied', { defaultValue: 'Copied' })
                        : t('profile.account.copyId', { defaultValue: 'Copy' })}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowFullId((v) => !v)}>
                      {showFullId
                        ? t('profile.account.hideFull', { defaultValue: 'Hide' })
                        : t('profile.account.viewFull', { defaultValue: 'Show full' })}
                    </Button>
                  </span>
                  {copiedId && (
                    <span className="field-helper" role="status" aria-live="polite" style={{ fontSize: 11 }}>
                      {t('profile.account.copied', { defaultValue: 'Copied' })}
                    </span>
                  )}
                </dd>
              </div>
              <p className="field-helper field-helper--row">
                {t('profile.account.idHelper', {
                  defaultValue: 'Used when contacting support. Copy copies the full ID.',
                })}
              </p>
            </dl>
          </div>

          <div className="profile-panel profile-panel--secondary">
            <h3 className="profile-panel-title">{t('profile.account.preferencesTitle', { defaultValue: 'Preferences' })}</h3>
            <p className="field-helper" style={{ marginBottom: 12 }}>
              {t('profile.account.preferencesHelper', {
                defaultValue: 'Light/Dark — System follows your OS.',
              })}
            </p>
            <ThemeSwitcher variant="segmented" />
          </div>

          <div className="profile-panel">
            <h3 className="profile-panel-title">{t('profile.account.dataHelpTitle', { defaultValue: 'Data & Help' })}</h3>
            <p className="field-helper" style={{ marginBottom: 12 }}>
              {t('profile.account.dataHelpDesc', {
                defaultValue: 'Your data stays yours — export or import anytime.',
              })}
            </p>
            <nav className="settings-links" aria-label={t('profile.relatedAria')}>
              <Link to="/connected">
                {t('profile.links.apiKeys')}
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
              <Link to="/docs/mcp">
                {t('profile.links.mcpGuide')}
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
              <Link to="/docs">
                Docs
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </nav>
          </div>
        </section>
      )}
      </main>
      </div>

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
      <ChangePasswordModal open={changeOpen} onClose={() => setChangeOpen(false)} />
      <UnlinkProviderModal
        open={unlinkTarget !== null}
        provider={unlinkTarget}
        email={unlinkTarget ? (linked?.find((l) => l.provider === unlinkTarget)?.email ?? null) : null}
        hasPassword={user.hasPassword !== false}
        linkedCount={linked?.length ?? 0}
        busy={unlinkBusy}
        error={unlinkError}
        onClose={() => {
          if (!unlinkBusy) {
            setUnlinkTarget(null);
            setUnlinkError(null);
          }
        }}
        onConfirm={() => void handleUnlinkConfirm()}
      />
    </div>
  );
}
