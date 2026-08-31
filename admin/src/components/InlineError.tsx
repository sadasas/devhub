import type { ReactNode } from 'react';

interface InlineErrorProps {
  children: ReactNode;
  className?: string;
}

export function InlineError({ children, className }: InlineErrorProps) {
  return (
    <div className={`field-error${className ? ` ${className}` : ''}`} role="alert">
      {children}
    </div>
  );
}
