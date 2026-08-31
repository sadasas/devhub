import { lazy, Suspense, useRef, useState } from 'react';
import {
  Archive,
  ArrowCounterClockwise,
  ArrowLeft,
  BookmarkSimple,
  Bug,
  Check,
  CheckSquare,
  ChalkboardSimple,
  Columns,
  Copy,
  Database,
  DownloadSimple,
  Gauge,
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
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import { offlineProvider } from '../../lib/idb-provider';
import { PROJECT_STATUS, TEAM_ROLE } from '../../lib/labels';
import { formatDate } from '../../lib/utils';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { usePresenceStatus, viewingStatus } from '../../hooks/usePresenceStatus';
import { useTabShortcuts } from '../../hooks/useTabShortcuts';
import { useNewItemShortcut } from '../../hooks/useNewItemShortcut';
import { ProjectProvider } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import { useAuth } from '../../state/auth-context';
import type { ExportDocument, Project } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { SaveBanner } from '../../components/SaveBanner';
import { Skeleton } from '../../components/Skeleton';
import { SyncStatusChip } from '../../components/SyncStatusChip';
import { PresenceChip } from '../../components/PresenceChip';
import { ShareModal } from './ShareModal';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { InlineError } from '../../components/InlineError';
import { SaveTemplateModal } from '../templates/SaveTemplateModal';
import { ProjectTabNav } from './ProjectTabNav';
import { DeletedItemsBanner } from './DeletedItemsBanner';
import { ArchivedBanner } from './ArchivedBanner';
import { ArchiveUndoToast } from './ArchiveUndoToast';
import { useTabUnread } from '../../hooks/useTabUnread';

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
      <div className="kanban" aria-hidden="true">
        {['skeleton.todo', 'skeleton.inProgress', 'skeleton.review', 'skeleton.done'].map((key) => (
          <div key={key} className="kanban-col">
            <div className="kanban-col-header">
              <span>{t(key)}</span>
            </div>
            <div className="kanban-col-body">
              <Skeleton style={{ height: 84, width: '100%' }} />
              <Skeleton style={{ height: 84, width: '100%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'whiteboard') {
    return (
      <div className="project-grid" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="project-card">
            <Skeleton className="skeleton-row" />
            <Skeleton className="skeleton-row skeleton-row-sm" />
            <Skeleton className="skeleton-row skeleton-row-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'overview') {
    return (
      <div aria-hidden="true">
        <Skeleton style={{ width: 220, height: 20, marginBottom: 16 }} />
        <Skeleton style={{ width: '100%', height: 14, marginBottom: 8 }} />
        <Skeleton style={{ width: '70%', height: 14, marginBottom: 24 }} />
        <div className="stats-grid">
          <Skeleton className="data-row" />
          <Skeleton className="data-row" />
          <Skeleton className="data-row" />
          <Skeleton className="data-row" />
        </div>
        <Skeleton style={{ width: '100%', height: 200, marginTop: 22 }} />
      </div>
    );
  }

  if (tab === 'api') {
    return (
      <div aria-hidden="true">
        <div className="data-list">
          <div className="data-row">
            <Skeleton style={{ height: 16, width: '70%' }} />
          </div>
          <div className="data-row">
            <Skeleton style={{ height: 16, width: '50%' }} />
          </div>
        </div>
        <Skeleton style={{ height: 320, width: '100%' }} />
      </div>
    );
  }

  return (
    <div className="data-list" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="data-row">
          <div className="data-row-main">
            <Skeleton className="skeleton-row" />
            <Skeleton className="skeleton-row skeleton-row-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectPresenceStatus({ tab }: { tab: ProjectTab }) {
  usePresenceStatus(viewingStatus(tab));
  return null;
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
      >
        <Suspense fallback={<TabSkeleton tab={tab} />}>
          {tab === 'board' ? (
            <BoardPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
          ) : tab === 'issues' ? (
            <IssuesPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
          ) : tab === 'tests' ? (
            <TestsPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
          ) : tab === 'stack' ? (
            <StackPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
          ) : tab === 'schema' ? (
            <SchemaPageLazy unreadIds={(unreadIds as Record<string, { new: ReadonlySet<string> }>)[tab]?.new} />
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
      </section>
    </>
  );
}

export function ProjectPage() {
  const { t } = useTranslation('project');
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { projects, refresh, remove, update } = useProjects();
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
  const project = projects?.find((p) => p.id === projectId);
  useTabShortcuts(TABS.map((t) => t.id), tab, setTab);
  useNewItemShortcut(tab, project?.role !== undefined && project.role !== 'viewer' && project?.status !== 'archived', (activeTab, value) => {
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
  const [archiveConfirm, setArchiveConfirm] = useState<null | 'archive' | 'restore'>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<null | 'archived' | 'restored'>(null);
  const [importDoc, setImportDoc] = useState<ExportDocument | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { copied: pidCopied, copy: copyPid } = useCopyFeedback();

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

  async function onCopyProjectId() {
    await copyPid(projectId);
  }

  async function onExport() {
    if (!project) return;
    try {
      const doc = await api.exportProjectDoc(projectId);
      const safeName = project.name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase() || 'project';
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devhub-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDeleteError(getErrorMessage(err, t('errors.exportFailed')));
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
        <header className="project-header">
          <div className="project-heading">
            <button type="button" className="back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={14} aria-hidden="true" />
              {t('page.backToProjects')}
            </button>
            <div className="project-actions">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<DownloadSimple size={13} aria-hidden="true" />}
                onClick={() => void onExport()}
              >
                {t('actions.export')}
              </Button>
              {role !== 'viewer' && !isArchived && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<UploadSimple size={13} aria-hidden="true" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t('actions.import')}
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ShareNetwork size={13} aria-hidden="true" />}
                  onClick={() => setShareOpen(true)}
                >
                  {project.visibility === 'public' ? t('actions.sharePublic') : t('actions.sharePrivate')}
                </Button>
              )}
              {role !== 'viewer' && !isArchived && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<BookmarkSimple size={13} aria-hidden="true" />}
                  onClick={() => setSaveTemplateOpen(true)}
                >
                  {t('actions.saveAsTemplate')}
                </Button>
              )}
              {canArchive && !isArchived && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Archive size={13} aria-hidden="true" />}
                  onClick={() => setArchiveConfirm('archive')}
                  aria-label={`Archive ${project.name}`}
                >
                  Archive
                </Button>
              )}
              {canArchive && isArchived && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<ArrowCounterClockwise size={13} aria-hidden="true" />}
                  onClick={() => setArchiveConfirm('restore')}
                  aria-label={`Restore ${project.name}`}
                >
                  Restore
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash size={13} aria-hidden="true" />}
                  onClick={() => setConfirmOpen(true)}
                >
                  {t('actions.delete')}
                </Button>
              )}
            </div>

            <div className="project-title-row">
              <h1 className="page-title">{project.name}</h1>
              <Badge tone={TEAM_ROLE[role].tone}>{TEAM_ROLE[role].label}</Badge>
              <Badge tone={PROJECT_STATUS[project.status].tone}>
                {PROJECT_STATUS[project.status].label}
              </Badge>
              <SyncStatusChip />
              <PresenceChip />
            </div>
            <p className="page-subtitle">
              {t('page.createdInfo', {
                description: project.description || t('page.noDescription'),
                date: formatDate(project.createdAt),
              })}
            </p>
            <div className="project-id-row">
              <code className="project-id-code">{projectId}</code>
              <Button
                variant="ghost"
                size="sm"
                className="project-id-copy"
                leftIcon={
                  pidCopied ? (
                    <Check size={12} weight="bold" aria-hidden="true" />
                  ) : (
                    <Copy size={12} aria-hidden="true" />
                  )
                }
                onClick={() => void onCopyProjectId()}
              >
                {pidCopied ? t('actions.copied') : t('actions.copy')}
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onImportFile}
          />
        </header>

        {isArchived && (
          <ArchivedBanner
            canRestore={canArchive}
            restoring={archiving}
            onRestore={canArchive ? () => setArchiveConfirm('restore') : undefined}
          />
        )}

        <ProjectUnreadArea
          projectId={projectId}
          userId={user?.id ?? ''}
          tab={tab}
          onSelect={setTab}
          project={project}
        />

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

        <Modal
          open={confirmOpen}
          title={t('deleteModal.title')}
          onClose={() => setConfirmOpen(false)}
          width="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                {t('deleteModal.cancel')}
              </Button>
              <Button variant="danger" loading={deleting} onClick={() => void onDelete()}>
                {t('deleteModal.confirm')}
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            {t('deleteModal.body', { name: project?.name })}
          </p>
          {deleteError && <InlineError className="mt-10">{deleteError}</InlineError>}
        </Modal>

        <Modal
          open={archiveConfirm !== null}
          title={archiveConfirm === 'archive' ? `Archive “${project.name}”?` : `Restore “${project.name}”?`}
          onClose={() => setArchiveConfirm(null)}
          width="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setArchiveConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant={archiveConfirm === 'archive' ? 'primary' : 'ghost'}
                loading={archiving}
                onClick={() => void handleArchiveToggle(archiveConfirm === 'archive' ? 'archived' : 'active')}
              >
                {archiveConfirm === 'archive' ? 'Archive' : 'Restore'}
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            {archiveConfirm === 'archive'
              ? 'Project will become read-only and hidden from Active view. You can restore anytime.'
              : 'Project will become editable again.'}
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
              <Button variant="ghost" onClick={() => setImportDoc(null)}>
                {t('importModal.cancel')}
              </Button>
              <Button variant="primary" loading={importing} onClick={() => void onConfirmImport()}>
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
      </div>
    </ProjectProvider>
  );
}
