import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import type { ActivityUnreadSummary } from '../lib/types';
import { TeamChatSocket, realtimeWsUrl } from '../lib/realtime-client';
import { useTeams } from './teams-context';
import { useProjects } from './projects-context';

export interface SidebarBadge {
  new: number;
  deleted: number;
  total: number;
}

const EMPTY_BADGE: SidebarBadge = { new: 0, deleted: 0, total: 0 };

function badgeFromSummary(summary: ActivityUnreadSummary | undefined): SidebarBadge {
  if (!summary) return EMPTY_BADGE;
  const counts = (summary.counts ?? {}) as Record<string, unknown>;
  let totalNew = 0;
  let totalDeleted = 0;
  for (const val of Object.values(counts)) {
    if (typeof val === 'number') totalNew += val as number;
    else if (val && typeof val === 'object') {
      const v = val as { new?: number; deleted?: number };
      totalNew += v.new ?? 0;
      totalDeleted += v.deleted ?? 0;
    }
  }
  return { new: totalNew, deleted: totalDeleted, total: totalNew + totalDeleted };
}

interface ContextValue {
  badgesByProject: Record<string, SidebarBadge>;
  totalsByTeam: Record<string, number>;
  getBadge: (projectId: string) => SidebarBadge;
  getTeamTotal: (teamId: string) => number;
}

const ActivityUnreadContext = createContext<ContextValue>({
  badgesByProject: {},
  totalsByTeam: {},
  getBadge: () => EMPTY_BADGE,
  getTeamTotal: () => 0,
});

export function ActivityUnreadProvider({ children }: { children: ReactNode }) {
  const { teams } = useTeams();
  const { projects } = useProjects();
  const [summaries, setSummaries] = useState<Record<string, ActivityUnreadSummary>>({});

  const projectIds = useMemo(() => (projects ?? []).map((p) => p.id), [projects]);
  const teamIds = useMemo(() => (teams ?? []).map((t) => t.id), [teams]);
  const idsKey = useMemo(() => [...new Set(projectIds)].sort().join(','), [projectIds]);
  const teamIdsKey = useMemo(() => [...new Set(teamIds)].sort().join(','), [teamIds]);

  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  const mapProjectToTeam = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const m = new Map<string, string>();
    for (const p of projects ?? []) m.set(p.id, p.teamId);
    mapProjectToTeam.current = m;
  }, [projects]);

  // Single batch fetch for all projects (shared)
  useEffect(() => {
    if (!teams || teams.length === 0 || !projects || projects.length === 0) {
      setSummaries({});
      return;
    }
    const ids = [...new Set(projectIds)];
    if (ids.length === 0) {
      setSummaries({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.fetchActivityUnreadBatch(ids);
        if (cancelled) return;
        setSummaries(res.summaries ?? {});
      } catch {
        if (!cancelled) setSummaries({});
      }
    })();
    return () => { cancelled = true; };
  }, [idsKey, projects, teams]);

  // Derived badges
  const badgesByProject = useMemo(() => {
    const next: Record<string, SidebarBadge> = {};
    for (const pid of projectIds) {
      next[pid] = badgeFromSummary(summaries[pid]);
    }
    return next;
  }, [summaries, projectIds]);

  const totalsByTeam = useMemo(() => {
    const next: Record<string, number> = {};
    for (const t of teams ?? []) next[t.id] = 0;
    for (const p of projects ?? []) {
      const b = badgesByProject[p.id] ?? EMPTY_BADGE;
      next[p.teamId] = (next[p.teamId] ?? 0) + b.total;
    }
    return next;
  }, [badgesByProject, teams, projects]);

  const getBadge = useCallback((pid: string) => badgesByProject[pid] ?? EMPTY_BADGE, [badgesByProject]);
  const getTeamTotal = useCallback((tid: string) => totalsByTeam[tid] ?? 0, [totalsByTeam]);

  // Live increment via WS per team (single set of sockets for both consumers)
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
            if (tid && tid !== team.id) return;
            // Increment summaries map immutably for minimal rerender (only that pid changes)
            setSummaries((prev) => {
              const cur = prev[pid];
              const curBadge = badgeFromSummary(cur);
              const isNew = msg.entry.action === 'created';
              const nextBadge: ActivityUnreadSummary = {
                ...(cur ?? { counts: {} as Record<string, unknown> }),
                // preserve counts shape but increment total via synthetic counts
                counts: {
                  ...((cur as { counts?: Record<string, unknown> } | undefined)?.counts ?? {}),
                  _live: isNew ? { new: curBadge.new + 1, deleted: curBadge.deleted, total: curBadge.total + 1 } : { new: curBadge.new, deleted: curBadge.deleted + 1, total: curBadge.total + 1 },
                } as unknown as Record<string, unknown>,
                // keep ids fallback
              } as ActivityUnreadSummary;
              // Instead of mutating counts shape, we store a synthetic live entry — badgeFromSummary will sum it.
              // Simpler: just increment a synthetic live badge via separate live map? For now, directly bump summaries via badge logic:
              // We store a live summary with counts._live
              return { ...prev, [pid]: nextBadge };
            });
          },
        });
        sockets.push(socket);
      }
    } catch {}
    return () => { for (const s of sockets) s.close(); };
  }, [teamIdsKey]);

  // Refetch on watermark / focus (shared, single listener)
  useEffect(() => {
    if (!teams || teams.length === 0 || !projects || projects.length === 0) return;
    const handler = () => {
      setTimeout(() => {
        void (async () => {
          try {
            const ids = [...new Set((projectsRef.current ?? []).map((p) => p.id))];
            if (ids.length === 0) return;
            const res = await api.fetchActivityUnreadBatch(ids);
            setSummaries(res.summaries ?? {});
          } catch {}
        })();
      }, 300);
    };
    window.addEventListener('devhub:read-watermark', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('devhub:read-watermark', handler);
      window.removeEventListener('focus', handler);
    };
  }, [teamIdsKey, idsKey]);

  const value = useMemo<ContextValue>(() => ({
    badgesByProject,
    totalsByTeam,
    getBadge,
    getTeamTotal,
  }), [badgesByProject, totalsByTeam, getBadge, getTeamTotal]);

  return <ActivityUnreadContext.Provider value={value}>{children}</ActivityUnreadContext.Provider>;
}

export function useActivityUnread() {
  return useContext(ActivityUnreadContext);
}

export function useSidebarUnreadShared(activeTeamId: string | null | undefined, projectIds: string[]): Record<string, SidebarBadge> {
  const { badgesByProject } = useActivityUnread();
  return useMemo(() => {
    if (!activeTeamId) return {};
    const next: Record<string, SidebarBadge> = {};
    for (const pid of projectIds) next[pid] = badgesByProject[pid] ?? EMPTY_BADGE;
    return next;
  }, [activeTeamId, projectIds, badgesByProject]);
}

export function useTeamUnreadShared(_teams: { id: string }[] | null | undefined): Record<string, number> {
  const { totalsByTeam } = useActivityUnread();
  return totalsByTeam;
}
