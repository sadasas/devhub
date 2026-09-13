import { useEffect, useMemo, useRef, useState, useDeferredValue, useTransition } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { ProjectStats } from '../../lib/stats';
import type { Team } from '../../lib/types';
import { slugifyTeamName } from '../../lib/team-slug';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import { writeLastActiveTeamId } from '../layout/WorkspaceSwitcher';
import {
  Archive,
  EnvelopeSimple,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SearchableSelect } from '../../components/SearchableSelect';
import { TEAM_ROLE } from '../../lib/labels';
import { Tooltip } from '../../components/Tooltip';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { DataErrorState } from '../../components/DataErrorState';
import { NewProjectModal } from './NewProjectModal';
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { useOnboardingTour } from '../onboarding/useOnboardingTour';
import { hasTourStep, readTourStep } from '../onboarding/tour-events';
import { fastForwardStep } from '../onboarding/tour-dom';
import { WelcomeHeroMicro } from './WelcomeHeroMicro';
import { WelcomeProjectRow } from './WelcomeProjectRow';
import { WelcomeProjectList } from './WelcomeProjectList';
import { WelcomeListSkeleton } from './WelcomeListSkeleton';
import { WelcomeEmptyNoProject, WelcomeEmptyNoResult } from './WelcomeEmptyStrip';
import { DashboardMembersTab } from './DashboardMembersTab';
import { DashboardSettingsTab } from './DashboardSettingsTab';

type SortOption = 'updated' | 'name' | 'issues' | 'progress';
export type DashboardTab = 'projects' | 'members' | 'settings';

// Pure resolver for "/" team dashboard (exported for tests).
// ?team=X valid (member) -> X; else lastActive valid -> lastActive;
// else teams[0]; else null (zero-team onboarding).
// Legacy cross-team ?team=X stays honored without redirect.
export function resolveDashboardTeamId(
  teams: Team[],
  teamParam: string | null,
  lastActiveId: string | null,
): string | null {
  if (teamParam && teams.some((tm) => tm.id === teamParam)) return teamParam;
  if (lastActiveId && teams.some((tm) => tm.id === lastActiveId)) return lastActiveId;
  return teams[0]?.id ?? null;
}

// Pure resolver for /:teamSlug/... routes (exported for tests).
// Exact slug match (case-insensitive) -> team id; else null (caller falls
// back to server by-slug for history redirects, then 404).
export function resolveDashboardTeamIdBySlug(teams: Team[], slug: string | null): string | null {
  if (!slug) return null;
  const lower = slug.toLowerCase();
  return teams.find((tm) => (tm.slug || slugifyTeamName(tm.name)).toLowerCase() === lower)?.id ?? null;
}

function parseSlugTab(pathname: string): DashboardTab {
  if (pathname.endsWith('/members')) return 'members';
  if (pathname.endsWith('/settings')) return 'settings';
  return 'projects';
}

// Workspace panels (projects/members/settings) render directly from the
// route suffix via parseSlugTab — no tab bar. Deep-links to
// /:slug/members and /:slug/settings keep working; viewers hitting
// settings still get the no-access empty state from DashboardSettingsTab.

