import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

export interface ToastItem {
  id: string;
  message: string;
}

/** ToastStack global reuse (Fase 2) — ganti helper ad-hoc useToastMessage.
 *  - stacking (maks 3, tertua dibuang)
 *  - auto-dismiss per toast + cleanup saat unmount (tanpa leak)
 *  - aria-live polite di container + role=status per toast
 *  - dismiss manual per toast (aria-label reuse action.close, tanpa string baru)
 */
export function useToastStack(timeoutMs = 5000): {
  toasts: ToastItem[];
  pushToast: (msg: string) => void;
  dismissToast: (id: string) => void;
} {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (msg: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-2), { id, message: msg }]);
      const timer = window.setTimeout(() => {
        timers.current.delete(id);
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, timeoutMs);
      timers.current.set(id, timer);
    },
    [timeoutMs],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  return { toasts, pushToast, dismissToast };
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((item) => (
        <div key={item.id} className="admin-toast admin-toast--stacked" role="status">
          <CheckCircle size={14} weight="duotone" aria-hidden="true" />
          <span>{item.message}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon admin-toast-dismiss"
            onClick={() => onDismiss(item.id)}
            aria-label={t('action.close')}
          >
            <X size={12} weight="bold" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
