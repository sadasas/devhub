import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Archive,
  DotsThreeVertical,
  ArrowCounterClockwise,
  BookmarkSimple,
  Bug,
  CheckSquare,
  ChalkboardSimple,
  Columns,
  Database,
  DownloadSimple,
  Gauge,
  GearSix,
  Plugs,
  Rocket,
  Scales,
  ShareNetwork,
  Stack,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { FE_LIMITS } from '../../lib/limits';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import { offlineProvider } from '../../lib/idb-provider';
import { TEAM_ROLE } from '../../lib/labels';
import { formatDate } from '../../lib/utils';
import { usePresenceStatus, viewingStatus } from '../../hooks/usePresenceStatus';
import { useTabShortcuts } from '../../hooks/useTabShortcuts';
import { useNewItemShortcut } from '../../hooks/useNewItemShortcut';
import { ProjectProvider, useProject } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import type { ExportDocument, Project } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SaveBanner } from '../../components/SaveBanner';
import { StatusBanner } from '../../components/StatusBanner';
import { ToastStack } from '../../components/ToastStack';
import { Skeleton } from '../../components/Skeleton';
import { ProjectSettingsSkeleton } from '../../components/PageSkeletons';
import { SyncStatusChip } from '../../components/SyncStatusChip';
import { PresenceChip } from '../../components/PresenceChip';
import { ShareModal } from './ShareModal';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { InlineError } from '../../components/InlineError';
import { SaveTemplateModal } from '../templates/SaveTemplateModal';
import { ProjectTabNav } from './ProjectTabNav';
import { normalizeProjectTabId } from './projectSettingsSections';
import { DeletedItemsBanner } from './DeletedItemsBanner';
import { ArchivedBanner } from './ArchivedBanner';
import { ArchiveUndoToast } from './ArchiveUndoToast';
import { useTabUnread } from '../../hooks/useTabUnread';
import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { useOnboardingTour } from '../onboarding/useOnboardingTour';
import { getTourStep } from '../onboarding/tourSteps';

