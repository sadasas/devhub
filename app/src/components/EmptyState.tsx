import type { ReactNode } from 'react';
import { DoodleIllustration, type DoodleVariant } from './DoodleIllustration';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  doodle?: DoodleVariant;
  doodleTone?: 'soft-blue' | 'soft-mint' | 'soft-cream' | 'neutral';
}

export function EmptyState({ icon, title, description, action, doodle, doodleTone }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {doodle ? (
        <DoodleIllustration variant={doodle} tone={doodleTone} size={140} />
      ) : (
        <div className="empty-state-icon">{icon}</div>
      )}
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
