import { Users } from '@phosphor-icons/react';
import { useProject } from '../state/project-context';

export function PresenceChip() {
  const { presence } = useProject();
  if (presence.length === 0) return null;
  const names = presence
    .map((u) => u.name || 'User')
    .filter((name, idx, arr) => arr.indexOf(name) === idx)
    .join(', ');
  return (
    <span className="badge badge-info" title={names} data-testid="presence-chip">
      <span className="badge-dot" aria-hidden="true" />
      <Users size={11} aria-hidden="true" />
      {presence.length} online
    </span>
  );
}
