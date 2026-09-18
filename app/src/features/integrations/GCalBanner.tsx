import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';

interface GCalBannerProps {
  email?: string | null;
  onReconnect: () => void;
  busy?: boolean;
}

/**
 * Banner reconnect GCal — reuse .save-toast.conflict-banner (warn) + Badge warn dot.
 * Muncul hanya saat koneksi expired; hilang setelah reconnect/disconnect.
 */
export function GCalBanner({ email, onReconnect, busy = false }: GCalBannerProps) {
  const { t } = useTranslation('extras');
  return (
    <div className="save-toast conflict-banner" role="alert" data-testid="gcal-banner">
      <Badge tone="warn" dot>
        {t('gcal.expired', { defaultValue: 'Connection expired' })}
      </Badge>
      <div className="save-toast-body">
        <span>{t('gcal.bannerText', { defaultValue: 'Google Calendar needs reconnecting — sync is paused.' })}</span>
        {email ? <span className="field-helper">{email}</span> : null}
        <div className="save-toast-actions">
          <Button variant="secondary" size="sm" onClick={onReconnect} loading={busy} disabled={busy}>
            {t('gcal.reconnect', { defaultValue: 'Reconnect' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
