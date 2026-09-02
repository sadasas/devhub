import { CheckCircle, Info, Warning } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function Callout({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn' | 'success';
}) {
  const isWarn = tone === 'warn';
  const isSuccess = tone === 'success';
  const Icon = isWarn ? Warning : isSuccess ? CheckCircle : Info;
  const klass = isWarn ? 'docs-callout-warn' : isSuccess ? 'docs-callout-success' : '';
  return (
    <div className={`docs-callout ${klass}`} role="note">
      <Icon
        size={15}
        weight="bold"
        className="docs-callout-icon"
        aria-hidden="true"
        style={
          isWarn
            ? { color: 'var(--status-warn)' }
            : isSuccess
              ? { color: 'var(--accent)' }
              : undefined
        }
      />
      <div className="docs-callout-body">{children}</div>
    </div>
  );
}
