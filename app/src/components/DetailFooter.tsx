import type { ReactNode } from 'react';
import { Trash } from '@phosphor-icons/react';
import { Button } from './Button';

interface DetailFooterProps {
  /** Minta hapus — biasanya membuka `ConfirmDeleteDialog` (hapus aktual di sana). */
  onDelete: () => void;
  /** Label tombol hapus (per-area, mis. `t('issues.modal.delete')`). */
  deleteLabel: ReactNode;
  /** Ikon hapus; default Trash 14. */
  deleteIcon?: ReactNode;
  /** Status autosave kanan (`span.save-state`, teks i18n per-area —
      sengaja `children`, bukan prop teks, agar kunci i18n tak diduplikat). */
  children?: ReactNode;
}

/**
 * Footer modal detail autosave kanonis (Tier-1, pola `TaskModal`):
 * `[danger sm Delete kiri][save-state kanan]`. Tanpa Cancel — read-mode
 * ditutup via X header; hapus via `ConfirmDeleteDialog`. Layout
 * `space-between` datang dari `.modal-footer:has(.save-state)` (§4b).
 */
export function DetailFooter({ onDelete, deleteLabel, deleteIcon, children }: DetailFooterProps) {
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        leftIcon={deleteIcon ?? <Trash size={14} aria-hidden="true" />}
        onClick={onDelete}
      >
        {deleteLabel}
      </Button>
      {children}
    </>
  );
}
