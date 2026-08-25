import { useEffect, useMemo, useState, useDeferredValue, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import type { ProjectStats } from '../../lib/stats';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { InlineError } from '../../components/InlineError';
import { NewProjectModal } from './NewProjectModal';
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { WelcomeHeader } from './WelcomeHeader';
import { WelcomeHeroMicro } from './WelcomeHeroMicro';
import { WelcomeCommandBar, type SortOption } from './WelcomeCommandBar';
import { WelcomeProjectRow } from './WelcomeProjectRow';
import { WelcomeGroup, WelcomeProjectList } from './WelcomeProjectList';
import { WelcomeEmptyNoTeam, WelcomeEmptyNoProject, WelcomeEmptyNoResult } from './WelcomeEmptyStrip';

export function DashboardPage() {
  const { projects, loading, error, refresh } = useProjects();
  const { teams } = useTeams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const [teamCreateOpen, setTeamCreateOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // URL state: ?q & ?sort & ?team (+ ?new legacy)
  const queryParam = searchParams.get('q') ?? '';
  const sortParam = (searchParams.get('sort') as SortOption | null) ?? 'updated';
  const teamParam = searchParams.get('team') ?? 'all';

  const [queryDraft, setQueryDraft] = useState(queryParam);
  const deferredQuery = useDeferredValue(queryDraft);

  // keep draft in sync when URL changes via back/forward
  useEffect(() => {
    setQueryDraft(queryParam);
  }, [queryParam]);

  const sort: SortOption = ['updated', 'name', 'issues', 'progress'].includes(sortParam) ? (sortParam as SortOption) : 'updated';
  const teamFilter = teamParam;

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setNewOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // stats fetch parallel (decorative)
  useEffect(() => {
    if (!projects) return;
    let cancelled = false;
    setStatsLoading(true);
    api
      .projectStats()
      .then((entries) => {
        if (cancelled) return;
        const current: Record<string, ProjectStats> = {};
        entries.forEach((e) => {
          const { projectId, ...rest } = e;
          current[projectId] = rest;
        });
        setStats(current);
      })
      .catch(() => {
        /* stats are decorative */
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  const displayName = user?.displayName?.trim() ? user.displayName : (user?.email?.split('@')[0] ?? 'there');

  // derived global hero stats
  const heroStats = useMemo(() => {
    if (!projects || projects.length === 0) return { total: 0, needsAttention: 0, done: 0, totalTasks: 0, openIssues: 0, outdated: 0 };
    let done = 0;
    let totalTasks = 0;
    let openIssues = 0;
    let outdated = 0;
    let needsAttention = 0;
    for (const p of projects) {
      const st = stats[p.id];
      if (st) {
        done += st.doneTasks;
        totalTasks += st.totalTasks;
        openIssues += st.openIssues;
        outdated += st.outdatedDeps;
        if (st.openIssues > 0 || st.outdatedDeps > 0) needsAttention += 1;
      }
    }
    return { total: projects.length, needsAttention, done, totalTasks, openIssues, outdated };
  }, [projects, stats]);

  // filter + sort
  const filteredSorted = useMemo(() => {
    if (!projects) return [];
    const q = deferredQuery.trim().toLowerCase();
    let list = projects;
    // team filter
    if (teamFilter !== 'all') {
      list = list.filter((p) => p.teamId === teamFilter);
    }
    // query filter (name + description + teamName)
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q),
      );
    }
    // sort (toSorted immutable)
    const withStats = list.map((p) => ({ p, st: stats[p.id] ?? null }));
    const sorted = withStats.toSorted((a, b) => {
      if (sort === 'name') return a.p.name.localeCompare(b.p.name);
      if (sort === 'issues') return (b.st?.openIssues ?? 0) - (a.st?.openIssues ?? 0);
      if (sort === 'progress') {
        const aPct = a.st && a.st.totalTasks > 0 ? a.st.doneTasks / a.st.totalTasks : 0;
        const bPct = b.st && b.st.totalTasks > 0 ? b.st.doneTasks / b.st.totalTasks : 0;
        return aPct - bPct;
      }
      // updated desc default
      return Date.parse(b.p.updatedAt) - Date.parse(a.p.updatedAt);
    });
    return sorted.map((x) => x.p);
  }, [projects, deferredQuery, teamFilter, sort, stats]);

  // grouping adaptive
  const isSingleTeam = (teams?.length ?? 0) <= 1;
  const groups = useMemo(() => {
    if (isSingleTeam || teamFilter !== 'all') {
      return [{ teamId: 'all', teamName: teamFilter !== 'all' ? (teams?.find((tm) => tm.id === teamFilter)?.name ?? 'Team') : 'All projects', projects: filteredSorted }];
    }
    const map = new Map<string, { teamName: string; projects: typeof filteredSorted }>();
    for (const p of filteredSorted) {
      const entry = map.get(p.teamId);
      if (entry) entry.projects.push(p);
      else map.set(p.teamId, { teamName: p.teamName, projects: [p] });
    }
    return Array.from(map.entries())
      .map(([teamId, v]) => ({ teamId, teamName: v.teamName, projects: v.projects }))
      .toSorted((a, b) => a.teamName.localeCompare(b.teamName));
  }, [filteredSorted, isSingleTeam, teamFilter, teams]);

  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => new Set());
  // auto-expand logic: single team -> expanded, multi -> all expanded default, search narrows -> only teams with match stay expanded
  useEffect(() => {
    if (groups.length === 0) return;
    if (isSingleTeam) {
      setExpandedTeams(new Set(['all']));
      return;
    }
    if (deferredQuery.trim() || teamFilter !== 'all') {
      setExpandedTeams(new Set(groups.map((g) => g.teamId)));
      return;
    }
    // default all expanded for < 15 projects, collapsed would be for 15+ (keep expanded for now — less chrome)
    setExpandedTeams(new Set(groups.map((g) => g.teamId)));
  }, [groups, isSingleTeam, deferredQuery, teamFilter]);

  const toggleTeam = (id: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const commitQuery = (v: string) => {
    setQueryDraft(v);
    startTransition(() => {
      const next = new URLSearchParams(searchParams);
      if (v.trim()) next.set('q', v.trim());
      else next.delete('q');
      setSearchParams(next, { replace: true });
    });
  };

  const commitSort = (v: SortOption) => {
    startTransition(() => {
      const next = new URLSearchParams(searchParams);
      if (v === 'updated') next.delete('sort');
      else next.set('sort', v);
      setSearchParams(next, { replace: true });
    });
  };

  const commitTeam = (v: string | 'all') => {
    startTransition(() => {
      const next = new URLSearchParams(searchParams);
      if (v === 'all') next.delete('team');
      else next.set('team', v);
      setSearchParams(next, { replace: true });
    });
  };

  const handleOpen = (id: string) => navigate(`/project/${id}`);

  // exclusive chain: error > loading > empty (no team / no project / no result) > data
  // teams null = still loading teams
  const teamsEmpty = teams !== null && teams.length === 0;
  const projectsEmpty = !loading && projects !== null && projects.length === 0;
  const filteredEmpty = !loading && projects !== null && projects.length > 0 && filteredSorted.length === 0;

  // stats for group header open issues
  const groupOpenIssues = (teamProjects: typeof filteredSorted) => {
    let sum = 0;
    for (const p of teamProjects) sum += stats[p.id]?.openIssues ?? 0;
    return sum;
  };

  return (
    <div className="page welcome-page">
      <WelcomeHeader
        displayName={displayName}
        projectCount={projects?.length ?? 0}
        openIssuesTotal={heroStats.openIssues}
        outdatedTotal={heroStats.outdated}
        onNewProject={() => setNewOpen(true)}
      />

      {/* hero micro — only when has projects */}
      {projects && projects.length > 0 && (
        <WelcomeHeroMicro
          total={heroStats.total}
          needsAttention={heroStats.needsAttention}
          done={heroStats.done}
          totalTasks={heroStats.totalTasks}
        />
      )}

      {/* command bar — sticky, always visible unless error/loading skeleton takes over? Keep visible even in empty states for discoverability */}
      <WelcomeCommandBar
        query={queryDraft}
        onQuery={commitQuery}
        sort={sort}
        onSort={commitSort}
        teamFilter={teamFilter as string | 'all'}
        onTeamFilter={commitTeam}
        count={filteredSorted.length}
        teams={teams}
      />
      {isPending && <span className="welcome-pending" aria-hidden="true" />}

      {/* exclusive content */}
      {error ? (
        <div className="welcome-error-wrap">
          <InlineError>{error}</InlineError>
          <Button variant="ghost" size="sm" onClick={() => refresh()} style={{ marginTop: 8 }}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="welcome-skeleton" aria-busy="true" aria-label="Loading projects">
          <span className="sr-only">Loading projects…</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="welcome-row-skeleton">
              <Skeleton style={{ width: 6, height: 6, borderRadius: 999 }} />
              <Skeleton style={{ width: 140, height: 14 }} />
              <Skeleton style={{ width: 80, height: 11 }} />
              <Skeleton style={{ width: 40, height: 4 }} />
              <Skeleton style={{ width: 56, height: 11 }} />
            </div>
          ))}
        </div>
      ) : teamsEmpty ? (
        <WelcomeEmptyNoTeam onCreateTeam={() => setTeamCreateOpen(true)} />
      ) : projectsEmpty ? (
        <WelcomeEmptyNoProject teamName={teams?.[0]?.name} onCreate={() => setNewOpen(true)} />
      ) : filteredEmpty ? (
        <WelcomeEmptyNoResult query={deferredQuery.trim()} onClear={() => commitQuery('')} />
      ) : (
        <div className="welcome-content">
          {isSingleTeam || teamFilter !== 'all' ? (
            <WelcomeProjectList>
              {filteredSorted.map((p) => (
                <WelcomeProjectRow
                  key={p.id}
                  project={p}
                  stats={stats[p.id] ?? null}
                  statsLoading={statsLoading}
                  onOpen={handleOpen}
                />
              ))}
            </WelcomeProjectList>
          ) : (
            groups.map((g) => (
              <WelcomeGroup
                key={g.teamId}
                teamName={g.teamName}
                count={g.projects.length}
                openIssues={groupOpenIssues(g.projects)}
                expanded={expandedTeams.has(g.teamId)}
                onToggle={() => toggleTeam(g.teamId)}
              >
                {g.projects.map((p) => (
                  <WelcomeProjectRow
                    key={p.id}
                    project={p}
                    stats={stats[p.id] ?? null}
                    statsLoading={statsLoading}
                    onOpen={handleOpen}
                  />
                ))}
              </WelcomeGroup>
            ))
          )}

          <footer className="welcome-footer" aria-label="Quick actions">
            <span className="welcome-footer-muted">Quick actions</span>
            <span className="welcome-footer-actions">
              <Button variant="ghost" size="sm" onClick={() => setTeamCreateOpen(true)}>
                Create team
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
                Browse templates
              </Button>
              <span className="welcome-footer-hint" aria-hidden="true">
                Press <kbd className="welcome-kbd welcome-kbd-sm">⌘</kbd>
                <kbd className="welcome-kbd welcome-kbd-sm">K</kbd> to jump
              </span>
            </span>
          </footer>
        </div>
      )}

      <NewProjectModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        initialTeamId={teamFilter !== 'all' ? teamFilter : null}
      />
      <CreateTeamModal open={teamCreateOpen} onClose={() => setTeamCreateOpen(false)} />
    </div>
  );
}
