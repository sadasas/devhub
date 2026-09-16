import { Archive, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';

interface ArchivedBannerProps {
  canRestore: boolean;
  restoring?: boolean;
  onRestore?: () => void;
}

export function ArchivedBanner({ canRestore, restoring, onRestore }: ArchivedBannerProps) {
  const { t } = useTranslation('project');
  return (
    <div className="archived-banner" role="status" aria-live="polite">
      <Archive size={14} weight="duotone" aria-hidden="true" />
      <span className="archived-banner-copy">{t('banner.archivedCopy')}</span>
      {canRestore && onRestore ? (
        <Button variant="ghost" size="sm" leftIcon={<ArrowCounterClockwise size={14} aria-hidden="true" />} loading={restoring} onClick={onRestore}>
          {t('banner.archivedRestore')}
        </Button>
      ) : null}
    </div>
  );
}
