import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { ActivityUnreadSummary } from '../lib/types';
import { TeamChatSocket, realtimeWsUrl } from '../lib/realtime-client';

function totalFromSummary(summary: ActivityUnreadSummary | undefined): number {
  if (!summary) return 0;
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
  return totalNew + totalDeleted;
}

/**
 * Totale unread (new+deleted) per team — tunggal badge untuk TeamRail.
 * - batch via POST /projects/activity/unread/batch untuk semua project
 * - live increment via team room activity:new (created|deleted)
 * - refetch on read-watermark / focus
 * - hide bila 0 (sembunyikan dulu bila solo)
 */
export function useTeamUnread(
  teams: { id: string }[] | null | undefined,
  projects: { id: string; teamId: string }[] | null | undefined,
): Record<string, number> {
  const [totals, setTotals] = useState<Record<string, number>>({});

  const teamIds = (teams ?? []).map((t) => t.id);
  const projectIds = (projects ?? []).map((p) => p.id);

  // stable keys for effect deps
  const teamIdsKey = teamIds.slice().sort().join(',');
  const projectIdsKey = projectIds.slice().sort().join(',');

  // refs for realtime handlers to avoid stale closures
  const projectsRef = useRef<{ id: string; teamId: string }[] | null>(projects ?? null);
  projectsRef.current = projects ?? null;

  const mapProjectToTeam = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const m = new Map<string, string>();
    for (const p of projects ?? []) m.set(p.id, p.teamId);
    mapProjectToTeam.current = m;
  }, [projects]);

  // Initial + on ids change — batch fetch
  useEffect(() => {
    if (!teams || teams.length === 0 || !projects || projects.length === 0) {
      if (teams && teams.length > 0) {
        const zero: Record<string, number> = {};
        for (const t of teams) zero[t.id] = 0;
        setTotals(zero);
      } else {
        setTotals({});
      }
      return;
    }
    const ids = [...new Set(projectIds)];
    if (ids.length === 0) {
      const zero: Record<string, number> = {};
      for (const t of teams) zero[t.id] = 0;
      setTotals(zero);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.fetchActivityUnreadBatch(ids);
        if (cancelled) return;
        const perProjectTotal = new Map<string, number>();
        for (const pid of ids) {
          perProjectTotal.set(pid, totalFromSummary(res.summaries[pid]));
        }
        const next: Record<string, number> = {};
        for (const t of teams) next[t.id] = 0;
        for (const p of projects) {
          const tot = perProjectTotal.get(p.id) ?? 0;
          next[p.teamId] = (next[p.teamId] ?? 0) + tot;
        }
        if (!cancelled) setTotals(next);
      } catch {
        if (!cancelled) {
          // keep zeros on error, don't surface
          const zero: Record<string, number> = {};
          for (const t of teams) zero[t.id] = 0;
          setTotals(zero);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamIdsKey, projectIdsKey]);

  // Live increment via team rooms
  useEffect(() => {
    if (!teams || teams.length === 0) return;
    const wsUrl = realtimeWsUrl();
    const sockets: TeamChatSocket[] = [];
    try {
      for (const team of teams) {
        const socket = new TeamChatSocket({
          wsUrl,
          teamId: team.id,
          onActivity: (msg) => {
            if (msg.entry.action !== 'created' && msg.entry.action !== 'deleted') return;
            const pid = msg.projectId;
            const tid = mapProjectToTeam.current.get(pid);
            // if project not in our map (maybe new project not yet in state), fallback to socket's teamId
            const targetTeamId = tid ?? team.id;
            // only count if project belongs to this team socket
            if (tid && tid !== team.id) return;
            if (!tid && projectsRef.current && !projectsRef.current.some((p) => p.id === pid)) {
              // unknown project — ignore until next batch refetch, but still count for target team if it matches socket
            }
            setTotals((prev) => ({
              ...prev,
              [targetTeamId]: (prev[targetTeamId] ?? 0) + 1,
            }));
          },
        });
        sockets.push(socket);
      }
    } catch {
      // best-effort
    }
    return () => {
      for (const s of sockets) s.close();
    };
  }, [teamIdsKey]);

  // Refetch on watermark write / focus (same as useSidebarUnread)
  useEffect(() => {
    if (!teams || teams.length === 0 || !projects || projects.length === 0) return;
    const handler = () => {
      setTimeout(() => {
        void (async () => {
          try {
            const ids = [...new Set((projectsRef.current ?? []).map((p) => p.id))];
            if (ids.length === 0) return;
            const res = await api.fetchActivityUnreadBatch(ids);
            const perProjectTotal = new Map<string, number>();
            for (const pid of ids) perProjectTotal.set(pid, totalFromSummary(res.summaries[pid]));
            const next: Record<string, number> = {};
            const curTeams = teams; // closure capture
            for (const t of curTeams) next[t.id] = 0;
            for (const p of projectsRef.current ?? []) {
              const tot = perProjectTotal.get(p.id) ?? 0;
              next[p.teamId] = (next[p.teamId] ?? 0) + tot;
            }
            setTotals(next);
          } catch {
            /* ignore */
          }
        })();
      }, 300);
    };
    window.addEventListener('devhub:read-watermark', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('devhub:read-watermark', handler);
      window.removeEventListener('focus', handler);
    };
  }, [teamIdsKey, projectIdsKey, teams, projects]);

  return totals;
}
