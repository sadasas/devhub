import type { ReactNode } from 'react';

interface LoadingStateProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function LoadingState({ label, children, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={className}
    >
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
