import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  CalendarBlank,
  FolderSimple,
  Key,
  LockKey,
  PencilSimple,
  User,
  UsersThree,
} from '@phosphor-icons/react';
import { ApiError, api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { initialsOf } from '../../lib/initials';
import type { McpKey } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Skeleton } from '../../components/Skeleton';
import { ProfileEditModal } from './ProfileEditModal';
import { useAuth } from '../../state/auth-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';

function StatTile({
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
    <div className="profile-stat-tile">
      <span className="profile-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="profile-stat-meta">
        {loading ? (
          <Skeleton className="skeleton-row-sm" style={{ width: 44, height: 20 }} />
        ) : (
          <span className="profile-stat-value">{error ? '—' : value}</span>
        )}
        <span className="profile-stat-label">{label}</span>
      </span>
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);

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

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangeError(null);
    setChangeSuccess(false);
    if (newPassword !== confirmPassword) {
      setChangeError('New password and confirmation do not match.');
      return;
    }
    setChanging(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangeSuccess(true);
    } catch (err) {
      setChangeError(err instanceof ApiError ? err.message : 'Failed to change password.');
    } finally {
      setChanging(false);
    }
  }

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
          <p className="profile-hero-joined">
            <CalendarBlank size={13} weight="duotone" aria-hidden="true" />
            Joined {formatDate(user.createdAt)}
          </p>
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

      <section className="profile-stats" aria-label="Account statistics">
        <StatTile
          icon={<UsersThree size={16} weight="duotone" aria-hidden="true" />}
          label="Teams"
          value={teams?.length ?? 0}
          loading={teams === null}
          error={false}
        />
        <StatTile
          icon={<FolderSimple size={16} weight="duotone" aria-hidden="true" />}
          label="Projects"
          value={projects?.length ?? 0}
          loading={projects === null}
          error={false}
        />
        <StatTile
          icon={<Key size={16} weight="duotone" aria-hidden="true" />}
          label="Active API keys"
          value={activeKeys}
          loading={keys === null && !keysError}
          error={keysError}
        />
      </section>

      <div className="settings-grid">
        <section className="settings-panel" aria-label="Security">
          <h2 className="settings-panel-title">
            <LockKey size={13} aria-hidden="true" />
            Security
          </h2>
          <p className="settings-panel-hint">Change your password regularly.</p>
          <form className="form-stack" onSubmit={(e) => void onChangePassword(e)}>
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helper="At least 8 characters and different from the current password."
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {changeError && <InlineError>{changeError}</InlineError>}
            {changeSuccess && (
              <p className="field-helper" role="status">
                Password updated. Use it on your next login.
              </p>
            )}
            <div>
              <Button type="submit" loading={changing}>
                Change password
              </Button>
            </div>
          </form>
        </section>

        <section className="settings-panel" aria-label="Account">
          <h2 className="settings-panel-title">
            <User size={13} aria-hidden="true" />
            Account
          </h2>
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
      </div>

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}