import type { CSSProperties, ReactNode } from 'react';

interface InlineErrorProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function InlineError({ children, style }: InlineErrorProps) {
  return (
    <p className="field-error" role="alert" style={style}>
      {children}
    </p>
  );
}
