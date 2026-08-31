import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function ToastStack({ children }: Props) {
  const content = (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
      {children}
    </div>
  );
  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
