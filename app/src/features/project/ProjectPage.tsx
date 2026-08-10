import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bug,
  ChartBar,
  Check,
  CheckSquare,
  Columns,
  Copy,
  Database,
  Rocket,
  Scales,
  Stack,
  Trash,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { PROJECT_STATUS } from '../../lib/labels';
import { copyText, formatDate } from '../../lib/utils';
import { useNavigation } from '../../state/navigation-context';
import { ProjectProvider } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { BoardPage } from '../board/BoardPage';
import { DecisionsPage } from '../decisions/DecisionsPage';
import { IssuesPage } from '../issues/IssuesPage';
import { ReleasesPage } from '../releases/ReleasesPage';
import { SchemaPage } from '../schema/SchemaPage';
import { StackPage } from '../stack/StackPage';
import { StatsPage } from '../stats/StatsPage';
import { TestsPage } from '../tests/TestsPage';

export type ProjectTab = 'board' | 'issues' | 'tests' | 'stack' | 'schema' | 'decisions' | 'releases' | 'stats';

const TABS: { id: ProjectTab; label: string; icon: ReactNode }[] = [
  { id: 'board', label: 'Board', icon: <Columns size={15} /> },
  { id: 'issues', label: 'Issues', icon: <Bug size={15} /> },
  { id: 'tests', label: 'Test Cases', icon: <CheckSquare size={15} /> },
  { id: 'stack', label: 'Stack', icon: <Stack size={15} /> },
  { id: 'schema', label: 'Schema', icon: <Database size={15} /> },
  { id: 'decisions', label: 'Decisions', icon: <Scales size={15} /> },
  { id: 'releases', label: 'Releases', icon: <Rocket size={15} /> },
  { id: 'stats', label: 'Stats', icon: <ChartBar size={15} /> },
];

const TAB_BLURBS: Record<ProjectTab, string> = {
  board: 'Drag tasks between stages, track dependencies.',
  issues: 'Log bugs with severity and reproduction steps.',
  tests: 'Keep a checklist of manual test cases.',
  stack: 'Ledger of the tech stack and dependency status.',
  schema: 'Database tables, columns, relations and a visual ERD.',
  decisions: 'Architecture Decision Records (ADRs).',
  releases: 'Milestones, versions and changelogs.',
  stats: 'Charts: velocity, estimates vs actuals, issues.',
};

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
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const project = projects?.find((p) => p.id === projectId);

  async function onCopyProjectId() {
    const ok = await copyText(projectId);
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
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
    <ProjectProvider key={projectId} projectId={projectId}>
      <div className="page">
        <header className="project-header">
          <div className="project-heading">
            <button type="button" className="back-btn" onClick={openDashboard}>
              <ArrowLeft size={14} aria-hidden="true" />
              Projects
            </button>
            {project ? (
              <div className="project-title-row">
                <h1 className="page-title">{project.name}</h1>
                <Badge tone={PROJECT_STATUS[project.status].tone}>
                  {PROJECT_STATUS[project.status].label}
                </Badge>
              </div>
            ) : (
              <Skeleton style={{ width: 200, height: 24, marginTop: 8 }} />
            )}
            <p className="page-subtitle">
              {project ? (
                <>
                  {project.description || 'No description.'} · created {formatDate(project.createdAt)}
                </>
              ) : (
                ' '
              )}
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
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash size={13} aria-hidden="true" />}
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
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
          ) : (
            <EmptyState
              icon={TABS.find((t) => t.id === tab)?.icon ?? <Columns size={22} />}
              title={TABS.find((t) => t.id === tab)?.label ?? tab}
              description={TAB_BLURBS[tab]}
            />
          )}
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
          {deleteError && (
            <p className="field-error" role="alert" style={{ marginTop: 10 }}>
              {deleteError}
            </p>
          )}
        </Modal>
      </div>
    </ProjectProvider>
  );
}
