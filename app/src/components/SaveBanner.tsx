import { Warning } from '@phosphor-icons/react';
import { useProject } from '../state/project-context';
import { Button } from './Button';

export function SaveBanner() {
  const { saveError, saving, retrySave } = useProject();
  if (!saveError) return null;

  return (
    <div className="save-banner" role="alert">
      <Warning size={13} weight="bold" aria-hidden="true" />
      <span>Save failed: {saveError} — your changes are kept locally.</span>
      <Button variant="ghost" size="sm" onClick={retrySave} loading={saving}>
        Retry
      </Button>
    </div>
  );
}
