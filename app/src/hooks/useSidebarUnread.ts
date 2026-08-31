import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { ActivityUnreadSummary } from '../lib/types';
import { TeamChatSocket, realtimeWsUrl } from '../lib/realtime-client';

export interface SidebarBadge {
  new: number;
  deleted: number;
  total: number;
}

/**
 * Batch unread for sidebar project list.
 * - fetched via POST /projects/activity/unread/batch
 * - live increment via team room activity:new (created+deleted only)
 * - aggregasi total new/deleted across all tabs per project
 */
export function useSidebarUnread(
  activeTeamId: string | null | undefined,
  projectIds: string[],
): Record<string, SidebarBadge> {
  const [badges, setBadges] = useState<Record<string, SidebarBadge>>({});

  // Keep stable key for effect deps
  const idsKey = projectIds.join(',');

  const projectIdsRef = useRef<string[]>(projectIds);
  projectIdsRef.current = projectIds;

  useEffect(() => {
    if (!activeTeamId || projectIds.length === 0) {
      setBadges({});
      return;
    }
    let cancelled = false;
    const ids = [...new Set(projectIds)];
    void (async () => {
      try {
        const res = await api.fetchActivityUnreadBatch(ids);
        if (cancelled) return;
        const next: Record<string, SidebarBadge> = {};
        for (const pid of ids) {
          const summary: ActivityUnreadSummary | undefined = res.summaries[pid];
          if (!summary) {
            next[pid] = { new: 0, deleted: 0, total: 0 };
            continue;
          }
          const counts = summary.counts ?? {};
          let totalNew = 0;
          let totalDeleted = 0;
          for (const val of Object.values(counts)) {
            if (typeof val === 'number') totalNew += val as number;
            else if (val && typeof val === 'object') {
              const v = val as { new?: number; deleted?: number; total?: number };
              totalNew += v.new ?? 0;
              totalDeleted += v.deleted ?? 0;
            }
          }
          next[pid] = { new: totalNew, deleted: totalDeleted, total: totalNew + totalDeleted };
        }
        setBadges(next);
      } catch {
        if (!cancelled) setBadges({});
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamId, idsKey]);

  // Live increment via team room
  useEffect(() => {
    if (!activeTeamId) return;
    // Use a socket that joins team room and listens for activity:new
    const wsUrl = realtimeWsUrl();
    let socket: TeamChatSocket | null = null;
    try {
      socket = new TeamChatSocket({
        wsUrl,
        teamId: activeTeamId,
        onActivity: (msg) => {
          if (msg.entry.action !== 'created' && msg.entry.action !== 'deleted') return;
          const pid = msg.projectId;
          if (!projectIdsRef.current.includes(pid)) return;
          setBadges((prev) => {
            const cur = prev[pid] ?? { new: 0, deleted: 0, total: 0 };
            const isNew = msg.entry.action === 'created';
            const next = {
              new: cur.new + (isNew ? 1 : 0),
              deleted: cur.deleted + (isNew ? 0 : 1),
              total: cur.total + 1,
            };
            return { ...prev, [pid]: next };
          });
        },
      });
    } catch {
      // best-effort: ignore socket errors
    }
    return () => {
      socket?.close();
    };
  }, [activeTeamId]);

  // Refetch on watermark write (tab marked read) — listen for custom event dispatched by useTabUnread consumers
  useEffect(() => {
    if (!activeTeamId || projectIds.length === 0) return;
    const handler = () => {
      // small debounce via setTimeout to allow server watermark to commit
      setTimeout(() => {
        void (async () => {
          try {
            const ids = [...new Set(projectIdsRef.current)];
            if (ids.length === 0) return;
            const res = await api.fetchActivityUnreadBatch(ids);
            const next: Record<string, SidebarBadge> = {};
            for (const pid of ids) {
              const summary = res.summaries[pid];
              if (!summary) {
                next[pid] = { new: 0, deleted: 0, total: 0 };
                continue;
              }
              let totalNew = 0;
              let totalDeleted = 0;
              for (const val of Object.values(summary.counts ?? {})) {
                if (typeof val === 'number') totalNew += val as number;
                else if (val && typeof val === 'object') {
                  const v = val as { new?: number; deleted?: number };
                  totalNew += v.new ?? 0;
                  totalDeleted += v.deleted ?? 0;
                }
              }
              next[pid] = { new: totalNew, deleted: totalDeleted, total: totalNew + totalDeleted };
            }
            setBadges(next);
          } catch { /* ignore */ }
        })();
      }, 300);
    };
    window.addEventListener('devhub:read-watermark', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('devhub:read-watermark', handler);
      window.removeEventListener('focus', handler);
    };
  }, [activeTeamId, idsKey, projectIds.length]);

  return badges;
}
