import { useEffect, useRef, useState } from 'react';
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
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(durationMs);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    remainingRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    if (paused) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
      }
      return;
    }
    startRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      onDismissRef.current();
    }, remainingRef.current) as unknown as number;
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [paused, durationMs]);

  if (!visible) return null;
  const label = action === 'archived' ? 'Project archived.' : 'Project restored.';
  const undoLabel = action === 'archived' ? 'Undo' : 'Undo';
  const icon = action === 'archived' ? <Archive size={13} aria-hidden="true" /> : <ArrowCounterClockwise size={13} aria-hidden="true" />;
  return (
    <div
      className="save-toast save-toast--undo"
      role="status"
      aria-live="polite"
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
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
}
