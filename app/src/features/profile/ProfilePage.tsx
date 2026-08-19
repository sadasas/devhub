import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ArrowRight,
  CalendarBlank,
  FolderSimple,
  IdentificationBadge,
  Key,
  LockKey,
  PencilSimple,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { initialsOf } from '../../lib/initials';
import type { McpKey } from '../../lib/types';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ProfileEditModal } from './ProfileEditModal';
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
  const { user } = useAuth();
  const { teams } = useTeams();
  const { projects } = useProjects();
  const [keys, setKeys] = useState<McpKey[] | null>(null);
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
      .then((list) => {
        if (!cancelled) setKeys(list);
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
  const hasDisplayName = user.displayName.trim() !== '';
  const activeKeys = keys?.filter((k) => !k.revokedAt).length ?? 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Your identity on DevHub teams.</p>
        </div>
      </header>

      <section className="profile-hero" aria-label="Profile summary">
        <div className="profile-hero-avatar" aria-hidden="true">
          {initialsOf(name, user.email)}
        </div>
        <div className="profile-hero-main">
          <h2 className="profile-hero-name">{name}</h2>
          {hasDisplayName && <p className="profile-hero-email">{user.email}</p>}
          {user.bio.trim() !== '' ? (
            <p className="profile-hero-bio">{user.bio}</p>
          ) : (
            <button
              type="button"
              className="profile-hero-bio-empty"
              onClick={() => setEditOpen(true)}
            >
              Add a bio — tell your team what you build.
            </button>
          )}
          <div className="profile-hero-meta">
            <span className="profile-chip">
              <CalendarBlank size={12} weight="duotone" aria-hidden="true" />
              Joined {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
        <div className="profile-hero-actions">
          <Button
            variant="secondary"
            leftIcon={<PencilSimple size={14} weight="bold" aria-hidden="true" />}
            onClick={() => setEditOpen(true)}
          >
            Edit profile
          </Button>
        </div>
      </section>

      <div className="sub-tabs" role="tablist" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'profile' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('profile')}
          aria-selected={tab === 'profile'}
        >
          <UserCircle size={13} aria-hidden="true" />
          Profile
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'security' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('security')}
          aria-selected={tab === 'security'}
        >
          <LockKey size={13} aria-hidden="true" />
          Security
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'account' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('account')}
          aria-selected={tab === 'account'}
        >
          <IdentificationBadge size={13} aria-hidden="true" />
          Account
        </button>
      </div>

      {tab === 'profile' && (
        <section className="profile-tab-panel" aria-label="Profile statistics">
          <div className="profile-stats">
            <StatItem
              icon={<UsersThree size={16} weight="duotone" aria-hidden="true" />}
              label="Teams"
              value={teams?.length ?? 0}
              loading={teams === null}
              error={false}
            />
            <StatItem
              icon={<FolderSimple size={16} weight="duotone" aria-hidden="true" />}
              label="Projects"
              value={projects?.length ?? 0}
              loading={projects === null}
              error={false}
            />
            <StatItem
              icon={<Key size={16} weight="duotone" aria-hidden="true" />}
              label="Active API keys"
              value={activeKeys}
              loading={keys === null && !keysError}
              error={keysError}
            />
          </div>
          <nav className="settings-links" aria-label="Related pages">
            <Link to="/keys">
              API keys
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
            <Link to="/docs/mcp">
              MCP guide
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </nav>
        </section>
      )}

      {tab === 'security' && (
        <section className="profile-tab-panel" aria-label="Security">
          <div className="settings-action">
            <div className="settings-action-main">
              <span className="settings-action-title">Password</span>
              <span className="settings-action-desc">
                Use at least 8 characters, different from your current one.
              </span>
            </div>
            <Button variant="secondary" onClick={() => setChangeOpen(true)}>
              Change password
            </Button>
          </div>
        </section>
      )}

      {tab === 'account' && (
        <section className="profile-tab-panel" aria-label="Account details">
          <dl className="settings-rows">
            <div className="settings-row">
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="settings-row">
              <dt>Member since</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
            <div className="settings-row">
              <dt>Account ID</dt>
              <dd className="settings-mono" title={user.id}>
                {user.id}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
      <ChangePasswordModal open={changeOpen} onClose={() => setChangeOpen(false)} />
    </div>
  );
}