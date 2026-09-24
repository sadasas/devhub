import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { GoogleLogo } from '@phosphor-icons/react';
import { useGCalSync } from '../../hooks/useGCalSync';
import { formatRelative } from '../../lib/utils';
import { Tooltip } from '../../components/Tooltip';

/**
 * Indikator sync Google Calendar 1 tombol (32px, ringkas ala Linear).
 * Dot status 8px overlay di pojok ikon; tooltip kaya berisi status penuh.
 * Fail-soft: loading/gagal/public → tidak render apa-apa (tanpa layout-shift).
 */
export function GCalSyncButton({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation(['tracker', 'extras']);
  const { status, loading } = useGCalSync(projectId);
  if (loading || !status) return null;

  const connected = status.connected === true;
  const expired = status.expired === true;
  const syncOn = status.syncEnabled === true && connected && !expired;

  // Viewer hanya melihat status read-only; link hanya untuk editor.
  const to = `/project/${encodeURIComponent(projectId)}?tab=settings&section=integrations`;

  const dotColor = !connected
    ? 'var(--text-muted)'
    : expired
      ? 'var(--status-danger)'
      : syncOn
        ? 'var(--status-success)'
        : 'var(--text-muted)';

  const label = !connected
    ? t('board.gcal.connect', { defaultValue: 'Connect Google Calendar' })
    : expired
      ? t('board.gcal.reconnect', { defaultValue: 'Connection expired — reconnect' })
      : syncOn
        ? status.lastSyncAt
          ? t('board.gcal.syncedAt', {
            defaultValue: 'Synced {{time}}',
            time: formatRelative(status.lastSyncAt),
          })
          : t('board.gcal.syncOn', { defaultValue: 'Sync on' })
        : t('board.gcal.syncOff', { defaultValue: 'Sync off' });

  const fullLabel = status.email ? `${label} · ${status.email}` : label;

  const icon = (
    <span style={{ position: 'relative', display: 'inline-flex' }} aria-hidden="true">
      <GoogleLogo size={14} aria-hidden="true" />
      <span
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          border: '2px solid var(--bg-elevated)',
        }}
      />
    </span>
  );

  const button = canEdit ? (
    <Link
      to={to}
      aria-label={fullLabel}
      className="btn btn-ghost btn-sm btn-icon"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {icon}
    </Link>
  ) : (
    <span
      role="img"
      aria-label={fullLabel}
      className="btn btn-ghost btn-sm btn-icon"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
    >
      {icon}
    </span>
  );

  return (
    <Tooltip title={fullLabel}>
      {button}
    </Tooltip>
  );
}
