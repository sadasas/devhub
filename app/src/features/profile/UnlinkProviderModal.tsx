import { LinkBreak, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';

interface UnlinkProviderModalProps {
  open: boolean;
  provider: 'google' | 'github' | null;
  email: string | null;
  hasPassword: boolean;
  linkedCount: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function UnlinkProviderModal({
  open,
  provider,
  email,
  hasPassword,
  linkedCount,
  busy,
  error,
  onClose,
  onConfirm,
}: UnlinkProviderModalProps) {
  const { t } = useTranslation('account');
  if (!provider) return null;

  const isLastMethod = !hasPassword && linkedCount === 1;
  const providerLabel = provider === 'google' ? 'Google' : 'GitHub';
  const titleKey =
    provider === 'google'
      ? 'profile.security.unlinkModal.title.google'
      : 'profile.security.unlinkModal.title.github';
  const title = t(titleKey, { defaultValue: `Unlink ${providerLabel}?` });

  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onClose}
      width="sm"
      footer={
        <>
          <Button variant="secondary" leftIcon={<X size={12} aria-hidden="true" />} onClick={onClose} disabled={busy}>
            {t('profile.security.unlinkModal.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="danger"
            leftIcon={<LinkBreak size={13} aria-hidden="true" />}
            loading={busy}
            disabled={busy || isLastMethod}
            onClick={onConfirm}
            aria-busy={busy || undefined}
          >
            {t('profile.security.unlinkModal.confirm', { defaultValue: 'Unlink' })}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <p className="modal-copy">
          {email
            ? t('profile.security.unlinkModal.body', {
                provider: providerLabel,
                email,
                defaultValue: `${providerLabel} account ${email} will be unlinked from DevHub. You can still sign in with your password. You can reconnect anytime from this page.`,
              })
            : t('profile.security.unlinkModal.bodyGeneric', {
                provider: providerLabel,
                defaultValue: `${providerLabel} account will be unlinked. You can still sign in with your password.`,
              })}
        </p>
        {isLastMethod && (
          <div className="inline-error" role="alert" style={{ background: 'var(--status-warn-dim)', borderColor: 'transparent', color: 'var(--status-warn)' }}>
            {t('profile.security.unlinkModal.lastMethodWarning', {
              defaultValue: 'This is your last sign-in method. Set a password first (Security → Change password), then try again.',
            })}
          </div>
        )}
        {error && <InlineError>{error}</InlineError>}
      </div>
    </Modal>
  );
}
