import { CheckCircle, Trash, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  /** Fase 1: confirm non-destruktif (Activate/SetFeatured) pakai varian non-danger. */
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  tone = 'danger',
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation();
  const isDanger = tone === 'danger';
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" leftIcon={<X size={13} aria-hidden="true" />} onClick={onClose} disabled={busy}>
            {t('action.cancel')}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            loading={busy}
            disabled={busy}
            leftIcon={
              isDanger ? (
                <Trash size={13} aria-hidden="true" />
              ) : (
                <CheckCircle size={13} aria-hidden="true" />
              )
            }
            onClick={onConfirm}
          >
            {confirmLabel ?? t('action.delete')}
          </Button>
        </>
      }
    >
      <p className="modal-copy">{description}</p>
    </Modal>
  );
}