const BoardPageLazy = lazy(() => import('../board/BoardPage').then((m) => ({ default: m.BoardPage })));
const IssuesPageLazy = lazy(() => import('../issues/IssuesPage').then((m) => ({ default: m.IssuesPage })));
const TestsPageLazy = lazy(() => import('../tests/TestsPage').then((m) => ({ default: m.TestsPage })));
const StackPageLazy = lazy(() => import('../stack/StackPage').then((m) => ({ default: m.StackPage })));
const SchemaPageLazy = lazy(() => import('../schema/SchemaPage').then((m) => ({ default: m.SchemaPage })));
const DecisionsPageLazy = lazy(() => import('../decisions/DecisionsPage').then((m) => ({ default: m.DecisionsPage })));
const ReleasesPageLazy = lazy(() => import('../releases/ReleasesPage').then((m) => ({ default: m.ReleasesPage })));
const ApiPageLazy = lazy(() => import('../api/ApiPage').then((m) => ({ default: m.ApiPage })));
const OverviewPageLazy = lazy(() => import('../overview/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const WhiteboardPageLazy = lazy(() => import('../whiteboard/WhiteboardPage').then((m) => ({ default: m.WhiteboardPage })));
const ProjectSettingsLazy = lazy(() => import('./ProjectSettings').then((m) => ({ default: m.ProjectSettings })));

export type ProjectTab =
  | 'board'
  | 'issues'
  | 'tests'
  | 'stack'
  | 'schema'
  | 'decisions'
  | 'releases'
  | 'api'
  | 'overview'
  | 'whiteboard';

const TABS: { id: ProjectTab; label: string; icon: ReactNode }[] = [
  { id: 'board', label: 'tabs.board', icon: <Columns size={15} /> },
  { id: 'issues', label: 'tabs.issues', icon: <Bug size={15} /> },
  { id: 'tests', label: 'tabs.tests', icon: <CheckSquare size={15} /> },
  { id: 'stack', label: 'tabs.stack', icon: <Stack size={15} /> },
  { id: 'schema', label: 'tabs.schema', icon: <Database size={15} /> },
  { id: 'decisions', label: 'tabs.decisions', icon: <Scales size={15} /> },
  { id: 'releases', label: 'tabs.releases', icon: <Rocket size={15} /> },
  { id: 'api', label: 'tabs.api', icon: <Plugs size={15} /> },
  { id: 'whiteboard', label: 'tabs.whiteboard', icon: <ChalkboardSimple size={15} /> },
  { id: 'overview', label: 'tabs.overview', icon: <Gauge size={15} /> },

];

// Stable module-level instance: a fresh provider per render would re-run the
// ProjectProvider mount effect (provider is in its effect deps).
const projectStorage = offlineProvider();

function TabSkeleton({ tab }: { tab: ProjectTab }) {
  const { t } = useTranslation('project');
  if (tab === 'board') {
    return (
      <div className="kanban" role="status" aria-busy="true" aria-label={t('common:loading.board')}>
        <span className="sr-only">{t('common:loading.board')}…</span>
        <div aria-hidden="true" style={{ display: 'contents' }}>
          {['skeleton.todo', 'skeleton.inProgress', 'skeleton.review', 'skeleton.done'].map((key) => (
            <div key={key} className="kanban-col">
              <div className="kanban-col-header">
                <span>{t(key)}</span>
                <Skeleton style={{ width: 24, height: 11, borderRadius: 999, marginLeft: 6 }} />
              </div>
              <div className="kanban-col-body">
                {[0, 1].map((j) => (
                  <div
                    key={j}
                    className="task-card"
                    style={{ padding: 10, gap: 6, display: 'flex', flexDirection: 'column', minHeight: 88 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton style={{ width: 20, height: 20, borderRadius: '50%' }} />
                      <Skeleton style={{ width: 36, height: 18, borderRadius: 999 }} />
                    </div>
                    <Skeleton style={{ width: '85%', height: 14 }} />
                    <Skeleton style={{ width: '60%', height: 14, opacity: 0.9 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Skeleton style={{ width: 48, height: 16, borderRadius: 6 }} />
                      <Skeleton style={{ width: 52, height: 16, borderRadius: 6 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
                      <Skeleton style={{ width: 64, height: 11 }} />
                      <Skeleton style={{ width: 44, height: 11, borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === 'whiteboard') {
    return (
      <div className="project-grid" role="status" aria-busy="true" aria-label={t('common:loading.whiteboards')}>
        <span className="sr-only">{t('common:loading.whiteboards')}…</span>
        <div aria-hidden="true" style={{ display: 'contents' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="project-card" style={{ padding: 14, gap: 8, display: 'flex', flexDirection: 'column' }}>
              <Skeleton style={{ width: '70%', height: 14 }} />
              <Skeleton style={{ width: '100%', height: 11, opacity: 0.85 }} />
              <Skeleton style={{ width: '65%', height: 11, opacity: 0.85 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <Skeleton style={{ width: 56, height: 16, borderRadius: 999 }} />
                <Skeleton style={{ width: 64, height: 11 }} />
                <Skeleton style={{ width: 44, height: 11 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === 'overview') {
    return (
      <div role="status" aria-busy="true" aria-label={t('common:loading.overview')}>
        <span className="sr-only">{t('common:loading.overview')}…</span>
        <div aria-hidden="true">
          <Skeleton style={{ width: 220, height: 20, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ width: 96, height: 18, borderRadius: 999 }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 22 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} style={{ height: 68, borderRadius: 12 }} />
            ))}
          </div>
          <div className="stats-grid">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ height: 160, borderRadius: 12 }} />
            ))}
          </div>
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="member-row" style={{ height: 40, gap: 12, alignItems: 'center' }}>
                <Skeleton style={{ width: 28, height: 28, borderRadius: '50%' }} />
                <Skeleton style={{ width: 120, height: 14 }} />
                <Skeleton style={{ width: '40%', height: 6, borderRadius: 999 }} />
                <Skeleton style={{ width: 44, height: 11 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'api') {
    return (
      <div role="status" aria-busy="true" aria-label="Loading API">
        <span className="sr-only">Loading API…</span>
        <div aria-hidden="true">
          <div className="data-list">
            <div className="data-row" style={{ height: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                  <Skeleton style={{ width: '55%', height: 14 }} />
                </div>
                <Skeleton style={{ width: '60%', height: 11, opacity: 0.8 }} />
              </div>
              <Skeleton style={{ width: 48, height: 16, borderRadius: 999 }} />
            </div>
            <div className="data-row" style={{ height: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                  <Skeleton style={{ width: '45%', height: 14 }} />
                </div>
                <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
              </div>
              <Skeleton style={{ width: 48, height: 16, borderRadius: 999 }} />
            </div>
          </div>
          <Skeleton style={{ height: 320, width: '100%', borderRadius: 12, marginTop: 12 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="data-list" role="status" aria-busy="true" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="data-row" style={{ height: 56 }}>
            <div className="data-row-main" style={{ gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                <Skeleton style={{ width: `${55 - i * 5}%`, height: 14 }} />
              </div>
              <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Skeleton style={{ width: 64, height: 11, borderRadius: 999 }} />
                <Skeleton style={{ width: 44, height: 11 }} />
              </div>
            </div>
            <div className="data-row-side">
              <Skeleton style={{ width: 56, height: 18, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectPresenceStatus({ tab }: { tab: ProjectTab }) {
  usePresenceStatus(viewingStatus(tab));
  return null;
}

function useIsMobileActions(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}

function SheetPresenceList() {
  const { presence } = useProject();
  const { user } = useAuth();
  const { t } = useTranslation();
  const seen = new Set<string>();
  const unique = presence.filter((u) => {
    if (seen.has(u.userId)) return false;
    seen.add(u.userId);
    return true;
  });
  const ordered = user
    ? [...unique.filter((u) => u.userId === user.id), ...unique.filter((u) => u.userId !== user.id)]
    : unique;
  if (ordered.length === 0) return null;
  return (
    <div className="sheet-section sheet-presence">
      <p className="sheet-presence-header">
        <span className="dot-online" aria-hidden="true" />
        {t('presence.header', { count: ordered.length })}
      </p>
      <div className="sheet-presence-list">
        {ordered.map((u) => {
          const displayName = u.name || t('presence.fallbackName');
          const suffix = user && u.userId === user.id ? ` ${t('presence.you')}` : '';
          return (
            <div key={u.userId} className="sheet-presence-row">
              <span className="avatar-presence">
                <Avatar src={u.avatarUrl ?? null} name={displayName} id={u.userId} size={36} />
                <span className="avatar-presence-dot" aria-hidden="true" />
              </span>
              <span className="sheet-presence-meta">
                <span className="sheet-presence-name" title={`${displayName}${suffix}`}>
                  {displayName}
                  {suffix}
                </span>
                {u.activity ? (
                  <span className="sheet-presence-status">{u.activity}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectUnreadArea({
  projectId,
  userId,
  tab,
  onSelect,
  project,
}: {
  projectId: string;
  userId: string;
  tab: ProjectTab;
  onSelect: (next: ProjectTab) => void;
  project: Project;
}) {
  const { t } = useTranslation('project');
  const { unread, unreadIds, deleted, dismissedUntil, dismissDeleted } = useTabUnread(
    projectId,
    userId,
    tab,
  );
  return (
    <>
      <ProjectTabNav
        tabs={TABS.map(({ id, icon, label }) => ({ id, icon, label: t(label) }))}
        active={tab}
        onSelect={(id) => onSelect(id as ProjectTab)}
        unread={unread}
      />
      <DeletedItemsBanner
        items={deleted}
        activeTab={tab}
        dismissedUntil={dismissedUntil}
        onDismiss={dismissDeleted}
      />
      <section
        className="tab-panel"
        role="tabpanel"
        id="project-tabpanel"
        aria-labelledby={`project-tab-${tab}`}
        tabIndex={0}
        aria-busy={undefined}
      >
        {tab === 'board' ? (
          <Suspense fallback={<TabSkeleton tab={tab} />}>
            <BoardPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
          </Suspense>
        ) : (
          <Suspense fallback={<TabSkeleton tab={tab} />}>
            {tab === 'issues' ? (
              <IssuesPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
            ) : tab === 'tests' ? (
              <TestsPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
            ) : tab === 'stack' ? (
              <StackPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
            ) : tab === 'schema' ? (
              <SchemaPageLazy
                projectName={project.name}
                unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new}
              />
            ) : tab === 'decisions' ? (
              <DecisionsPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
            ) : tab === 'releases' ? (
              <ReleasesPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
            ) : tab === 'api' ? (
              <ApiPageLazy
                projectName={project.name}
                projectDescription={project.description ?? ''}
                unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new}
              />
            ) : tab === 'overview' ? (
              <OverviewPageLazy project={project} />
            ) : tab === 'whiteboard' ? (
              <WhiteboardPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
            ) : null}
          </Suspense>
        )}
      </section>
    </>
  );
}

export function ProjectPage() {
  const { t } = useTranslation('project');
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { projects, refresh, remove, update } = useProjects();
  const { teams } = useTeams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const legacyTab = tabParam === 'stats' || tabParam === 'about' ? 'overview' : tabParam;
  const tab: ProjectTab = TABS.some((t) => t.id === legacyTab) ? (legacyTab as ProjectTab) : 'board';
  const setTab = (next: ProjectTab) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', next);
        p.delete('sort');
        p.delete('dir');
        return p;
      },
      { replace: true },
    );
  };
  // Settings pseudo-view (?tab=settings&section=): bukan tab ke-11 (audit A1) —
  // shell settings menggantikan konten tab; tab terakhir dibawa via ?from=
  // (deep-linkable, dipakai tombol back sidebar + gear).
  const isSettings = tabParam === 'settings';
  const fromTab = normalizeProjectTabId(searchParams.get('from'));
  const openSettings = () => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', 'settings');
        if (!p.get('from')) {
          p.set('from', TABS.some((t) => t.id === legacyTab) ? (legacyTab as ProjectTab) : 'board');
        }
        return p;
      },
      { replace: true },
    );
  };
  const closeSettings = () => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', fromTab);
        p.delete('from');
        p.delete('sort');
        p.delete('dir');
        return p;
      },
      { replace: true },
    );
  };
  const project = projects?.find((p) => p.id === projectId);
  const team = teams?.find((tm) => tm.id === project?.teamId) ?? null;
  const teamDashboardTo = team ? `/${encodeURIComponent(team.slug || team.id)}/projects` : '/';
  const tour = useOnboardingTour();
  useTabShortcuts(TABS.map((t) => t.id), tab, setTab);
  useNewItemShortcut(tab, (project?.role !== undefined && project.role !== 'viewer' && project?.status !== 'archived') && !tour.active, (activeTab, value) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', activeTab);
        p.set('new', value);
        return p;
      },
      { replace: true },
    );
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [archiveConfirm, setArchiveConfirm] = useState<null | 'archive' | 'restore'>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<null | 'archived' | 'restored'>(null);
  const [importDoc, setImportDoc] = useState<ExportDocument | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const isMobileActions = useIsMobileActions();
  // Prefetch dokumen export saat menu aksi dibuka — tap Export lalu membuat
  // blob + klik anchor secara sinkron dalam gesture (mobile memblokir
  // download yang dibuat setelah jeda async).
  const [exportDocCache, setExportDocCache] = useState<{ id: string; doc: ExportDocument } | null>(null);

  // close actions menu on Escape / outside tap (desktop dropdown only —
  // the mobile BottomSheet lives in a body portal outside actionsRef and
  // closes itself via backdrop/X/Escape; letting this handler run would
  // unmount the sheet on touchstart before the tap becomes a click).
  useEffect(() => {
    if (!actionsOpen || isMobileActions) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionsOpen(false);
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      if (actionsRef.current && t && !actionsRef.current.contains(t)) setActionsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('touchstart', onDown);
    };
  }, [actionsOpen, isMobileActions]);

  useEffect(() => {
    if (!actionsOpen) return;
    let cancelled = false;
    api.exportProjectDoc(projectId).then(
      (doc) => { if (!cancelled) setExportDocCache({ id: projectId, doc }); },
      () => { if (!cancelled) setExportDocCache(null); },
    );
    return () => { cancelled = true; };
  }, [actionsOpen, projectId]);

  useEffect(() => {
    setActionsOpen(false);
  }, [projectId, tab]);

  // Tour entry (behavioral): first arrival with ?tour=1 resumes at Plan (step 3).
  // Strips ?tour so refresh/back doesn't restart the tour.
  useEffect(() => {
    if (searchParams.get('tour') !== '1') return;
    if (!project) return;
    if (tour.finished || tour.skipped) {
      const p = new URLSearchParams(searchParams);
      p.delete('tour');
      setSearchParams(p, { replace: true });
      return;
    }
    if (!tour.active) tour.start(3);
    else if (tour.step < 3) tour.goTo(3);
    const p = new URLSearchParams(searchParams);
    p.delete('tour');
    if (!p.get('tab')) p.set('tab', 'board');
    setSearchParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, project !== undefined]);

  // Tour phase -> tab: Plan=board, Build=tests, Decide=decisions, Collab=whiteboard.
  // Runs only on step change so Alt+digits stay user-controlled.
  const tourStep = tour.step;
  const tourActive = tour.active;
  useEffect(() => {
    if (!tourActive) return;
    if (tourStep < 3) return;
    const def = getTourStep(tourStep);
    if (def.tab && def.tab !== tab && TABS.some((t) => t.id === def.tab)) {
      setTab(def.tab as ProjectTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep, tourActive, projectId]);

  // Fail-closed: viewer yang membuka ?tab=settings langsung dikembalikan
  // ke board agar sidebar tak macet di nav settings. project bisa undefined
  // saat loading/404 — efek aman karena branch di dalam, bukan early return.
  const projectRole = project?.role;
  useEffect(() => {
    if (isSettings && projectRole === 'viewer') {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('tab', 'board');
          p.delete('from');
          p.delete('sort');
          p.delete('dir');
          return p;
        },
        { replace: true },
      );
    }
  }, [isSettings, projectRole, setSearchParams]);

  if (!project) {
    return (
      <div className="page">
        {projects === null ? (
          <>
            <Skeleton style={{ width: 280, height: 28, marginTop: 8 }} />
            <Skeleton style={{ width: '100%', height: 24, marginTop: 16 }} />
            <Skeleton style={{ width: '100%', height: 180, marginTop: 24 }} />
          </>
        ) : (
          <div className="page-empty">
            <EmptyState
              icon={<Columns size={22} />}
              title={t('page.notFoundTitle')}
              description={t('page.notFoundDesc')}
            />
          </div>
        )}
      </div>
    );
  }

  const role = project.role;
  const isAdmin = role === 'owner' || role === 'admin';
  const canArchive = role !== 'viewer';
  const isArchived = project.status === 'archived';

  async function handleArchiveToggle(next: 'active' | 'archived') {
    setArchiveError(null);
    setArchiving(true);
    try {
      await update(projectId, { status: next });
      setArchiveConfirm(null);
      setUndoToast(next === 'archived' ? 'archived' : 'restored');
    } catch (err) {
      setArchiveError(getErrorMessage(err, 'Failed to update project status'));
    } finally {
      setArchiving(false);
    }
  }

  async function onExport() {
    if (!project) return;
    try {
      // Pakai cache prefetch bila segar agar klik anchor sinkron dalam gesture.
      const doc = exportDocCache && exportDocCache.id === projectId
        ? exportDocCache.doc
        : await api.exportProjectDoc(projectId);
      const safeName = project.name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase() || 'project';
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devhub-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(getErrorMessage(err, t('errors.exportFailed')));
    }
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const doc = JSON.parse(String(reader.result)) as ExportDocument;
        if (doc?.meta?.app !== 'devhub' || !doc?.state) {
          setImportError(t('errors.invalidExport'));
          setImportDoc(null);
          return;
        }
        setImportError(null);
        setImportDoc(doc);
      } catch {
        setImportError(t('errors.parseJson'));
        setImportDoc(null);
      }
    };
    reader.readAsText(file);
  }

  async function onConfirmImport() {
    if (!importDoc) return;
    setImportError(null);
    setImporting(true);
    try {
      const result = await api.importProjectDoc(importDoc);
      setImportDoc(null);
      await refresh();
      navigate(`/project/${result.projectId}`);
    } catch (err) {
      if (isPlanLimitError(err)) {
        setImportDoc(null);
        setLimitOpen(true);
        setImporting(false);
      } else {
        setImportError(getErrorMessage(err, t('errors.importFailed')));
        setImporting(false);
      }
    }
  }

  async function onDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await remove(projectId);
      navigate('/');
    } catch (err) {
      setDeleteError(getErrorMessage(err, t('errors.deleteFailed')));
      setDeleting(false);
    }
  }

  return (
    <ProjectProvider
      key={projectId}
      projectId={projectId}
      role={role}
      teamId={project.teamId}
      isArchived={isArchived}
      provider={projectStorage}
    >
      <ProjectPresenceStatus tab={tab} />
      <div className="page">
      <article className="pcard pcard--compact">
      <div className="pcard-body">
        <header className="project-header">
          <div className="project-heading">
            <div className="project-heading-top">
            <nav className="breadcrumb" aria-label={t('common:breadcrumb', { defaultValue: 'Breadcrumb' })}>
              <ol className="breadcrumb-list">
                <li>
                  <Link className="breadcrumb-link" to={teamDashboardTo} title={team?.name ?? undefined}>
                    {team?.name ?? '…'}
                  </Link>
                </li>
                <li aria-hidden="true" className="breadcrumb-sep">
                  ›
                </li>
                <li>
                  <span aria-current="page" className="breadcrumb-current" title={project.name}>
                    {project.name}
                  </span>
                </li>
              </ol>
            </nav>
            <div className="project-actions" ref={actionsRef}>
              {!isMobileActions && <PresenceChip badgeOnly />}
              {!isMobileActions && <Badge tone={TEAM_ROLE[role].tone}>{TEAM_ROLE[role].label}</Badge>}
              <SyncStatusChip />
              {role !== 'viewer' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                  aria-label={t('settings.title', { defaultValue: 'Project settings' })}
                  title={t('settings.title', { defaultValue: 'Project settings' })}
                  aria-pressed={isSettings}
                  onClick={openSettings}
                >
                  <GearSix size={16} aria-hidden="true" />
                </Button>
              )}
              {isAdmin &&
                (isMobileActions ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="btn-icon"
                    aria-label={
                      project.visibility === 'public' ? t('actions.sharePublic') : t('actions.sharePrivate')
                    }
                    title={project.visibility === 'public' ? t('actions.sharePublic') : t('actions.sharePrivate')}
                    onClick={() => setShareOpen(true)}
                  >
                    <ShareNetwork size={16} aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<ShareNetwork size={14} aria-hidden="true" />}
                    onClick={() => setShareOpen(true)}
                  >
                    {project.visibility === 'public' ? t('actions.sharePublic') : t('actions.sharePrivate')}
                  </Button>
                ))}
              <div className="project-actions__mobile">
                <Button
                  variant="secondary"
                  size="sm"
                  className="btn-icon"
                  aria-label={t('actions.menu')}
                  aria-expanded={actionsOpen}
                  aria-haspopup={isMobileActions ? 'dialog' : 'menu'}
                  aria-controls="project-actions-menu"
                  onClick={() => { setActionsOpen((o) => !o); }}
                >
                  <DotsThreeVertical size={18} weight="bold" aria-hidden="true" />
                </Button>
                {actionsOpen && !isMobileActions && (
                  <div id="project-actions-menu" role="menu" className="more-dropdown project-actions__sheet">
                    <button type="button" role="menuitem" className="more-item" onClick={() => { setActionsOpen(false); void onExport(); }}>
                      <span className="more-item-icon"><DownloadSimple size={14} aria-hidden="true" /></span>
                      <span className="more-item-label">{t('actions.export')}</span>
                    </button>
                    {role !== 'viewer' && !isArchived && (
                      <label className="more-item" onClick={() => { setActionsOpen(false); }}>
                        <input type="file" accept="application/json,.json" className="more-item-file" onChange={onImportFile} aria-label={t('actions.import')} />
                        <span className="more-item-icon"><UploadSimple size={14} aria-hidden="true" /></span>
                        <span className="more-item-label">{t('actions.import')}</span>
                      </label>
                    )}
                    {role !== 'viewer' && !isArchived && (
                      <button type="button" role="menuitem" className="more-item" onClick={() => { setActionsOpen(false); setSaveTemplateOpen(true); }}>
                        <span className="more-item-icon"><BookmarkSimple size={14} aria-hidden="true" /></span>
                        <span className="more-item-label">{t('actions.saveAsTemplate')}</span>
                      </button>
                    )}
                  </div>
                )}
                {isMobileActions && (
                  <BottomSheet
                    open={actionsOpen}
                    title={t('actions.menu')}
                    onClose={() => setActionsOpen(false)}
                    hideHeader
                  >
                    <SheetPresenceList />
                    <hr className="sheet-divider" aria-hidden="true" />
                    <dl className="settings-rows sheet-role-list">
                      <div className="settings-row sheet-role-row">
                        <dt>{t('actions.yourRole', { defaultValue: 'Your role' })}</dt>
                        <dd><Badge tone={TEAM_ROLE[role].tone}>{TEAM_ROLE[role].label}</Badge></dd>
                      </div>
                    </dl>
                    <hr className="sheet-divider" aria-hidden="true" />
                    <div className="sheet-section sheet-project-actions">
                      <p className="sheet-section-title">{t('actions.menu')}</p>
                      <div className="sheet-actions-list" id="project-actions-menu" role="menu">
                        <button type="button" role="menuitem" className="more-item" onClick={() => { setActionsOpen(false); void onExport(); }}>
                          <span className="more-item-icon"><DownloadSimple size={18} aria-hidden="true" /></span>
                          <span className="more-item-label">{t('actions.export')}</span>
                        </button>
                        {role !== 'viewer' && !isArchived && (
                          <label className="more-item" onClick={() => { setActionsOpen(false); }}>
                            <input type="file" accept="application/json,.json" className="more-item-file" onChange={onImportFile} aria-label={t('actions.import')} />
                            <span className="more-item-icon"><UploadSimple size={18} aria-hidden="true" /></span>
                            <span className="more-item-label">{t('actions.import')}</span>
                          </label>
                        )}
                        {role !== 'viewer' && !isArchived && (
                          <button type="button" role="menuitem" className="more-item" onClick={() => { setActionsOpen(false); setSaveTemplateOpen(true); }}>
                            <span className="more-item-icon"><BookmarkSimple size={18} aria-hidden="true" /></span>
                            <span className="more-item-label">{t('actions.saveAsTemplate')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </BottomSheet>
                )}
              </div>
            </div>
            </div>

            <div className="project-title-row">
              <h1 className="page-title sr-only">{project.name}</h1>
            </div>
          </div>
        </header>

        {exportError && (
          <StatusBanner
            tone="danger"
            message={exportError}
            onDismiss={() => setExportError(null)}
            dismissLabel={t('banner.dismiss', { defaultValue: 'Dismiss' })}
            testId="export-error"
          />
        )}

        {isArchived && (
          <ArchivedBanner
            canRestore={canArchive}
            restoring={archiving}
            onRestore={canArchive ? () => setArchiveConfirm('restore') : undefined}
          />
        )}

        {isSettings && role !== 'viewer' ? (
          <Suspense fallback={<ProjectSettingsSkeleton />}>
            <ProjectSettingsLazy
              project={project}
              canEditMeta={isAdmin}
              canConnect={!isArchived}
              canArchive={canArchive}
              isAdmin={isAdmin}
              onBack={closeSettings}
              onRequestArchive={(next) => setArchiveConfirm(next)}
              onRequestDelete={() => { setDeleteConfirm(''); setConfirmOpen(true); }}
            />
          </Suspense>
        ) : (
          <ProjectUnreadArea
            projectId={projectId}
            userId={user?.id ?? ''}
            tab={tab}
            onSelect={setTab}
            project={project}
          />
        )}

      </div>
      </article>

        <ToastStack>
          <SaveBanner />
          {undoToast && (
            <ArchiveUndoToast
              action={undoToast}
              onUndo={() => {
                const next = undoToast === 'archived' ? 'active' : 'archived';
                setUndoToast(null);
                void handleArchiveToggle(next as 'active' | 'archived');
              }}
              onDismiss={() => setUndoToast(null)}
            />
          )}
        </ToastStack>

        <Modal
          open={confirmOpen}
          title={t('deleteModal.title')}
          onClose={() => { if (!deleting) setConfirmOpen(false); }}
          width="sm"
          ariaDescribedBy="delete-desc"
          footer={
            <>
              <Button variant="ghost" size="md" onClick={() => setConfirmOpen(false)} disabled={deleting}>
                {t('deleteModal.cancel')}
              </Button>
              <Button variant="danger" size="md" leftIcon={<Trash size={14} aria-hidden="true" />} loading={deleting} disabled={deleteConfirm.trim() !== project.name} aria-describedby={deleteConfirm.length > 0 && deleteConfirm.trim() !== project.name ? 'delete-confirm-input-error' : undefined} onClick={() => void onDelete()}>
                {t('deleteModal.confirm')}
              </Button>
            </>
          }
        >
          <p id="delete-desc" className="modal-copy">
            {t('deleteModal.body', { name: project?.name })}
          </p>
          <div className="dashboard__settings-delete-field">
            <Input
              id="delete-confirm-input"
              label={t('settings.dangerTypeLabel', { defaultValue: 'Project name' })}
              value={deleteConfirm}
              maxLength={FE_LIMITS.PROJECT_NAME}
              placeholder={t('settings.dangerTypePlaceholder', { defaultValue: 'Type the project name to confirm' })}
              error={deleteConfirm.length > 0 && deleteConfirm.trim() !== project.name ? (t('settings.dangerTypeMismatch', { defaultValue: 'Name does not match.' }) as string) : undefined}
              aria-describedby="delete-desc"
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoComplete="off"
            />
          </div>
          {deleteError && <InlineError className="mt-10">{deleteError}</InlineError>}
        </Modal>

        <Modal
          open={archiveConfirm !== null}
          title={archiveConfirm === 'archive' ? t('archiveModal.titleArchive', { name: project.name }) : t('archiveModal.titleRestore', { name: project.name })}
          onClose={() => setArchiveConfirm(null)}
          width="sm"
          footer={
            <>
              <Button variant="ghost" size="md" onClick={() => setArchiveConfirm(null)}>
                {t('archiveModal.cancel')}
              </Button>
              <Button
                variant={archiveConfirm === 'archive' ? 'primary' : 'ghost'}
                size="md"
                leftIcon={archiveConfirm === 'archive' ? <Archive size={14} aria-hidden="true" /> : <ArrowCounterClockwise size={14} aria-hidden="true" />}
                loading={archiving}
                onClick={() => void handleArchiveToggle(archiveConfirm === 'archive' ? 'archived' : 'active')}
              >
                {archiveConfirm === 'archive' ? t('archiveModal.confirmArchive') : t('archiveModal.confirmRestore')}
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            {archiveConfirm === 'archive'
              ? t('archiveModal.bodyArchive')
              : t('archiveModal.bodyRestore')}
          </p>
          {archiveError && <InlineError className="mt-10">{archiveError}</InlineError>}
        </Modal>

        <Modal
          open={importDoc !== null}
          title={t('importModal.title')}
          onClose={() => setImportDoc(null)}
          width="sm"
          footer={
            <>
              <Button variant="ghost" size="md" onClick={() => setImportDoc(null)}>
                {t('importModal.cancel')}
              </Button>
              <Button variant="primary" size="md" leftIcon={<UploadSimple size={14} aria-hidden="true" />} loading={importing} onClick={() => void onConfirmImport()}>
                {t('importModal.confirm')}
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            {importDoc?.meta.projectId === projectId
              ? t('importModal.bodySameProject')
              : t('importModal.bodyOtherProject')}
          </p>
          <p className="modal-copy modal-copy-muted">
            {t('importModal.meta', {
              date: importDoc ? formatDate(importDoc.meta.exportedAt) : '',
              tasks: importDoc ? importDoc.state.tasks.length : 0,
              issues: importDoc ? importDoc.state.issues.length : 0,
            })}
          </p>
          {importError && <InlineError className="mt-10">{importError}</InlineError>}
        </Modal>

        <ShareModal projectId={projectId} open={shareOpen} onClose={() => setShareOpen(false)} />
        <PlanLimitModal
          open={limitOpen}
          resource="projects"
          teamId={project.teamId}
          onClose={() => setLimitOpen(false)}
        />
        <SaveTemplateModal
          open={saveTemplateOpen}
          projectId={projectId}
          projectName={project.name}
          onClose={() => setSaveTemplateOpen(false)}
        />
        {tour.active && (
          <OnboardingWizard
            step={tour.step}
            total={tour.total}
            onNext={() => {
              if (tour.step === 2) {
                tour.goTo(3);
                setTab('board');
                return;
              }
              tour.next();
            }}
            onBack={() => {
              // Back from the first tab step returns to the dashboard
              // project step (sidebar anchor) instead of lingering here.
              if (tour.step === 3) {
                tour.goTo(2);
                navigate('/');
                return;
              }
              tour.back();
            }}
            onSkip={tour.skip}
            onFinish={tour.finish}
            blockReason={null}
          />
        )}
      </div>
    </ProjectProvider>
  );
}
