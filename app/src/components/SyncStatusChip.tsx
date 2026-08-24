import { useTranslation } from 'react-i18next';
import { Badge } from './Badge';
import { useProject } from '../state/project-context';

export function SyncStatusChip() {
  const { isOffline, pendingCount } = useProject();
  const { t } = useTranslation();

  if (isOffline) {
    return (
      <Badge tone="danger" dot title={t('sync.offlineTitle')}>
        {t('sync.offline')}
        {pendingCount > 0 ? ` ${t('sync.pendingSuffix', { count: pendingCount })}` : ''}
      </Badge>
    );
  }

  if (pendingCount > 0) {
    return (
      <Badge tone="warn" dot title={t('sync.pendingTitle', { count: pendingCount })}>
        {t('sync.pending', { count: pendingCount })}
      </Badge>
    );
  }

  return null;
}
