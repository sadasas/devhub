import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArrowCounterClockwise, X } from '@phosphor-icons/react';
import { Button } from '../../components/Button';

interface Props {
  action: 'archived' | 'restored';
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function ArchiveUndoToast({ action, onUndo, onDismiss, durationMs = 10000 }: Props) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onDismiss]);

  if (!visible) return null;
  const label = action === 'archived' ? 'Project archived.' : 'Project restored.';
  const undoLabel = action === 'archived' ? 'Undo' : 'Undo';
  const icon = action === 'archived' ? <Archive size={13} aria-hidden="true" /> : <ArrowCounterClockwise size={13} aria-hidden="true" />;
  const content = (
    <div className="save-toast save-toast--undo" role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {icon}
      <span>{label}</span>
      <Button variant="ghost" size="sm" onClick={onUndo}>
        {undoLabel}
      </Button>
      <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Dismiss" onClick={() => { setVisible(false); onDismiss(); }}>
        <X size={12} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
