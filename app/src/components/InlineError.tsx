import type { ReactNode } from 'react';

interface InlineErrorProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function InlineError({ children, className, id }: InlineErrorProps) {
  return (
    <div id={id} className={`field-error${className ? ` ${className}` : ''}`} role="alert" aria-atomic="true">
      {children}
    </div>
  );
}
