import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Info, Warning } from '@phosphor-icons/react';
import { Badge, type BadgeTone } from './Badge';
import { Button } from './Button';

export type StatusBannerTone = 'danger' | 'warn' | 'success' | 'info';

interface StatusBannerProps {
  tone: StatusBannerTone;
  message: ReactNode;
  /** Label badge di depan pesan (mis. "Connected" / "Connection failed"). Tanpa title -> ikon nada sebagai penanda. */
  title?: string;
  /** Aksi kustom di bawah pesan (mis. tombol Reconnect). */
  actions?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retryBusy?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
  testId?: string;
}

const TONE_CLASS: Record<StatusBannerTone, string> = {
  danger: 'save-banner',
  warn: 'conflict-banner',
  success: 'save-status',
  info: 'info-banner',
};

const BADGE_TONE: Record<StatusBannerTone, BadgeTone> = {
  danger: 'danger',
  warn: 'warn',
  success: 'success',
  info: 'info',
};

/**
 * Banner status section-level bersama (pengganti duplikasi flash/error
 * ala GCal/GitHub): nada -> warna `var(--status-*)` + ikon + `role` otomatis
 * (`alert` untuk danger/warn, `status` untuk success/info).
 * Aturan penempatan global: docs/03-engineering/coding-standards.md §7.
 * Field-level tetap `InlineError`; gagal-load-tanpa-data tetap `DataErrorState`.
 */
export function StatusBanner({
  tone,
  message,
  title,
  actions,
  onRetry,
  retryLabel,
  retryBusy,
  onDismiss,
  dismissLabel,
  testId,
}: StatusBannerProps) {
  const { t } = useTranslation();
  const role = tone === 'danger' || tone === 'warn' ? 'alert' : 'status';
  const showActions = Boolean(actions) || Boolean(onRetry);

  return (
    <div className={`save-toast ${TONE_CLASS[tone]}`} role={role} data-testid={testId ?? 'status-banner'}>
      {title ? (
        <Badge tone={BADGE_TONE[tone]} dot>
          {title}
        </Badge>
      ) : tone === 'success' ? (
        <CheckCircle size={13} weight="bold" aria-hidden="true" />
      ) : tone === 'info' ? (
        <Info size={13} weight="bold" aria-hidden="true" />
      ) : (
        <Warning size={13} weight="bold" aria-hidden="true" />
      )}
      <div className="save-toast-body">
        <span>{message}</span>
        {showActions ? (
          <div className="save-toast-actions">
            {actions}
            {onRetry ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                loading={retryBusy}
              >
                {retryLabel ?? t('action.retry', { defaultValue: 'Retry' })}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <Button
          variant="ghost"
          size="sm"
          className="save-toast-close"
          onClick={onDismiss}
        >
          {dismissLabel ?? t('action.dismiss', { defaultValue: 'Dismiss' })}
        </Button>
      ) : null}
    </div>
  );
}
