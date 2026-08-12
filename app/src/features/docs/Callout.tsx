import { Info } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-callout" role="note">
      <Info size={15} weight="bold" className="docs-callout-icon" aria-hidden="true" />
      <div className="docs-callout-body">{children}</div>
    </div>
  );
}