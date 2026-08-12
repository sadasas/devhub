import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Warning } from '@phosphor-icons/react';
import { useProject } from '../state/project-context';
import { Button } from './Button';

const SAVED_VISIBLE_MS = 2000;

export function SaveBanner() {
  const { saveError, saving, retrySave, lastSavedAt } = useProject();
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), SAVED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  if (saveError) {
    return createPortal(
      <div className="save-toast save-banner" role="alert">
        <Warning size={13} weight="bold" aria-hidden="true" />
        <span>Save failed: {saveError} — your changes are kept locally.</span>
        <Button variant="ghost" size="sm" onClick={retrySave} loading={saving}>
          Retry
        </Button>
      </div>,
      document.body,
    );
  }

  if (!saving && !showSaved) return null;

  return createPortal(
    <div className="save-toast save-status" role="status">
      {saving ? (
        'Saving…'
      ) : (
        <>
          <CheckCircle size={13} weight="bold" aria-hidden="true" />
          All changes saved
        </>
      )}
    </div>,
    document.body,
  );
}