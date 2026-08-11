import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bug,
  ChartBar,
  Check,
  CheckSquare,
  Columns,
  Copy,
  Database,
  Info,
  Rocket,
  Scales,
  Stack,
  Trash,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { PROJECT_STATUS, TEAM_ROLE } from '../../lib/labels';
import { formatDate } from '../../lib/utils';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { useNavigation } from '../../state/navigation-context';
import { ProjectProvider } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
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
import { InlineError } from '../../components/InlineError';

export type ProjectTab =
  | 'board'
  | 'issues'
  | 'tests'
  | 'stack'
  | 'schema'
  | 'decisions'
  | 'releases'
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
  { id: 'stats', label: 'Stats', icon: <ChartBar size={15} /> },
  { id: 'about', label: 'About', icon: <Info size={15} /> },
];

interface ProjectPageProps {
  projectId: string;
}

export function ProjectPage({ projectId }: ProjectPageProps) {
  const { projects, remove } = useProjects();
  const { openDashboard } = useNavigation();
  const [tab, setTab] = useState<ProjectTab>('board');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { copied, copy } = useCopyFeedback();

  useEffect(() => {
    setTab('board');
  }, [projectId]);

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
    await copy(projectId);
  }

  async function onDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await remove(projectId);
      openDashboard();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete project.');
      setDeleting(false);
    }
  }

  return (
    <ProjectProvider key={projectId} projectId={projectId} role={role}>
      <div className="page">
        <header className="project-header">
          <div className="project-heading">
            <button type="button" className="back-btn" onClick={openDashboard}>
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
                  copied ? (
                    <Check size={12} weight="bold" aria-hidden="true" />
                  ) : (
                    <Copy size={12} aria-hidden="true" />
                  )
                }
                onClick={() => void onCopyProjectId()}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
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
        </header>

        <nav className="tabs" aria-label="Project sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <SaveBanner />

        <section className="tab-panel">
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
          {deleteError && <InlineError style={{ marginTop: 10 }}>{deleteError}</InlineError>}
        </Modal>
      </div>
    </ProjectProvider>
  );
}
