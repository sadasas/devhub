import { Trash, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onClose}
      width="sm"
      footer={
        <>
          <Button variant="secondary" leftIcon={<X size={13} aria-hidden="true" />} onClick={onClose} disabled={busy}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={busy}
            leftIcon={<Trash size={13} aria-hidden="true" />}
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


