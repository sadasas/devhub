import { Info, Warning } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function Callout({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn';
}) {
  const isWarn = tone === 'warn';
  const Icon = isWarn ? Warning : Info;
  return (
    <div className={`docs-callout ${isWarn ? 'docs-callout-warn' : ''}`} role="note">
      <Icon
        size={15}
        weight="bold"
        className="docs-callout-icon"
        aria-hidden="true"
        style={isWarn ? { color: 'var(--status-warn)' } : undefined}
      />
      <div className="docs-callout-body">{children}</div>
    </div>
  );
}
