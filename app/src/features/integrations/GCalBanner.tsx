import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { StatusBanner } from '../../components/StatusBanner';

interface GCalBannerProps {
  email?: string | null;
  onReconnect: () => void;
  busy?: boolean;
}

/**
 * Banner reconnect GCal — thin wrapper di atas StatusBanner bersama
 * (aturan penempatan global: docs/03-engineering/coding-standards.md §7).
 * Muncul hanya saat koneksi expired; hilang setelah reconnect/disconnect.
 */
export function GCalBanner({ email, onReconnect, busy = false }: GCalBannerProps) {
  const { t } = useTranslation('extras');
  return (
    <StatusBanner
      tone="warn"
      title={t('gcal.expired', { defaultValue: 'Connection expired' })}
      message={
        <>
          <span>
            {t('gcal.bannerText', { defaultValue: 'Google Calendar needs reconnecting — sync is paused.' })}
          </span>
          {email ? <span className="field-helper">{email}</span> : null}
        </>
      }
      actions={
        <Button variant="secondary" size="sm" onClick={onReconnect} loading={busy} disabled={busy}>
          {t('gcal.reconnect', { defaultValue: 'Reconnect' })}
        </Button>
      }
      testId="gcal-banner"
    />
  );
}
