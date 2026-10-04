import { PushPin } from '@phosphor-icons/react';
import { Tooltip } from './Tooltip';

interface PinButtonProps {
  pinned: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}

export function PinButton({ pinned, label, onToggle, className }: PinButtonProps) {
  return (
    <Tooltip title={`${pinned ? 'Unpin' : 'Pin'} ${label}`}>
    <button
      type="button"
      className={`btn btn-ghost btn-sm btn-icon pin-btn${pinned ? ' pin-btn-active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={pinned}
      aria-label={`${pinned ? 'Unpin' : 'Pin'} ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        onToggle();
        // Klik pointer meninggalkan fokus di tombol → baris induk tetap
        // :focus-within sehingga actions terlihat nyangkut walau mouse sudah
        // pergi. Blur hanya untuk pointer (detail > 0); aktivasi keyboard
        // (Enter/Space, detail === 0) tetap pegang fokus demi a11y.
        if (e.detail !== 0) btn.blur();
      }}
    >
        <PushPin size={13} weight={pinned ? 'fill' : 'regular'} aria-hidden="true" />
    </button>
    </Tooltip>
  );
}