import { useEffect, useMemo, useState, useDeferredValue, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import type { ProjectStats } from '../../lib/stats';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import { Archive, EnvelopeSimple } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
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
  const { teams, invitations } = useTeams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const [teamCreateOpen, setTeamCreateOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [daily, setDaily] = useState<Array<{ date: string; created: number; done: number }> | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [nextUp, setNextUp] = useState<Array<{ projectId: string; projectName: string; taskId: string; title: string; dueDate: string; priority: string; status: string }> | null>(null);
  const [nextUpLoading, setNextUpLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // URL state: ?q & ?sort & ?team & ?status & ?filter (+ ?new legacy)
  const queryParam = searchParams.get('q') ?? '';
  const sortParam = (searchParams.get('sort') as SortOption | null) ?? 'updated';
  const teamParam = searchParams.get('team') ?? 'all';
  const statusParam = searchParams.get('status') as 'archived' | 'all' | null;
  const filterParam = searchParams.get('filter') as 'all' | 'issues' | 'attention' | 'outdated' | null;
  const activeFilter: 'all' | 'issues' | 'attention' | 'outdated' | null =
    filterParam === 'issues' || filterParam === 'attention' || filterParam === 'outdated' || filterParam === 'all' ? filterParam : null;
  const showMode: 'active' | 'archived' | 'all' = statusParam === 'archived' ? 'archived' : statusParam === 'all' ? 'all' : 'active';

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

  // daily activity fetch (decorative but real)
  useEffect(() => {
    if (!projects || projects.length === 0) {
      setDaily([]);
      return;
    }
    let cancelled = false;
    setDailyLoading(true);
    api
      .projectDailyStats(7)
      .then((days) => {
        if (cancelled) return;
        setDaily(days);
      })
      .catch(() => {
        if (!cancelled) setDaily([]);
      })
      .finally(() => {
        if (!cancelled) setDailyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  // next up fetch (3 tasks due <= today assigned to you)
  useEffect(() => {
    if (!projects || projects.length === 0 || !user) {
      setNextUp([]);
      return;
    }
    let cancelled = false;
    setNextUpLoading(true);
    api
      .projectNextUp(3)
      .then((tasks) => {
        if (cancelled) return;
        setNextUp(tasks);
      })
      .catch(() => {
        if (!cancelled) setNextUp([]);
      })
      .finally(() => {
        if (!cancelled) setNextUpLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projects, user]);

  const archiveCounts = useMemo(() => {
    if (!projects) return { active: 0, archived: 0, all: 0 };
    let active = 0;
    let archived = 0;
    for (const p of projects) {
      if (p.status === 'archived') archived += 1;
      else active += 1;
    }
    return { active, archived, all: projects.length };
  }, [projects]);

  const displayName = user?.displayName?.trim() ? user.displayName : (user?.email?.split('@')[0] ?? 'there');



  // derived global hero stats
  const heroStats = useMemo(() => {
    if (!projects || projects.length === 0)
      return { total: 0, needsAttention: 0, done: 0, totalTasks: 0, openIssues: 0, overdue: 0, outdated: 0 };
    let done = 0;
    let totalTasks = 0;
    let openIssues = 0;
    let overdue = 0;
    let outdated = 0;
    let needsAttention = 0;
    for (const p of projects) {
      const st = stats[p.id];
      if (st) {
        done += st.doneTasks;
        totalTasks += st.totalTasks;
        openIssues += st.openIssues;
        outdated += st.outdatedDeps;
        overdue += st.overdueTasks ?? 0;
        if (st.openIssues > 0 || st.outdatedDeps > 0 || (st.overdueTasks ?? 0) > 0) needsAttention += 1;
      }
    }
    return { total: projects.length, needsAttention, done, totalTasks, openIssues, overdue, outdated };
  }, [projects, stats]);

  // filter + sort
  const filteredSorted = useMemo(() => {
    if (!projects) return [];
    const q = deferredQuery.trim().toLowerCase();
    let list = projects;
    // status filter
    if (showMode === 'active') list = list.filter((p) => p.status === 'active');
    else if (showMode === 'archived') list = list.filter((p) => p.status === 'archived');
    // team filter
    if (teamFilter !== 'all') {
      list = list.filter((p) => p.teamId === teamFilter);
    }
    // bento attention filter (?filter=)
    if (activeFilter === 'issues') {
      list = list.filter((p) => (stats[p.id]?.openIssues ?? 0) > 0);
    } else if (activeFilter === 'attention') {
      list = list.filter((p) => (stats[p.id]?.overdueTasks ?? 0) > 0);
    } else if (activeFilter === 'outdated') {
      list = list.filter((p) => (stats[p.id]?.outdatedDeps ?? 0) > 0);
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
  }, [projects, deferredQuery, teamFilter, sort, stats, showMode, activeFilter]);

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

  const commitStatus = (v: 'active' | 'archived' | 'all') => {
    startTransition(() => {
      const next = new URLSearchParams(searchParams);
      if (v === 'active') next.delete('status');
      else next.set('status', v);
      setSearchParams(next, { replace: true });
    });
  };

  const commitFilter = (kind: 'all' | 'issues' | 'attention' | 'outdated') => {
    startTransition(() => {
      const next = new URLSearchParams(searchParams);
      if (kind === 'all') next.delete('filter');
      else next.set('filter', kind);
      // also adjust sort to make filter meaningful
      if (kind === 'issues') next.set('sort', 'issues');
      else if (kind === 'attention') next.set('sort', 'issues');
      else if (kind === 'outdated') next.set('sort', 'progress');
      else next.delete('sort');
      setSearchParams(next, { replace: true });
    });
  };

  const handleOpen = (id: string) => navigate(`/project/${id}`);
  const handleOpenTask = (projectId: string, taskId: string) => navigate(`/project/${projectId}?tab=board&task=${taskId}`);

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

      {invitations.length > 0 && (
        <div className="welcome-invites-banner" role="status" aria-live="polite">
          <span className="welcome-invites-banner-icon" aria-hidden="true">
            <EnvelopeSimple size={16} weight="duotone" />
          </span>
          <span className="welcome-invites-banner-text">
            {invitations.length === 1
              ? '1 undangan tim menunggu keputusan Anda'
              : `${invitations.length} undangan tim menunggu keputusan Anda`}
          </span>
          <Link to="/invites" className="welcome-invites-banner-cta">
            Lihat undangan →
          </Link>
        </div>
      )}

      {/* bento 4 stats — boxless, hijau primary, icon 22px — Image 1 */}
      {projects && projects.length > 0 && (
        <WelcomeHeroMicro
          total={heroStats.total}
          needsAttention={heroStats.needsAttention}
          done={heroStats.done}
          totalTasks={heroStats.totalTasks}
          openIssues={heroStats.openIssues}
          overdue={heroStats.overdue}
          outdated={heroStats.outdated}
          activeFilter={activeFilter ?? undefined}
          onFilter={(kind) => commitFilter(kind)}
        />
      )}

      {/* task activity — 7 day real from /stats/daily */}
      {projects && projects.length > 0 && (
        <div className="task-activity" aria-label="Tasks activity">
          <div className="task-activity-head">
            <span className="task-activity-title">Tasks Activity — last 7 days</span>
            {dailyLoading && <span className="task-activity-loading" aria-hidden="true">…</span>}
          </div>
          <div className="task-activity-bars" role="list" aria-label="Tasks created vs done last 7 days">
            {(daily ?? []).map((d) => {
              const dateObj = new Date(d.date + 'T00:00:00.000Z');
              const day = dateObj.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
              const max = Math.max(1, ...((daily ?? []).map((x) => Math.max(x.created, x.done, 1))));
              const hDone = (d.done / max) * 56 + 8;
              const hCreated = (d.created / max) * 48 + 8;
              const isEmpty = d.created === 0 && d.done === 0;
              return (
                <div
                  key={d.date}
                  className="task-activity-bar"
                  role="listitem"
                  aria-label={`${d.date}: ${d.created} created, ${d.done} done`}
                  title={`${d.date}: ${d.created} created · ${d.done} done`}
                >
                  <div className="task-activity-values" aria-hidden="true">
                    <span className="task-activity-value task-activity-value-created">{d.created > 0 ? d.created : ''}</span>
                    <span className="task-activity-value task-activity-value-done">{d.done > 0 ? d.done : ''}</span>
                  </div>
                  <div className="task-activity-track">
                    <div
                      className="task-activity-col task-activity-col-created"
                      style={{ height: isEmpty ? 4 : hCreated, opacity: isEmpty ? 0.2 : 1 }}
                      aria-hidden="true"
                    />
                    <div
                      className="task-activity-col task-activity-col-done"
                      style={{ height: isEmpty ? 4 : hDone, opacity: isEmpty ? 0.2 : 1 }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="task-activity-day">{day}</span>
                </div>
              );
            })}
            {daily && daily.length === 0 && <span className="task-activity-empty">No activity yet</span>}
            {!daily && !dailyLoading && <span className="task-activity-empty">No data</span>}
          </div>
        </div>
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
      {projects && projects.length > 0 && (
        <div className="archive-filter" role="tablist" aria-label="Filter by status">
          {(['active', 'all', 'archived'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={showMode === v}
              className={showMode === v ? 'archive-filter-btn archive-filter-btn-active' : 'archive-filter-btn'}
              onClick={() => commitStatus(v)}
            >
              {v === 'active' ? `Active (${archiveCounts.active})` : v === 'all' ? `All (${archiveCounts.all})` : `Archived (${archiveCounts.archived})`}
            </button>
          ))}
        </div>
      )}
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
        <div className="welcome-skeleton" role="status" aria-busy="true" aria-live="polite" aria-label="Loading projects">
          <span className="sr-only">Loading projects…</span>
          <div aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="welcome-row-skeleton" style={{ height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px' }}>
                <Skeleton style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0 }} />
                <Skeleton style={{ width: 140, height: 14, flexShrink: 0 }} />
                <Skeleton style={{ width: 80, height: 11, flexShrink: 0, opacity: 0.85 }} />
                <Skeleton style={{ width: 40, height: 4, borderRadius: 999, flexShrink: 0 }} />
                <Skeleton style={{ width: 24, height: 16, borderRadius: 999, flexShrink: 0, opacity: 0.7 }} />
                <Skeleton style={{ width: 56, height: 11, flexShrink: 0, opacity: 0.7 }} />
                <span style={{ display: 'flex', gap: 3, marginLeft: 'auto', flexShrink: 0 }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Skeleton key={j} style={{ width: 4, height: 6 + (j % 3) * 2, borderRadius: 2 }} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : teamsEmpty ? (
        <WelcomeEmptyNoTeam onCreateTeam={() => setTeamCreateOpen(true)} />
      ) : projectsEmpty ? (
        <WelcomeEmptyNoProject teamName={teams?.[0]?.name} onCreate={() => setNewOpen(true)} />
      ) : filteredEmpty && showMode === 'archived' && !deferredQuery.trim() ? (
        <EmptyState
          icon={<Archive size={22} weight="duotone" aria-hidden="true" />}
          title="No archived projects"
          description="Archived projects are read-only and hidden from Active view."
        />
      ) : filteredEmpty ? (
        <WelcomeEmptyNoResult query={deferredQuery.trim()} onClear={() => commitQuery('')} />
      ) : (
        <div className="welcome-content">
          {/* next up — 3 tasks due <= today assigned to you */}
          <div className="welcome-queue" role="list" aria-label="Next actions">
            <div className="welcome-queue-head">
              <span>Next up — what to do today</span>
              <span className="welcome-queue-sub">assignee: you · due ≤ today{nextUp && nextUp.length > 0 ? ` · ${nextUp.length} overdue` : ''}</span>
            </div>
            {nextUpLoading ? (
              <div className="welcome-queue-loading" role="status" aria-busy="true" aria-label="Loading next actions">
                <span className="sr-only">Loading next actions…</span>
                <div aria-hidden="true">
                  <Skeleton style={{ width: '100%', height: 56, borderRadius: 12 }} />
                </div>
              </div>
            ) : nextUp && nextUp.length > 0 ? (
              nextUp.map((t, idx) => (
                <button
                  key={t.taskId}
                  type="button"
                  className="welcome-queue-card"
                  role="listitem"
                  onClick={() => handleOpenTask(t.projectId, t.taskId)}
                  aria-label={`Open task ${t.title} in ${t.projectName}, due ${t.dueDate}`}
                  title={`${t.projectName} · ${t.title}`}
                >
                  <span className="welcome-queue-num">{idx + 1}</span>
                  <span className="welcome-queue-main">
                    <span className="welcome-queue-title" title={t.title}>
                      {t.title}
                    </span>
                    <span className="welcome-queue-project">
                      {t.projectName} · {t.priority} · due {t.dueDate.slice(0, 10)}
                    </span>
                  </span>
                  <span className="welcome-queue-cta">Open →</span>
                </button>
              ))
            ) : (
              filteredSorted.slice(0, 1).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="welcome-queue-card"
                  role="listitem"
                  onClick={() => handleOpen(p.id)}
                  aria-label={`Open ${p.name}`}
                >
                  <span className="welcome-queue-num">1</span>
                  <span className="welcome-queue-main">
                    <span className="welcome-queue-title">Open project</span>
                    <span className="welcome-queue-project">{p.name} · Continue work</span>
                  </span>
                  <span className="welcome-queue-cta">Open →</span>
                </button>
              ))
            )}
            {!nextUpLoading && nextUp && nextUp.length === 0 && filteredSorted.length === 0 && (
              <p className="welcome-queue-empty">Nothing due today — all clear.</p>
            )}
          </div>
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
