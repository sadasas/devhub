import { useMemo } from 'react';
import { useActivityUnread } from '../state/ActivityUnreadContext';

export interface SidebarBadge {
  new: number;
  deleted: number;
  total: number;
}

/**
 * Thin wrapper over shared ActivityUnreadContext for backward compat.
 * Sidebar now reuses single batch fetched in Layout — no extra network.
 */
export function useSidebarUnread(
  activeTeamId: string | null | undefined,
  projectIds: string[],
): Record<string, SidebarBadge> {
  const { getBadge } = useActivityUnread();
  return useMemo(() => {
    if (!activeTeamId) return {};
    const next: Record<string, SidebarBadge> = {};
    for (const pid of projectIds) next[pid] = getBadge(pid);
    return next;
  }, [activeTeamId, projectIds, getBadge]);
}
