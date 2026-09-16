import { useEffect, useId, useRef } from 'react';
import { Trash } from '@phosphor-icons/react';
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
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) requestAnimationFrame(() => errorRef.current?.focus());
  }, [error]);
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onClose}
      width="sm"
      ariaDescribedBy={descId}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="danger"
            size="md"
            loading={busy}
            disabled={busy}
            leftIcon={<Trash size={14} aria-hidden="true" />}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('action.delete')}
          </Button>
        </>
      }
    >
      <p id={descId} className="modal-copy">{description}</p>
      {error && <div ref={errorRef} tabIndex={-1} className="form-error-focus"><InlineError>{error}</InlineError></div>}
    </Modal>
  );
}


