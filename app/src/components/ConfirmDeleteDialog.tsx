import { useId } from 'react';
import { Trash, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { InlineError } from './InlineError';
import { Modal } from './Modal';

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation();
  const descId = useId();
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onClose}
      width="sm"
      ariaDescribedBy={descId}
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
      <p id={descId} className="modal-copy">{description}</p>
      {error && <InlineError>{error}</InlineError>}
    </Modal>
  );
}


