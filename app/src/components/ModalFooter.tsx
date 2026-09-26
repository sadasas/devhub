import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface ModalFooterProps {
  /** Batalkan dan tutup — selalu ghost md di kiri (Batch 4). */
  onCancel: () => void;
  /** Label Cancel; default `common:action.cancel`. */
  cancelLabel?: ReactNode;
  /** Nonaktifkan Cancel (mis. saat busy). */
  cancelDisabled?: boolean;
  /** Aksi kanan — Button `size="md"` (primer/danger + `leftIcon` 14px). */
  children: ReactNode;
}

/**
 * Footer modal kanonis (Tier-1, `design-tokens` §4b `modal-footer`):
 * `[ghost md Cancel kiri][aksi kanan]`. Layout datang dari `.modal-footer`
 * (desktop `flex-end`, mobile 50/50) — komponen ini hanya mengunci urutan
 * dan varian agar 54 call-site `footer={` tidak ditulis manual lagi.
 */
export function ModalFooter({ onCancel, cancelLabel, cancelDisabled, children }: ModalFooterProps) {
  const { t } = useTranslation();
  return (
    <>
      <Button variant="ghost" size="md" onClick={onCancel} disabled={cancelDisabled}>
        {cancelLabel ?? t('action.cancel')}
      </Button>
      {children}
    </>
  );
}
