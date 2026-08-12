import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../../lib/api';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { useAuth } from '../../state/auth-context';

interface ProfileEditModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileEditModal({ open, onClose }: ProfileEditModalProps) {
  const { user, setUser } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const current = userRef.current;
    setDisplayName(current?.displayName ?? '');
    setBio(current?.bio ?? '');
    setSaveError(null);
    setSaving(false);
  }, [open]);

  if (!user) return null;

  const dirty = displayName !== user.displayName || bio !== user.bio;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await api.updateProfile({ displayName, bio });
      setUser(updated);
      onClose();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save profile.');
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Edit profile"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="profile-edit-form" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="profile-edit-form" className="form-stack" onSubmit={(e) => void onSave(e)}>
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How your name appears in DevHub"
          maxLength={60}
          autoComplete="name"
        />
        <Textarea
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short line about what you build."
          maxLength={500}
          rows={3}
          helper={
            bio.trim() === ''
              ? 'No bio yet — add a short line about what you build.'
              : 'Max 500 characters.'
          }
        />
        {saveError && <InlineError>{saveError}</InlineError>}
      </form>
    </Modal>
  );
}