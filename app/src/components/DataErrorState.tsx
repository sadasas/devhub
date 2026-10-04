import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningCircle } from '@phosphor-icons/react';
import { classifyError, type ErrorKind } from '../lib/errors';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import type { DoodleTone, DoodleVariant } from './DoodleIllustration';

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
  const doodle = doodleByKind[kind];
  const doodleTone = doodleToneByKind[kind];
  const retryAction = onRetry ? (
    <Button variant="secondary" size="sm" onClick={onRetry}>
      {retryLabel ?? t('action.retry')}
    </Button>
  ) : null;
  return (
    <EmptyState
      icon={<span className="data-error-icon" aria-hidden="true"><WarningCircle size={22} weight="duotone" aria-hidden="true" /></span>}
      doodle={doodle}
      doodleTone={doodleTone}
      title={title ?? t(`dataError.${kind}Title`)}
      description={description ?? t(`dataError.${kind}Desc`)}
      action={action ?? retryAction ?? undefined}
    />
  );
}

const doodleByKind: Record<ErrorKind, DoodleVariant> = {
  offline: 'offline',
  rateLimited: 'offline',
  server: 'broken',
  notFound: 'not-found',
  forbidden: 'locked',
  business: 'locked',
  generic: 'empty',
};

const doodleToneByKind: Record<ErrorKind, DoodleTone> = {
  offline: 'soft-cream',
  rateLimited: 'soft-cream',
  server: 'soft-cream',
  notFound: 'soft-blue',
  forbidden: 'soft-cream',
  business: 'soft-cream',
  generic: 'neutral',
};
