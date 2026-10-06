import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { ConfirmFooter } from './ConfirmFooter';
import { InlineError } from './InlineError';
import { Modal } from './Modal';

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Override ikon tombol konfirmasi (default Trash ala ConfirmFooter). */
  confirmIcon?: ReactNode;
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
  confirmIcon,
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
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
        <ConfirmFooter
          onCancel={onClose}
          onConfirm={onConfirm}
          confirmLabel={confirmLabel}
          confirmIcon={confirmIcon}
          busy={busy}
        />
      }
    >
      <p id={descId} className="modal-copy">{description}</p>
      {error && <div ref={errorRef} tabIndex={-1} className="form-error-focus"><InlineError>{error}</InlineError></div>}
    </Modal>
  );
}


