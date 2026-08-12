import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Bug,
  ChartBar,
  Check,
  CheckSquare,
  Columns,
  Copy,
  Database,
  DownloadSimple,
  GlobeSimple,
  Info,
  LinkSimple,
  Plugs,
  Rocket,
  Scales,
  Stack,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError, api } from '../../lib/api';
import { PROJECT_STATUS, TEAM_ROLE } from '../../lib/labels';
import { formatDate } from '../../lib/utils';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { ProjectProvider } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import type { ExportDocument } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { SaveBanner } from '../../components/SaveBanner';
import { Skeleton } from '../../components/Skeleton';
import { BoardPage } from '../board/BoardPage';
import { DecisionsPage } from '../decisions/DecisionsPage';
import { IssuesPage } from '../issues/IssuesPage';
import { ReleasesPage } from '../releases/ReleasesPage';
import { SchemaPage } from '../schema/SchemaPage';
import { StackPage } from '../stack/StackPage';
import { StatsPage } from '../stats/StatsPage';
import { TestsPage } from '../tests/TestsPage';
import { AboutPage } from './AboutPage';
import { ApiPage } from '../api/ApiPage';
import { InlineError } from '../../components/InlineError';

export type ProjectTab =
  | 'board'
  | 'issues'
  | 'tests'
  | 'stack'
  | 'schema'
  | 'decisions'
  | 'releases'
  | 'api'
  | 'stats'
  | 'about';

const TABS: { id: ProjectTab; label: string; icon: ReactNode }[] = [
  { id: 'board', label: 'Board', icon: <Columns size={15} /> },
  { id: 'issues', label: 'Issues', icon: <Bug size={15} /> },
  { id: 'tests', label: 'Test Cases', icon: <CheckSquare size={15} /> },
  { id: 'stack', label: 'Stack', icon: <Stack size={15} /> },
  { id: 'schema', label: 'Schema', icon: <Database size={15} /> },
  { id: 'decisions', label: 'Decisions', icon: <Scales size={15} /> },
  { id: 'releases', label: 'Releases', icon: <Rocket size={15} /> },
  { id: 'api', label: 'API', icon: <Plugs size={15} /> },
  { id: 'stats', label: 'Stats', icon: <ChartBar size={15} /> },
  { id: 'about', label: 'About', icon: <Info size={15} /> },
];

