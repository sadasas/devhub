import { Badge } from './Badge';
import { useProject } from '../state/project-context';

export function SyncStatusChip() {
  const { isOffline, pendingCount } = useProject();

  if (isOffline) {
    return (
      <Badge tone="danger" dot title="Cannot reach the server — changes are kept locally and will sync when connectivity returns.">
        Offline{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
      </Badge>
    );
  }

  if (pendingCount > 0) {
    return (
      <Badge tone="warn" dot title={`${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync.`}>
        Pending {pendingCount}
      </Badge>
    );
  }

  return null;
}
