import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash } from '@phosphor-icons/react';
import { Button } from './Button';
import { ModalFooter } from './ModalFooter';

interface ConfirmFooterProps {
  /** Batalkan dan tutup — diteruskan ke `ModalFooter` (ghost md kiri). */
  onCancel: () => void;
  /** Konfirmasi aksi — tombol kanan. */
  onConfirm: () => void;
  /** Label tombol konfirmasi; default `common:action.delete`. */
  confirmLabel?: ReactNode;
  /** Varian eksplisit (bukan boolean mode): destruktif, primer, atau ghost
      (pengembalian non-destruktif seperti Restore — pola archive-modal). */
  tone?: 'danger' | 'primary' | 'ghost';
  /** Ikon kiri tombol konfirmasi; default Trash 14. */
  confirmIcon?: ReactNode;
  /** Saat busy: Cancel disabled + tombol konfirmasi loading. */
  busy?: boolean;
  /** Label Cancel kustom; default `common:action.cancel`. */
  cancelLabel?: ReactNode;
  /** Nonaktifkan tombol konfirmasi tanpa busy (mis. guard last-method). */
  confirmDisabled?: boolean;
}

/**
 * Footer konfirmasi 2-langkah kanonis (Tier-1, pola `ConfirmDeleteDialog`):
 * `[ghost md Cancel kiri][danger|primary md + ikon kanan]`. Untuk konfirmasi
 * non-standar (mis. `type="submit" form=`) pakai `ModalFooter` + `children`.
 */
export function ConfirmFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  tone = 'danger',
  confirmIcon,
  busy = false,
  cancelLabel,
  confirmDisabled = false,
}: ConfirmFooterProps) {
  const { t } = useTranslation();
  return (
    <ModalFooter onCancel={onCancel} cancelLabel={cancelLabel} cancelDisabled={busy}>
      <Button
        variant={tone}
        size="md"
        loading={busy}
        disabled={busy || confirmDisabled}
        leftIcon={confirmIcon ?? <Trash size={14} aria-hidden="true" />}
        onClick={onConfirm}
      >
        {confirmLabel ?? t('action.delete')}
      </Button>
    </ModalFooter>
  );
}
