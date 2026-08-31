import { useEffect, useState } from 'react';
import { CheckCircle, Eye, EyeSlash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { FE_LIMITS } from '../../lib/limits';
import { useAuth } from '../../state/auth-context';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

function PasswordToggle({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('account');
  return (
    <button
      type="button"
      className="password-toggle"
      aria-label={show ? t('profile.passwordToggle.hide') : t('profile.passwordToggle.show')}
      onClick={onToggle}
    >
      {show ? (
        <EyeSlash size={14} weight="bold" aria-hidden="true" />
      ) : (
        <Eye size={14} weight="bold" aria-hidden="true" />
      )}
    </button>
  );
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslation('account');
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNew(false);
    setShowConfirm(false);
    setChanging(false);
    setChangeError(null);
    setChangeSuccess(false);
  }, [open]);

  const isSetMode = user?.hasPassword === false;

  const canSubmit = isSetMode
    ? newPassword !== '' && confirmPassword !== ''
    : currentPassword !== '' && newPassword !== '' && confirmPassword !== '';

  const title = isSetMode
    ? t('profile.changeModal.setTitle', { defaultValue: 'Set password' })
    : t('profile.changeModal.title');
  const successText = isSetMode
    ? t('profile.changeModal.setSuccess', { defaultValue: 'Password set. You can now sign in with email.' })
    : t('profile.changeModal.success');
  const submitLabel = isSetMode
    ? t('profile.changeModal.setSubmit', { defaultValue: 'Set password' })
    : t('profile.changeModal.update');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChangeError(null);
    if (newPassword !== confirmPassword) {
      setChangeError(t('profile.changeModal.mismatch'));
      return;
    }
    setChanging(true);
    try {
      await api.changePassword(isSetMode ? '' : currentPassword, newPassword);
      if (refresh) await refresh();
      setChangeSuccess(true);
    } catch (err) {
      setChangeError(getErrorMessage(err, t('profile.changeModal.failed')));
    } finally {
      setChanging(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width="sm"
      footer={
        changeSuccess ? (
          <Button onClick={onClose}>{t('profile.changeModal.done')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={changing}>
              {t('common:action.cancel')}
            </Button>
            <Button
              type="submit"
              form="change-password-form"
              loading={changing}
              disabled={!canSubmit}
            >
              {submitLabel}
            </Button>
          </>
        )
      }
    >
      {changeSuccess ? (
        <div className="change-success" role="status">
          <CheckCircle size={22} weight="duotone" aria-hidden="true" />
          <p>{successText}</p>
        </div>
      ) : (
        <form
          id="change-password-form"
          className="form-stack"
          onSubmit={(e) => void onSubmit(e)}
        >
          {!isSetMode && (
            <Input
              label={t('profile.changeModal.current')}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              maxLength={FE_LIMITS.PASSWORD}
            />
          )}
          {isSetMode && (
            <p className="field-helper" style={{ marginBottom: 4 }}>
              {t('profile.changeModal.setHelper', {
                defaultValue: 'Choose a password to enable email login. You can still use Google/GitHub.'
              })}
            </p>
          )}
          <Input
            label={t('profile.changeModal.new')}
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helper={t('profile.changeModal.newHelper')}
            required
            className="input-with-slot"
            rightSlot={<PasswordToggle show={showNew} onToggle={() => setShowNew((v) => !v)} />}
            maxLength={FE_LIMITS.PASSWORD}
          />
          <Input
            label={t('profile.changeModal.confirm')}
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="input-with-slot"
            rightSlot={<PasswordToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
            maxLength={FE_LIMITS.PASSWORD}
          />
          {changeError && <InlineError>{changeError}</InlineError>}
        </form>
      )}
    </Modal>
  );
}