import { useEffect, useMemo, useRef, useState, useDeferredValue, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { ProjectStats } from '../../lib/stats';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import { Archive, EnvelopeSimple } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { Tooltip } from '../../components/Tooltip';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { InlineError } from '../../components/InlineError';
import { NewProjectModal } from './NewProjectModal';
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { useOnboardingTour } from '../onboarding/useOnboardingTour';
import { hasTourStep, readTourStep } from '../onboarding/tour-events';
import { fastForwardStep } from '../onboarding/tour-dom';
import { WelcomeHeader } from './WelcomeHeader';
import { WelcomeListSkeleton } from './WelcomeListSkeleton';
import { WelcomeHeroMicro } from './WelcomeHeroMicro';
import { WelcomeCommandBar, type SortOption } from './WelcomeCommandBar';
import { WelcomeProjectRow } from './WelcomeProjectRow';
import { WelcomeGroup, WelcomeProjectList } from './WelcomeProjectList';
import { WelcomeEmptyNoTeam, WelcomeEmptyNoProject, WelcomeEmptyNoResult } from './WelcomeEmptyStrip';

export function DashboardPage() {
  const { t } = useTranslation('account');
  const { projects, loading, error, refresh } = useProjects();
  const { teams, invitations } = useTeams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const [teamCreateOpen, setTeamCreateOpen] = useState(false);
  const tour = useOnboardingTour();
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [daily, setDaily] = useState<Array<{ date: string; created: number; done: number }> | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [nextUp, setNextUp] = useState<Array<{ projectId: string; projectName: string; taskId: string; title: string; dueDate: string; priority: string; status: string }> | null>(null);
  const [nextUpLoading, setNextUpLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const listAnchorRef = useRef<HTMLDivElement>(null);

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
      return [{ teamId: 'all', teamName: teamFilter !== 'all' ? (teams?.find((tm) => tm.id === teamFilter)?.name ?? t('dashboard.welcome.group.unnamedTeam')) : t('dashboard.welcome.group.allProjects'), projects: filteredSorted }];
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
  }, [filteredSorted, isSingleTeam, teamFilter, teams, t]);

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

  const handleHeroFilter = (kind: 'all' | 'issues' | 'attention' | 'outdated') => {
    commitFilter(kind);
    requestAnimationFrame(() => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      listAnchorRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  };

  const handleOpen = (id: string) => navigate(`/project/${id}`);
  const handleOpenTask = (projectId: string, taskId: string) => navigate(`/project/${projectId}?tab=board&task=${taskId}`);

  // exclusive chain: error > loading > empty (no team / no project / no result) > data
  // teams null = still loading teams
  const teamsEmpty = teams !== null && teams.length === 0;
  const projectsEmpty = !loading && projects !== null && projects.length === 0;
  const filteredEmpty = !loading && projects !== null && projects.length > 0 && filteredSorted.length === 0;

  // Shared by manual Next, auto-advance, and resume: jump into the newest
  // project workspace and resume the tour at the Plan step.
  const advanceFromProjectStep = () => {
    if (projects === null || projects.length === 0) return false;
    const first = [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    if (!first) return false;
    tour.goTo(3);
    navigate(`/project/${first.id}?tab=board&tour=1`);
    return true;
  };

  // Tour trigger (behavioral, no time-delay): first-run empty team/project,
  // only when the user never skipped/finished the tour. Also resumes a
  // persisted tour at step 0-2 (e.g. Back from a project tab step, or
  // page reload) — steps 3+ belong to the project workspace. Resume
  // fast-forwards through gates already satisfied (stale step 1 + team). Resume
  // fast-forwards through gates already satisfied (stale step 1 + team).
  const tourCanAutoStart =
    !loading && teams !== null && projects !== null && (teamsEmpty || projectsEmpty);
  useEffect(() => {
    if (tour.active || tour.skipped || tour.finished) return;
    if (teams === null || projects === null) return;
    if (hasTourStep()) {
      const at = fastForwardStep(readTourStep(), teams.length > 0);
      if (at > 2) return;
      if (at === 2 && advanceFromProjectStep()) return;
      tour.start(at);
      return;
    }
    if (!tourCanAutoStart) return;
    tour.start(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourCanAutoStart, loading]);

  const handleTourNext = () => {
    // From the Create-project spotlight, continue inside the workspace
    // when a project already exists (auto ?tab=board&tour=1).
    if (tour.step === 2 && advanceFromProjectStep()) return;
    tour.next();
  };

  // Auto-detect creation while the tour waits on it: team 0→≥1 at step 1
  // advances, project 0→≥1 at step 2 jumps into the workspace. Skip stays
  // free, and replay users who already have data never false-trigger
  // (refs init to null and ignore the loading pass).
  const prevTeamCount = useRef<number | null>(null);
  const prevProjectCount = useRef<number | null>(null);
  useEffect(() => {
    if (teams === null) return;
    const n = teams.length;
    const prev = prevTeamCount.current;
    prevTeamCount.current = n;
    if (prev !== null && prev === 0 && n > 0 && tour.active && tour.step === 1) {
      tour.next();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, tour.active, tour.step]);
  useEffect(() => {
    if (projects === null) return;
    const n = projects.length;
    const prev = prevProjectCount.current;
    prevProjectCount.current = n;
    if (prev !== null && prev === 0 && n > 0 && tour.active && tour.step === 2) {
      advanceFromProjectStep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, tour.active, tour.step]);

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
            {t('dashboard.welcome.invites', { count: invitations.length })}
          </span>
          <Link to="/invites" className="welcome-invites-banner-cta">
            {t('dashboard.welcome.invites.cta')}
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
          onFilter={handleHeroFilter}
        />
      )}

      {/* task activity — 7 day real from /stats/daily */}
      {projects && projects.length > 0 && (
        <div className="task-activity" aria-label={t('dashboard.welcome.activity.aria')}>
          <div className="task-activity-head">
            <h2 className="task-activity-title">{t('dashboard.welcome.activity.title')}</h2>
            {dailyLoading && <span className="task-activity-loading" aria-hidden="true">…</span>}
          </div>
          <div className="task-activity-bars" role="list" aria-label={t('dashboard.welcome.activity.barsAria')}>
            {(daily ?? []).map((d) => {
              const dateObj = new Date(d.date + 'T00:00:00.000Z');
              const day = dateObj.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
              const fullDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              });
              const max = Math.max(1, ...((daily ?? []).map((x) => Math.max(x.created, x.done))));
              const barH = (v: number) => (v <= 0 ? 6 : Math.round(20 + (v / max) * 52));
              const isEmpty = d.created === 0 && d.done === 0;
              return (
                <Tooltip
                  key={d.date}
                  side="top"
                  tone="dark"
                  title={fullDate}
                  description={
                      <span className="task-activity-tip-rows">
                        <span className="task-activity-tip-row">
                          <span className="task-activity-tip-dot task-activity-tip-dot-created" aria-hidden="true" />
                          {t('dashboard.welcome.activity.created', { count: d.created })}
                        </span>
                        <span className="task-activity-tip-row">
                          <span className="task-activity-tip-dot task-activity-tip-dot-done" aria-hidden="true" />
                          {t('dashboard.welcome.activity.done', { count: d.done })}
                        </span>
                      </span>
                  }
                >
                  <div
                    className="task-activity-bar"
                    role="listitem"
                    tabIndex={0}
                    aria-label={t('dashboard.welcome.activity.itemAria', { date: fullDate, created: d.created, done: d.done })}
                  >
                    <div className="task-activity-values" aria-hidden="true">
                      {isEmpty ? (
                        <span className="task-activity-value-empty">{t('dashboard.welcome.activity.zero')}</span>
                      ) : (
                        <>
                          <span className="task-activity-value-wrap">
                            <span className="task-activity-value task-activity-value-created">{d.created}</span>
                            <span className="task-activity-value-key">{t('dashboard.welcome.activity.createdKey')}</span>
                          </span>
                          <span className="task-activity-value-wrap">
                            <span className="task-activity-value task-activity-value-done">{d.done}</span>
                            <span className="task-activity-value-key">{t('dashboard.welcome.activity.doneKey')}</span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="task-activity-track">
                      {isEmpty ? (
                        <div className="task-activity-col-empty" aria-hidden="true" />
                      ) : (
                        <>
                          <div
                            className="task-activity-col task-activity-col-created"
                            style={{ height: barH(d.created) }}
                            aria-hidden="true"
                          />
                          <div
                            className="task-activity-col task-activity-col-done"
                            style={{ height: barH(d.done) }}
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </div>
                    <span className="task-activity-day">{day}</span>
                  </div>
                </Tooltip>
              );
            })}
            {daily && daily.length === 0 && <span className="task-activity-empty">{t('dashboard.welcome.activity.empty')}</span>}
            {!daily && !dailyLoading && <span className="task-activity-empty">{t('dashboard.welcome.activity.noData')}</span>}
          </div>
        </div>
      )}

      {/* anchor daftar proyek — target auto-scroll saat kartu stat diklik */}
      <div ref={listAnchorRef} className="welcome-list-anchor">
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
        <div className="archive-filter" role="tablist" aria-label={t('dashboard.welcome.filter.aria')}>
          {(['active', 'all', 'archived'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={showMode === v}
              className={showMode === v ? 'archive-filter-btn archive-filter-btn-active' : 'archive-filter-btn'}
              onClick={() => commitStatus(v)}
            >
              {v === 'active' ? t('dashboard.welcome.filter.active', { count: archiveCounts.active }) : v === 'all' ? t('dashboard.welcome.filter.all', { count: archiveCounts.all }) : t('dashboard.welcome.filter.archived', { count: archiveCounts.archived })}
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
            {t('dashboard.welcome.status.retry')}
          </Button>
        </div>
      ) : loading ? (
        <div className="welcome-skeleton" role="status" aria-busy="true" aria-live="polite" aria-label={t('dashboard.welcome.status.loading')}>
          <span className="sr-only">{t('dashboard.welcome.status.loadingText')}</span>
          <WelcomeListSkeleton />
        </div>
      ) : teamsEmpty ? (
        <WelcomeEmptyNoTeam onCreateTeam={() => setTeamCreateOpen(true)} />
      ) : projectsEmpty ? (
        <WelcomeEmptyNoProject teamName={teams?.[0]?.name} onCreate={() => setNewOpen(true)} />
      ) : filteredEmpty && showMode === 'archived' && !deferredQuery.trim() ? (
        <EmptyState
          icon={<Archive size={22} weight="duotone" aria-hidden="true" />}
          title={t('dashboard.welcome.empty.archivedTitle')}
          description={t('dashboard.welcome.empty.archivedDesc')}
        />
      ) : filteredEmpty ? (
        <WelcomeEmptyNoResult query={deferredQuery.trim()} onClear={() => commitQuery('')} />
      ) : (
        <div className="welcome-content">
          {/* next up — 3 tasks due <= today assigned to you */}
          <div className="welcome-queue" role="list" aria-label={t('dashboard.welcome.queue.aria')}>
            <div className="welcome-queue-head">
              <h2 style={{ font: 'inherit', margin: 0 }}>{t('dashboard.welcome.queue.title')}</h2>
              <span className="welcome-queue-sub">{nextUp && nextUp.length > 0 ? t('dashboard.welcome.queue.subOverdue', { count: nextUp.length }) : t('dashboard.welcome.queue.sub')}</span>
            </div>
            {nextUpLoading ? (
              <div className="welcome-queue-loading" role="status" aria-busy="true" aria-label={t('dashboard.welcome.queue.loadingAria')}>
                <span className="sr-only">{t('dashboard.welcome.queue.loadingText')}</span>
                <div aria-hidden="true">
                  <Skeleton style={{ width: '100%', height: 56, borderRadius: 12 }} />
                </div>
              </div>
            ) : nextUp && nextUp.length > 0 ? (
              nextUp.map((item, idx) => (
                <button
                  key={item.taskId}
                  type="button"
                  className="welcome-queue-card"
                  role="listitem"
                  onClick={() => handleOpenTask(item.projectId, item.taskId)}
                  aria-label={t('dashboard.welcome.queue.openTaskAria', { title: item.title, project: item.projectName, due: item.dueDate.slice(0, 10) })}
                  title={`${item.projectName} · ${item.title}`}
                >
                  <span className="welcome-queue-num">{idx + 1}</span>
                  <span className="welcome-queue-main">
                    <span className="welcome-queue-title" title={item.title}>
                      {item.title}
                    </span>
                    <span className="welcome-queue-project">
                      {item.projectName} · {item.priority} · due {item.dueDate.slice(0, 10)}
                    </span>
                  </span>
                  <span className="welcome-queue-cta">{t('dashboard.welcome.queue.open')}</span>
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
                  aria-label={t('dashboard.welcome.queue.openProjectAria', { name: p.name })}
                >
                  <span className="welcome-queue-num">1</span>
                  <span className="welcome-queue-main">
                    <span className="welcome-queue-title">{t('dashboard.welcome.queue.openTitle')}</span>
                    <span className="welcome-queue-project">{p.name} · {t('dashboard.welcome.queue.continueWork')}</span>
                  </span>
                  <span className="welcome-queue-cta">{t('dashboard.welcome.queue.open')}</span>
                </button>
              ))
            )}
            {!nextUpLoading && nextUp && nextUp.length === 0 && filteredSorted.length === 0 && (
              <p className="welcome-queue-empty">{t('dashboard.welcome.queue.empty')}</p>
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

          <footer className="welcome-footer" aria-label={t('dashboard.welcome.footer.quickActions')}>
            <span className="welcome-footer-muted">{t('dashboard.welcome.footer.quickActions')}</span>
            <span className="welcome-footer-actions">
              <Button variant="ghost" size="sm" onClick={() => setTeamCreateOpen(true)}>
                {t('dashboard.welcome.footer.createTeam')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
                {t('dashboard.welcome.footer.browseTemplates')}
              </Button>
              <span className="welcome-footer-hint" aria-hidden="true">
                {t('dashboard.welcome.footer.press')} <kbd className="welcome-kbd welcome-kbd-sm">⌘</kbd>
                <kbd className="welcome-kbd welcome-kbd-sm">K</kbd> {t('dashboard.welcome.footer.toJump')}
              </span>
            </span>
          </footer>
        </div>
      )}
      </div>

      <NewProjectModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        initialTeamId={teamFilter !== 'all' ? teamFilter : null}
      />
      <CreateTeamModal open={teamCreateOpen} onClose={() => setTeamCreateOpen(false)} />
      {tour.active && (
        <OnboardingWizard
          step={tour.step}
          total={tour.total}
          onNext={handleTourNext}
          onBack={tour.back}
          onSkip={tour.skip}
          onFinish={tour.finish}
          blockReason={tour.step === 1 && teamsEmpty ? 'team' : tour.step === 2 && projectsEmpty ? 'project' : null}
        />
      )}
    </div>
  );
}
