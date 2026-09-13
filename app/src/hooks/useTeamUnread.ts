import { useMemo } from 'react';
import { useActivityUnread } from '../state/ActivityUnreadContext';

/**
 * Thin wrapper over shared ActivityUnreadContext for backward compat.
 * Reuses a single batch — no extra network.
 */
export function useTeamUnread(
  teams: { id: string }[] | null | undefined,
  _projects: { id: string; teamId: string }[] | null | undefined,
): Record<string, number> {
  const { totalsByTeam } = useActivityUnread();
  return useMemo(() => {
    if (!teams || teams.length === 0) return {};
    const next: Record<string, number> = {};
    for (const t of teams) next[t.id] = totalsByTeam[t.id] ?? 0;
    return next;
  }, [teams, totalsByTeam]);
}