export function ProjectPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { projects, refresh, remove, update } = useProjects();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: ProjectTab = TABS.some((t) => t.id === tabParam) ? (tabParam as ProjectTab) : 'board';
  const setTab = (next: ProjectTab) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', next);
        return p;
      },
      { replace: true },
    );
  };
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importDoc, setImportDoc] = useState<ExportDocument | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { copied: pidCopied, copy: copyPid } = useCopyFeedback();
  const { copied: linkCopied, copy: copyLink } = useCopyFeedback();
  const [toggling, setToggling] = useState(false);

  const project = projects?.find((p) => p.id === projectId);

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
              title="Project not found"
              description="It may have been deleted, or you may not have access to it."
            />
          </div>
        )}
      </div>
    );
  }

  const role = project.role;
  const isAdmin = role === 'owner' || role === 'admin';

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
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to export project.');
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
          setImportError('Not a valid DevHub export document.');
          setImportDoc(null);
          return;
        }
        setImportError(null);
        setImportDoc(doc);
      } catch {
        setImportError('Could not parse the selected file as JSON.');
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
      setImportError(err instanceof ApiError ? err.message : 'Failed to import project.');
      setImporting(false);
    }
  }

  async function onDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await remove(projectId);
      navigate('/');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete project.');
      setDeleting(false);
    }
  }

  async function onToggleVisibility() {
    if (!project) return;
    setToggleError(null);
    setToggling(true);
    try {
      const visibility = project.visibility === 'public' ? 'private' : 'public';
      await update(projectId, { visibility });
    } catch (err) {
      setToggleError(err instanceof ApiError ? err.message : 'Failed to update visibility.');
    } finally {
      setToggling(false);
    }
  }

  async function onCopyPublicLink() {
    if (!project) return;
    await copyLink(`${window.location.origin}/p/${projectId}`);
  }

  return (
    <ProjectProvider key={projectId} projectId={projectId} role={role}>
      <div className="page">
        <header className="project-header">
          <div className="project-heading">
            <button type="button" className="back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={14} aria-hidden="true" />
              Projects
            </button>
            <div className="project-title-row">
              <h1 className="page-title">{project.name}</h1>
              <Badge tone={TEAM_ROLE[role].tone}>{TEAM_ROLE[role].label}</Badge>
              <Badge tone={PROJECT_STATUS[project.status].tone}>
                {PROJECT_STATUS[project.status].label}
              </Badge>
            </div>
            <p className="page-subtitle">
              {project.description || 'No description.'} · created {formatDate(project.createdAt)}
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
                {pidCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <div className="project-actions">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<DownloadSimple size={13} aria-hidden="true" />}
              onClick={() => void onExport()}
            >
              Export
            </Button>
            {role !== 'viewer' && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<UploadSimple size={13} aria-hidden="true" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Import
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                disabled={toggling}
                leftIcon={<GlobeSimple size={13} aria-hidden="true" />}
                onClick={() => void onToggleVisibility()}
              >
                {project.visibility === 'public' ? 'Public' : 'Private'}
              </Button>
            )}
            {isAdmin && project.visibility === 'public' && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={
                  linkCopied ? (
                    <Check size={12} weight="bold" aria-hidden="true" />
                  ) : (
                    <LinkSimple size={13} aria-hidden="true" />
                  )
                }
                onClick={() => void onCopyPublicLink()}
              >
                {linkCopied ? 'Copied' : 'Copy link'}
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash size={13} aria-hidden="true" />}
                onClick={() => setConfirmOpen(true)}
              >
                Delete
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onImportFile}
          />
        </header>

        {toggleError && <InlineError>{toggleError}</InlineError>}

        <nav className="tabs" role="tablist" aria-label="Project sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`project-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="project-tabpanel"
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <SaveBanner />

        <section
          className="tab-panel"
          role="tabpanel"
          id="project-tabpanel"
          aria-labelledby={`project-tab-${tab}`}
          tabIndex={0}
        >
          {tab === 'board' ? (
            <BoardPage />
          ) : tab === 'issues' ? (
            <IssuesPage />
          ) : tab === 'tests' ? (
            <TestsPage />
          ) : tab === 'stack' ? (
            <StackPage />
          ) : tab === 'schema' ? (
            <SchemaPage />
          ) : tab === 'decisions' ? (
            <DecisionsPage />
          ) : tab === 'releases' ? (
            <ReleasesPage />
          ) : tab === 'api' ? (
            <ApiPage projectName={project.name} projectDescription={project.description ?? ''} />
          ) : tab === 'stats' ? (
            <StatsPage />
          ) : tab === 'about' ? (
            <AboutPage project={project} />
          ) : null}
        </section>

        <Modal
          open={confirmOpen}
          title="Delete project"
          onClose={() => setConfirmOpen(false)}
          width="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={() => void onDelete()}>
                Delete
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            This permanently deletes “{project?.name}” and all of its data — tasks, issues, schema,
            decisions. This cannot be undone.
          </p>
          {deleteError && <InlineError className="mt-10">{deleteError}</InlineError>}
        </Modal>

        <Modal
          open={importDoc !== null}
          title="Import project backup"
          onClose={() => setImportDoc(null)}
          width="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setImportDoc(null)}>
                Cancel
              </Button>
              <Button variant="primary" loading={importing} onClick={() => void onConfirmImport()}>
                Import
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            {importDoc?.meta.projectId === projectId
              ? 'This backup belongs to the current project. Importing will overwrite its current data with the backup.'
              : 'This backup belongs to a different project. Importing will create a new project from this data.'}
          </p>
          <p className="modal-copy modal-copy-muted">
            Backed up {importDoc ? formatDate(importDoc.meta.exportedAt) : ''} ·{' '}
            {importDoc ? importDoc.state.tasks.length : 0} tasks,{' '}
            {importDoc ? importDoc.state.issues.length : 0} issues
          </p>
          {importError && <InlineError className="mt-10">{importError}</InlineError>}
        </Modal>
      </div>
    </ProjectProvider>
  );
}
