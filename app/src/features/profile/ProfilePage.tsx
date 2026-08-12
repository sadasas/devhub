import { useState } from 'react';
import { LockKey, PencilSimple } from '@phosphor-icons/react';
import { ApiError, api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { initialsOf } from '../../lib/initials';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { ProfileEditModal } from './ProfileEditModal';
import { useAuth } from '../../state/auth-context';

export function ProfilePage() {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);

  if (!user) return null;

  const name = user.displayName.trim() || user.email;
  const hasDisplayName = user.displayName.trim() !== '';

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
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your identity on DevHub teams.</p>
      </header>

      <div className="profile-card profile-view-card">
        <div className="profile-avatar profile-view-avatar" aria-hidden="true">
          {initialsOf(name, user.email)}
        </div>
        <div className="profile-view-main">
          <h2 className="profile-name profile-view-name">{name}</h2>
          {hasDisplayName && <p className="profile-email">{user.email}</p>}
          {user.bio.trim() !== '' ? (
            <p className="profile-bio">{user.bio}</p>
          ) : (
            <p className="profile-bio profile-bio-empty">
              No bio yet — add a short line about what you build.
            </p>
          )}
          <p className="profile-joined">Joined {formatDate(user.createdAt)}</p>
        </div>
        <Button
          variant="secondary"
          leftIcon={<PencilSimple size={14} weight="bold" aria-hidden="true" />}
          onClick={() => setEditOpen(true)}
        >
          Edit profile
        </Button>
      </div>

      <section className="account-section" aria-label="Security">
        <h2 className="account-section-title">
          <LockKey size={13} aria-hidden="true" />
          Security
        </h2>
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

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}