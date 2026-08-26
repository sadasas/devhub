import { Archive, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Button } from '../../components/Button';

interface ArchivedBannerProps {
  canRestore: boolean;
  restoring?: boolean;
  onRestore?: () => void;
}

export function ArchivedBanner({ canRestore, restoring, onRestore }: ArchivedBannerProps) {
  return (
    <div className="archived-banner" role="status" aria-live="polite">
      <Archive size={14} weight="duotone" aria-hidden="true" />
      <span className="archived-banner-copy">This project is archived — read-only. Editing, creating and drag-drop are disabled.</span>
      {canRestore && onRestore ? (
        <Button variant="ghost" size="sm" leftIcon={<ArrowCounterClockwise size={13} aria-hidden="true" />} loading={restoring} onClick={onRestore}>
          Restore
        </Button>
      ) : null}
    </div>
  );
}
