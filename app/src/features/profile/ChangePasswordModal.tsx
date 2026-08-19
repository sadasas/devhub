import { useEffect, useState } from 'react';
import { CheckCircle, Eye, EyeSlash } from '@phosphor-icons/react';
import { ApiError, api } from '../../lib/api';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

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
  return (
    <button
      type="button"
      className="password-toggle"
      aria-label={show ? 'Hide password' : 'Show password'}
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

  const canSubmit = currentPassword !== '' && newPassword !== '' && confirmPassword !== '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChangeError(null);
    if (newPassword !== confirmPassword) {
      setChangeError('New password and confirmation do not match.');
      return;
    }
    setChanging(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setChangeSuccess(true);
    } catch (err) {
      setChangeError(err instanceof ApiError ? err.message : 'Failed to change password.');
    } finally {
      setChanging(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Change password"
      onClose={onClose}
      width="sm"
      footer={
        changeSuccess ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={changing}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="change-password-form"
              loading={changing}
              disabled={!canSubmit}
            >
              Update password
            </Button>
          </>
        )
      }
    >
      {changeSuccess ? (
        <div className="change-success" role="status">
          <CheckCircle size={22} weight="duotone" aria-hidden="true" />
          <p>Password updated. Use it on your next login.</p>
        </div>
      ) : (
        <form
          id="change-password-form"
          className="form-stack"
          onSubmit={(e) => void onSubmit(e)}
        >
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
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helper="At least 8 characters and different from the current password."
            required
            className="input-with-slot"
            rightSlot={<PasswordToggle show={showNew} onToggle={() => setShowNew((v) => !v)} />}
          />
          <Input
            label="Confirm new password"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="input-with-slot"
            rightSlot={<PasswordToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
          />
          {changeError && <InlineError>{changeError}</InlineError>}
        </form>
      )}
    </Modal>
  );
}