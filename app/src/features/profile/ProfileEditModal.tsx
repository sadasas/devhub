import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { FloppyDisk } from '@phosphor-icons/react';
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
  const { t } = useTranslation('account');
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
      setSaveError(getErrorMessage(err, t('profile.editModal.saveFailed')));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('profile.editModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common:action.cancel')}
          </Button>
          <Button type="submit" form="profile-edit-form" leftIcon={<FloppyDisk size={13} aria-hidden="true" />} loading={saving} disabled={!dirty}>
            {t('profile.editModal.save')}
          </Button>
        </>
      }
    >
      <form id="profile-edit-form" className="form-stack" onSubmit={(e) => void onSave(e)}>
        <Input
          label={t('profile.editModal.displayName')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('profile.editModal.displayNamePlaceholder')}
          maxLength={60}
          showCount
          autoComplete="name"
        />
        <Textarea
          label={t('profile.editModal.bio')}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('profile.editModal.bioPlaceholder')}
          maxLength={500}
          showCount
          rows={3}
          helper={
            bio.trim() === ''
              ? t('profile.editModal.bioEmptyHelper')
              : t('profile.editModal.bioLength', { length: bio.length })
          }
        />
        {saveError && <InlineError>{saveError}</InlineError>}
      </form>
    </Modal>
  );
}