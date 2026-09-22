import { useTranslation } from 'react-i18next';
import { GoogleLogo } from '@phosphor-icons/react';
import { useGCalSync } from '../../hooks/useGCalSync';
import { Tooltip } from '../../components/Tooltip';

/**
 * Penanda kecil (11px) bahwa task punya event di Google Calendar.
 * Render null bila tidak tersync / status gagal dimuat (fail-soft).
 */
export function GCalSyncedMark({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string | null | undefined;
}) {
  const { t } = useTranslation('tracker');
  const { syncedIds } = useGCalSync(projectId);
  if (!syncedIds.has(taskId)) return null;
  return (
    <Tooltip
      tone="light"
      title={t('board.gcal.syncedTask', { defaultValue: 'Synced to Google Calendar' })}
    >
      <span
        style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
        aria-hidden="true"
      >
        <GoogleLogo size={11} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}
