import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ProjectProvider, useProject } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import { projectStorage } from '../project/ProjectPage';
import { FocusTaskDetail } from './FocusTaskDetail';
import { Skeleton } from '../../components/Skeleton';
import { FOCUS_MODE_FLAG, track, useFeatureFlag } from '../../lib/analytics';

/** Skeleton mirror konten FocusTaskDetail: topbar (back|pill|done),
    judul 28 + meta + deskripsi, subtask, checklist, attachments,
    10 baris properti label 110 + value pill. Ritme gap reuse kelas asli. */
const PROPS_SKELETON_WIDTHS = [96, 120, 150, 130, 110, 140, 60, 150, 80, 90];

function FocusLoading() {
  return (
    <div className="page">
      <div
        className="focus-topbar"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 8,
          padding: '8px 0',
          marginBottom: 16,
        }}
      >
        <Skeleton style={{ width: 72, height: 28, borderRadius: 8, justifySelf: 'start' }} />
        <Skeleton style={{ width: 400, maxWidth: '100%', height: 40, borderRadius: 999, justifySelf: 'center' }} />
        <Skeleton style={{ width: 96, height: 28, borderRadius: 8, justifySelf: 'end' }} />
      </div>
      <div className="detail-grid">
        <div className="detail-main focus-detail">
          <div className="focus-detail-head">
            <Skeleton style={{ width: '60%', height: 28 }} />
            <div className="focus-detail-meta">
              <Skeleton style={{ width: 84, height: 24, borderRadius: 999 }} />
              <Skeleton style={{ width: 180, height: 12 }} />
            </div>
            <Skeleton style={{ width: '85%', height: 13 }} />
          </div>
          <div className="focus-detail-check">
            <Skeleton style={{ width: 130, height: 14 }} />
            <Skeleton style={{ width: '100%', height: 46, borderRadius: 8 }} />
            <Skeleton style={{ width: '100%', height: 46, borderRadius: 8 }} />
          </div>
          <div className="focus-detail-check">
            <Skeleton style={{ width: 130, height: 14 }} />
            <Skeleton style={{ width: '100%', height: 4, borderRadius: 999 }} />
            <Skeleton style={{ width: '100%', height: 28 }} />
            <Skeleton style={{ width: '100%', height: 28 }} />
          </div>
          <div className="focus-detail-check">
            <Skeleton style={{ width: 150, height: 14 }} />
            <Skeleton style={{ width: '100%', height: 52, borderRadius: 8 }} />
          </div>
          <div className="focus-detail-propswrap">
            <Skeleton style={{ width: 110, height: 12 }} />
            <div className="focus-detail-props">
              {PROPS_SKELETON_WIDTHS.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Skeleton style={{ width: 110, height: 12 }} />
                  <Skeleton style={{ width: w, height: 24, borderRadius: 999 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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
    <FocusTaskDetail
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