// Search + sort command bar scoped to the active team (no team selector).
function DashboardCommandBar({
  query,
  onQuery,
  sort,
  onSort,
  count,
}: {
  query: string;
  onQuery: (v: string) => void;
  sort: SortOption;
  onSort: (v: SortOption) => void;
  count: number;
}) {
  const { t } = useTranslation('account');
  return (
    <div className="welcome-command-bar" role="search" aria-label={t('dashboard.welcome.search.filterAria')}>
      <div className="welcome-search">
        <MagnifyingGlass size={14} aria-hidden="true" className="welcome-search-icon" />
        <input
          type="text"
          className="welcome-search-input"
          placeholder={t('dashboard.welcome.search.placeholder')}
          aria-label={t('dashboard.welcome.search.aria')}
          value={query}
          maxLength={200}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="welcome-search-clear"
            aria-label={t('dashboard.welcome.search.clearAria')}
            onClick={() => onQuery('')}
          >
            <X size={12} weight="bold" aria-hidden="true" />
          </button>
        )}
        <span className="welcome-search-hint" aria-hidden="true">
          <kbd className="welcome-kbd">⌘</kbd>
          <kbd className="welcome-kbd">K</kbd>
        </span>
      </div>
      <div className="welcome-command-actions">
        <div className="welcome-command-label">
          <span className="welcome-command-label-text" id="dashboard-sort-label">{t('dashboard.welcome.search.sortLabel')}</span>
          <SearchableSelect
            id="dashboard-sort"
            ariaLabel={t('dashboard.welcome.search.sortAria')}
            value={sort}
            allowEmpty={false}
            searchable={false}
            options={[
              { value: 'updated', label: t('dashboard.welcome.search.sortUpdated') },
              { value: 'name', label: t('dashboard.welcome.search.sortName') },
              { value: 'issues', label: t('dashboard.welcome.search.sortIssues') },
              { value: 'progress', label: t('dashboard.welcome.search.sortProgress') },
            ]}
            onChange={(v) => { if (v) onSort(v as SortOption); }}
          />
        </div>
        <span className="welcome-count tabular" aria-live="polite" aria-atomic="true">
          {t('dashboard.welcome.search.count', { count })}
        </span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation('account');
  const { projects, loading, error, loadError, refresh } = useProjects();
  const { teams, invitations, loading: teamsLoading, error: teamsError, loadError: teamsLoadError, refresh: refreshTeams } = useTeams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { teamSlug: teamSlugParam } = useParams<{ teamSlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const [teamCreateOpen, setTeamCreateOpen] = useState(false);
  const tour = useOnboardingTour();
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [daily, setDaily] = useState<Array<{ date: string; created: number; done: number }> | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [nextUp, setNextUp] = useState<Array<{
    projectId: string;
    projectName: string;
    taskId: string;
    title: string;
    dueDate: string;
    priority: string;
    status: string;
  }> | null>(null);
  const [nextUpLoading, setNextUpLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const listAnchorRef = useRef<HTMLDivElement>(null);

  // Team resolution: slug routes (/:teamSlug/...) take the slug as source of
  // truth. "/" legacy (?team=) is owned by HomeRedirect and never renders
  // this page, so no fallback resolver lives here.
  const activeTeamId = useMemo(() => {
    if (!teams || teams.length === 0) return null;
    return resolveDashboardTeamIdBySlug(teams, teamSlugParam ?? null);
  }, [teams, teamSlugParam]);
  const activeTeam = teams?.find((tm) => tm.id === activeTeamId) ?? null;

  // Old-slug history: when the slug is not in the local list, ask the server
  // (member-scoped by-slug includes history -> redirect info). While checking
  // show loading; on 404 show the not-found card below.
  const [slugCheck, setSlugCheck] = useState<{ status: 'idle' | 'checking' | 'notfound' }>({
    status: 'idle',
  });
  useEffect(() => {
    if (!teams || teamsLoading) return;
    if (activeTeamId) {
      setSlugCheck({ status: 'idle' });
      return;
    }
    const slug = (teamSlugParam ?? '').trim();
    if (!slug) {
      setSlugCheck({ status: 'notfound' });
      return;
    }
    let cancelled = false;
    setSlugCheck({ status: 'checking' });
    void api
      .getTeamBySlug(slug)
      .then((res) => {
        if (cancelled) return;
        const suffix = parseSlugTab(location.pathname);
        if (res.redirectTo) {
          navigate(`/${encodeURIComponent(res.redirectTo)}/${suffix}${location.search}`, {
            replace: true,
          });
        } else {
          // Stale list (team exists but not yet cached): refresh and re-resolve.
          void refreshTeams();
        }
        setSlugCheck({ status: 'idle' });
      })
      .catch(() => {
        if (!cancelled) setSlugCheck({ status: 'notfound' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, teamsLoading, activeTeamId, teamSlugParam]);

  // Persist every successful resolve for the next session.
  useEffect(() => {
    if (activeTeam) writeLastActiveTeamId(activeTeam.id);
  }, [activeTeam]);

  // Sub-tabs: the path suffix selects the tab (/projects|members|settings).
  const activeTab = parseSlugTab(location.pathname);
  const setDashboardTab = (next: DashboardTab) => {
    const slug = activeTeam?.slug ?? teamSlugParam ?? '';
    const suffix = next === 'projects' ? 'projects' : next;
    // Switching tabs discards portfolio filters (keep no query).
    navigate(`/${encodeURIComponent(slug)}/${suffix}`, { replace: false });
  };

  // URL state for the Projects tab: ?q & ?sort & ?status & ?filter (+ ?new legacy).
  const queryParam = searchParams.get('q') ?? '';
  const sortParam = (searchParams.get('sort') as SortOption | null) ?? 'updated';
  const statusParam = searchParams.get('status') as 'archived' | 'all' | null;
  const filterParam = searchParams.get('filter') as 'all' | 'issues' | 'attention' | 'outdated' | null;
  const activeFilter: 'all' | 'issues' | 'attention' | 'outdated' | null =
    filterParam === 'issues' || filterParam === 'attention' || filterParam === 'outdated' || filterParam === 'all'
      ? filterParam
      : null;
  const showMode: 'active' | 'archived' | 'all' =
    statusParam === 'archived' ? 'archived' : statusParam === 'all' ? 'all' : 'active';

  const [queryDraft, setQueryDraft] = useState(queryParam);
  const deferredQuery = useDeferredValue(queryDraft);

  // Keep draft in sync when URL changes via back/forward.
  useEffect(() => {
    setQueryDraft(queryParam);
  }, [queryParam]);

  const sort: SortOption = ['updated', 'name', 'issues', 'progress'].includes(sortParam)
    ? (sortParam as SortOption)
    : 'updated';

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setNewOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Stats fetch parallel (decorative, global; scoped when rendered).
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
        // Stats are decorative.
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  // Daily activity fetch (decorative but real; API has no team scope
  // so the chart stays global while the list/hero are team-scoped).
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

  // Next-up fetch (global API; filtered to the active team when rendered).
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

  // Projects scoped to the active team only.
  const teamProjects = useMemo(() => {
    if (!projects || !activeTeamId) return projects === null ? null : [];
    return projects.filter((p) => p.teamId === activeTeamId);
  }, [projects, activeTeamId]);

  const teamProjectIds = useMemo(() => new Set((teamProjects ?? []).map((p) => p.id)), [teamProjects]);

  const scopedNextUp = useMemo(() => {
    if (!nextUp) return null;
    return nextUp.filter((item) => teamProjectIds.has(item.projectId));
  }, [nextUp, teamProjectIds]);

  const archiveCounts = useMemo(() => {
    if (!teamProjects) return { active: 0, archived: 0, all: 0 };
    let active = 0;
    let archived = 0;
    for (const p of teamProjects) {
      if (p.status === 'archived') archived += 1;
      else active += 1;
    }
    return { active, archived, all: teamProjects.length };
  }, [teamProjects]);

  // Derived team-scoped hero stats.
  const heroStats = useMemo(() => {
    if (!teamProjects || teamProjects.length === 0)
      return { total: 0, needsAttention: 0, done: 0, totalTasks: 0, openIssues: 0, overdue: 0, outdated: 0 };
    let done = 0;
    let totalTasks = 0;
    let openIssues = 0;
    let overdue = 0;
    let outdated = 0;
    let needsAttention = 0;
    for (const p of teamProjects) {
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
    return { total: teamProjects.length, needsAttention, done, totalTasks, openIssues, overdue, outdated };
  }, [teamProjects, stats]);

  // Filter + sort scoped to the active team.
  const filteredSorted = useMemo(() => {
    if (!teamProjects) return [];
    const q = deferredQuery.trim().toLowerCase();
    let list = teamProjects;
    if (showMode === 'active') list = list.filter((p) => p.status === 'active');
    else if (showMode === 'archived') list = list.filter((p) => p.status === 'archived');
    if (activeFilter === 'issues') {
      list = list.filter((p) => (stats[p.id]?.openIssues ?? 0) > 0);
    } else if (activeFilter === 'attention') {
      list = list.filter((p) => (stats[p.id]?.overdueTasks ?? 0) > 0);
    } else if (activeFilter === 'outdated') {
      list = list.filter((p) => (stats[p.id]?.outdatedDeps ?? 0) > 0);
    }
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      );
    }
    const withStats = list.map((p) => ({ p, st: stats[p.id] ?? null }));
    const sorted = withStats.toSorted((a, b) => {
      if (sort === 'name') return a.p.name.localeCompare(b.p.name);
      if (sort === 'issues') return (b.st?.openIssues ?? 0) - (a.st?.openIssues ?? 0);
      if (sort === 'progress') {
        const aPct = a.st && a.st.totalTasks > 0 ? a.st.doneTasks / a.st.totalTasks : 0;
        const bPct = b.st && b.st.totalTasks > 0 ? b.st.doneTasks / b.st.totalTasks : 0;
        return aPct - bPct;
      }
      return Date.parse(b.p.updatedAt) - Date.parse(a.p.updatedAt);
    });
    return sorted.map((x) => x.p);
  }, [teamProjects, deferredQuery, sort, stats, showMode, activeFilter]);

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

  // No tab bar: the route suffix selects the panel. A direct
  // /:slug/settings URL for viewers still resolves so
  // DashboardSettingsTab can render its no-access empty state.

  // Exclusive chain for the Projects tab: error > loading > empty > data.
  const teamsEmpty = teams !== null && teams.length === 0;
  const globalProjectsEmpty = !loading && projects !== null && projects.length === 0;
  const teamProjectsEmpty = !loading && teamProjects !== null && teamProjects.length === 0;
  const filteredEmpty = !loading && teamProjects !== null && teamProjects.length > 0 && filteredSorted.length === 0;

  // Shared by manual Next, auto-advance, and resume: jump into the newest
  // project of the active team and resume the tour at the Plan step.
  const advanceFromProjectStep = () => {
    if (!teamProjects || teamProjects.length === 0) return false;
    const first = [...teamProjects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    if (!first) return false;
    tour.goTo(3);
    navigate(`/project/${first.id}?tab=board&tour=1`);
    return true;
  };

  // Tour trigger (behavioral, no time-delay): first-run empty team/project,
  // only when the user never skipped/finished the tour.
  const tourCanAutoStart = !loading && teams !== null && projects !== null && (teamsEmpty || globalProjectsEmpty);
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
    if (tour.step === 2 && advanceFromProjectStep()) return;
    tour.next();
  };

  // Auto-detect creation while the tour waits on it: team 0->>=1 at step 1
  // advances, project 0->>=1 in the active team at step 2 jumps inside.
  const prevTeamCount = useRef<number | null>(null);
  const prevTeamProjectCount = useRef<number | null>(null);
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
    if (teamProjects === null) return;
    const n = teamProjects.length;
    const prev = prevTeamProjectCount.current;
    prevTeamProjectCount.current = n;
    if (prev !== null && prev === 0 && n > 0 && tour.active && tour.step === 2) {
      advanceFromProjectStep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamProjects, tour.active, tour.step]);

  const showLoading =
    teams === null ||
    teamsLoading ||
    loading ||
    teamProjects === null ||
    (slugCheck.status === 'checking');
  const showTeamsError = !showLoading && teamsError && teams === null;
  const showSlugNotFound = !showLoading && !activeTeam && slugCheck.status === 'notfound';

  return (
    <div className="page welcome-page dashboard">
      {showLoading ? (
        <div
          className="dashboard__loading"
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label={
            slugCheck.status === 'checking'
              ? t('dashboard.team.slugLoading')
              : t('dashboard.welcome.status.loading')
          }
        >
          <span className="sr-only">
            {slugCheck.status === 'checking'
              ? t('dashboard.team.slugLoading')
              : t('dashboard.welcome.status.loadingText')}
          </span>
          <div className="dashboard__header dashboard__header--loading" aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <Skeleton style={{ width: 140, height: 12 }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                <Skeleton style={{ width: 220, height: 24, borderRadius: 6 }} />
                <Skeleton style={{ width: 64, height: 18, borderRadius: 999 }} />
                <Skeleton style={{ width: 64, height: 18, borderRadius: 999 }} />
              </div>
              <Skeleton style={{ width: 320, height: 12, marginTop: 8 }} />
            </div>
            <Skeleton style={{ width: 130, height: 36, borderRadius: 8, flexShrink: 0 }} />
          </div>
          <WelcomeListSkeleton />
        </div>
      ) : showTeamsError ? (
        <div className="welcome-error-wrap">
          <DataErrorState error={teamsLoadError ?? teamsError} onRetry={() => void refreshTeams()} retryLabel={t('dashboard.welcome.status.retry')} />
        </div>
      ) : showSlugNotFound ? (
        <div className="team-workspace">
          <div className="team-workspace__card" role="status" aria-live="polite">
            <h1 className="team-workspace__title">{t('dashboard.team.slugNotFoundTitle')}</h1>
            <p className="team-workspace__desc">{t('dashboard.team.slugNotFoundDesc')}</p>
            <div className="team-workspace__actions">
              <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
                {t('dashboard.team.slugNotFoundCta')}
              </Button>
            </div>
          </div>
        </div>
      ) : teamsEmpty ? (
        <Navigate to="/" replace />
      ) : activeTeam ? (
        <>
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

          {activeTab === 'members' ? (
            <DashboardMembersTab team={activeTeam} />
          ) : activeTab === 'settings' ? (
            <DashboardSettingsTab team={activeTeam} onBackToProjects={() => setDashboardTab('projects')} />
          ) : (
            <section
              className="tab-panel dashboard__projects"
              role="tabpanel"
              id="dashboard-tabpanel-projects"
              aria-labelledby="dashboard-tab-projects"
              tabIndex={0}
            >
              <article className="pcard">
              <div className="pcard-body">
              {/* Workspace hero di dalam card atas (tanpa card ganda). */}
              <header className="dashboard__header">
                <div className="dashboard__header-copy">
                  <p className="dashboard__eyebrow" aria-hidden="true">
                    WORKSPACE / {activeTeam.slug || activeTeam.id}
                  </p>
                  <div className="dashboard__title-row">
                    <h1 className="page-title">
                      {activeTeam.icon?.trim() ? `${activeTeam.icon.trim()} ${activeTeam.name}` : activeTeam.name}
                    </h1>
                    <span className="dashboard__badges">
                      <Badge tone={activeTeam.plan === 'pro' ? 'info' : 'neutral'}>
                        {activeTeam.planPackageName}
                      </Badge>
                      <Badge tone={TEAM_ROLE[activeTeam.role]?.tone ?? 'neutral'}>
                        {t(`profile.role.${activeTeam.role}`)}
                      </Badge>
                      <span className="page-subtitle">{t('teams.memberCount', { count: activeTeam.memberCount })}</span>
                    </span>
                  </div>
                  <p className="page-subtitle dashboard__desc">{t('teams.subtitle')}</p>
                </div>
              </header>

              <div className="dashboard__panel">
              {/* Bento stats scoped to the active team. */}
              {teamProjects && teamProjects.length > 0 && (
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

              {/* Task activity (global decorative chart; list stays team-scoped). */}
              {teamProjects && teamProjects.length > 0 && (
                <div className="task-activity" aria-label={t('dashboard.welcome.activity.aria')}>
                  <div className="task-activity-head">
                    <h2 className="task-activity-title">{t('dashboard.welcome.activity.title')}</h2>
                    {dailyLoading && (
                      <span className="task-activity-loading" aria-hidden="true">
                        …
                      </span>
                    )}
                  </div>
                  <div className="task-activity-bars" role="list" aria-label={t('dashboard.welcome.activity.barsAria')}>
                    {(daily ?? []).map((d) => {
                      const dateObj = new Date(`${d.date}T00:00:00.000Z`);
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
                            aria-label={t('dashboard.welcome.activity.itemAria', {
                              date: fullDate,
                              created: d.created,
                              done: d.done,
                            })}
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
                    {daily && daily.length === 0 && (
                      <span className="task-activity-empty">{t('dashboard.welcome.activity.empty')}</span>
                    )}
                    {!daily && !dailyLoading && (
                      <span className="task-activity-empty">{t('dashboard.welcome.activity.noData')}</span>
                    )}
                  </div>
                </div>
              )}

              <div ref={listAnchorRef} className="welcome-list-anchor">
                <DashboardCommandBar
                  query={queryDraft}
                  onQuery={commitQuery}
                  sort={sort}
                  onSort={commitSort}
                  count={filteredSorted.length}
                />
                {teamProjects && teamProjects.length > 0 && (
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
                        {v === 'active'
                          ? t('dashboard.welcome.filter.active', { count: archiveCounts.active })
                          : v === 'all'
                            ? t('dashboard.welcome.filter.all', { count: archiveCounts.all })
                            : t('dashboard.welcome.filter.archived', { count: archiveCounts.archived })}
                      </button>
                    ))}
                  </div>
                )}
                {isPending && <span className="welcome-pending" aria-hidden="true" />}

                {error ? (
                  <div className="welcome-error-wrap">
                    <DataErrorState error={loadError ?? error} onRetry={() => void refresh()} retryLabel={t('dashboard.welcome.status.retry')} />
                  </div>
                ) : loading ? (
                  <div
                    className="welcome-skeleton"
                    role="status"
                    aria-busy="true"
                    aria-live="polite"
                    aria-label={t('dashboard.welcome.status.loading')}
                  >
                    <span className="sr-only">{t('dashboard.welcome.status.loadingText')}</span>
                    <WelcomeListSkeleton />
                  </div>
                ) : teamProjectsEmpty ? (
                  <WelcomeEmptyNoProject teamName={activeTeam.name} onCreate={() => setNewOpen(true)} />
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
                    <div className="welcome-queue" role="list" aria-label={t('dashboard.welcome.queue.aria')}>
                      <div className="welcome-queue-head">
                        <h2 style={{ font: 'inherit', margin: 0 }}>{t('dashboard.welcome.queue.title')}</h2>
                        <span className="welcome-queue-sub">
                          {scopedNextUp && scopedNextUp.length > 0
                            ? t('dashboard.welcome.queue.subOverdue', { count: scopedNextUp.length })
                            : t('dashboard.welcome.queue.sub')}
                        </span>
                      </div>
                      {nextUpLoading ? (
                        <div
                          className="welcome-queue-loading"
                          role="status"
                          aria-busy="true"
                          aria-label={t('dashboard.welcome.queue.loadingAria')}
                        >
                          <span className="sr-only">{t('dashboard.welcome.queue.loadingText')}</span>
                          <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="welcome-queue-card" style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid var(--border-hairline)", borderRadius: 12 }}>
                                <Skeleton style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0 }} />
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                                  <Skeleton style={{ width: "60%", height: 14 }} />
                                  <Skeleton style={{ width: "40%", height: 11 }} />
                                </div>
                                <Skeleton style={{ width: 64, height: 18, borderRadius: 999, flexShrink: 0 }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : scopedNextUp && scopedNextUp.length > 0 ? (
                        scopedNextUp.map((item, idx) => (
                          <button
                            key={item.taskId}
                            type="button"
                            className="welcome-queue-card"
                            role="listitem"
                            onClick={() => handleOpenTask(item.projectId, item.taskId)}
                            aria-label={t('dashboard.welcome.queue.openTaskAria', {
                              title: item.title,
                              project: item.projectName,
                              due: item.dueDate.slice(0, 10),
                            })}
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
                              <span className="welcome-queue-project">
                                {p.name} · {t('dashboard.welcome.queue.continueWork')}
                              </span>
                            </span>
                            <span className="welcome-queue-cta">{t('dashboard.welcome.queue.open')}</span>
                          </button>
                        ))
                      )}
                      {!nextUpLoading && scopedNextUp && scopedNextUp.length === 0 && filteredSorted.length === 0 && (
                        <p className="welcome-queue-empty">{t('dashboard.welcome.queue.empty')}</p>
                      )}
                    </div>
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
              </div>
              </div>
              </article>
            </section>
          )}
        </>
      ) : null}

      <NewProjectModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        initialTeamId={activeTeam?.id ?? null}
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
          blockReason={tour.step === 1 && teamsEmpty ? 'team' : tour.step === 2 && teamProjectsEmpty ? 'project' : null}
        />
      )}
    </div>
  );
}
