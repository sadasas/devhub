import { useEffect, useState } from 'react';
import { CheckCircle, Warning, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../state/project-context';
import { Button } from './Button';

const SAVED_VISIBLE_MS = 2000;

export function SaveBanner() {
  const { saveError, saving, retrySave, clearSaveError, lastSavedAt, conflict, resolveConflict } =
    useProject();
  const [showSaved, setShowSaved] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), SAVED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  if (conflict) {
    return (
      <div className="save-toast conflict-banner" role="alert" data-testid="save-banner">
        <Warning size={13} weight="bold" aria-hidden="true" />
        <span>{conflict.message}</span>
        <Button variant="ghost" size="sm" onClick={resolveConflict}>
          {t('action.loadLatest')}
        </Button>
      </div>
    );
  }

  if (saveError) {
    return (
      <div className="save-toast save-banner" role="alert" data-testid="save-banner">
        <Warning size={13} weight="bold" aria-hidden="true" />
        <span>{t('save.failed', { error: saveError })}</span>
        <Button variant="ghost" size="sm" onClick={retrySave} loading={saving}>
          {t('action.retry')}
        </Button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label="Dismiss"
          onClick={clearSaveError}
        >
          <X size={12} weight="bold" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (!saving && !showSaved) return null;

  return (
    <div className="save-toast save-status" role="status" data-testid="save-banner">
      {saving ? (
        t('save.saving')
      ) : (
        <>
          <CheckCircle size={13} weight="bold" aria-hidden="true" />
          {t('save.allSaved')}
        </>
      )}
    </div>
  );
}