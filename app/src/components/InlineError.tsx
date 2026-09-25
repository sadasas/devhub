import type { ReactNode } from 'react';
import { Warning } from '@phosphor-icons/react';

interface InlineErrorProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function InlineError({ children, className, id }: InlineErrorProps) {
  return (
    <div id={id} className={`field-error${className ? ` ${className}` : ''}`} role="alert" aria-atomic="true">
      <Warning size={12} weight="bold" aria-hidden="true" />
      {children}
    </div>
  );
}
