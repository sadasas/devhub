import { PushPin } from '@phosphor-icons/react';

interface PinButtonProps {
  pinned: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}

export function PinButton({ pinned, label, onToggle, className }: PinButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm btn-icon pin-btn${pinned ? ' pin-btn-active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={pinned}
      aria-label={`${pinned ? 'Unpin' : 'Pin'} ${label}`}
      title={pinned ? 'Unpin' : 'Pin'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <PushPin size={13} weight={pinned ? 'fill' : 'regular'} aria-hidden="true" />
    </button>
  );
}