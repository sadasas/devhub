import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'info';

interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  title?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot = false, title, children }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
