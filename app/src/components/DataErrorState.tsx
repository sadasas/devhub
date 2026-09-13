import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningCircle } from '@phosphor-icons/react';
import { classifyError } from '../lib/errors';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface DataErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}

/** Friendly GET-failure state. */
export function DataErrorState({ error, onRetry, retryLabel, title, description, action }: DataErrorStateProps) {
  const { t } = useTranslation('common');
  const kind = classifyError(error);
  const retryAction = onRetry ? (
    <Button variant="secondary" size="sm" onClick={onRetry}>
      {retryLabel ?? t('action.retry')}
    </Button>
  ) : null;
  return (
    <EmptyState
      icon={<span className="data-error-icon" aria-hidden="true"><WarningCircle size={22} weight="duotone" aria-hidden="true" /></span>}
      title={title ?? t(`dataError.${kind}Title`)}
      description={description ?? t(`dataError.${kind}Desc`)}
      action={action ?? retryAction ?? undefined}
    />
  );
}
