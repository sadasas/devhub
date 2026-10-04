import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ProjectProvider, useProject } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import { projectStorage } from '../project/ProjectPage';
import { TaskDetail } from './TaskDetail';
import { Skeleton } from '../../components/Skeleton';
import { FOCUS_MODE_FLAG, track, useFeatureFlag } from '../../lib/analytics';

function FocusLoading() {
  return (
    <div className="page">
      <Skeleton style={{ width: 280, height: 28, marginTop: 8 }} />
      <Skeleton style={{ width: '100%', height: 24, marginTop: 16 }} />
      <Skeleton style={{ width: '100%', height: 180, marginTop: 24 }} />
    </div>
  );
}

function FocusTask({ projectId }: { projectId: string }) {
  const { taskId = '' } = useParams<{ projectId: string; taskId: string }>();
  const { state } = useProject();
  const navigate = useNavigate();
  const enabled = useFeatureFlag(FOCUS_MODE_FLAG, true);
  useEffect(() => {
    if (enabled === false) return;
    if (state === null) return;
    const found = state.tasks.find((t) => t.id === taskId);
    if (!found) return;
    track('focus_page_view', { taskId: found.id });
  }, [taskId, state, enabled]);
  if (state === null) return <FocusLoading />;
  if (enabled === false) return <Navigate to={`/project/${projectId}`} replace />;
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return <Navigate to={`/project/${projectId}`} replace />;
  const back = () => navigate(`/project/${projectId}`);
  return (
    <TaskDetail
      variant="page"
      taskId={task.id}
      onClose={back}
      onNavigate={(id) => navigate(`/project/${projectId}/focus/${id}`)}
    />
  );
}

export function FocusPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { projects } = useProjects();
  if (projects === null) return <FocusLoading />;
  const project = projects.find((p) => p.id === projectId);
  if (!project) return <Navigate to="/" replace />;
  return (
    <ProjectProvider
      key={projectId}
      projectId={projectId}
      role={project.role}
      teamId={project.teamId}
      isArchived={project.status === 'archived'}
      provider={projectStorage}
    >
      <FocusTask projectId={projectId} />
    </ProjectProvider>
  );
}
