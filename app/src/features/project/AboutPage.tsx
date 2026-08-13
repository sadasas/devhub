import { useState } from 'react';
import { PencilSimple } from '@phosphor-icons/react';
import type { Project } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { formatDate } from '../../lib/utils';
import { PROJECT_STATUS, TEAM_ROLE } from '../../lib/labels';
import { computeProjectStats } from '../../lib/stats';
import { PRD_SECTIONS } from '../../lib/prd';
import { MarkdownBlocks, renderInline } from '../../lib/markdown';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { EditPrdModal } from './EditPrdModal';

export function AboutPage({ project }: { project: Project }) {
  const { state, loading, error, canEdit } = useProject();
  const [editOpen, setEditOpen] = useState(false);

  if (loading) {
    return (
      <div aria-hidden="true">
        <Skeleton style={{ width: 220, height: 20, marginBottom: 16 }} />
        <Skeleton style={{ width: '100%', height: 14, marginBottom: 8 }} />
        <Skeleton style={{ width: '70%', height: 14, marginBottom: 24 }} />
        <Skeleton style={{ width: '100%', height: 120 }} />
      </div>
    );
  }

  if (error) {
    return <InlineError>{error}</InlineError>;
  }

  if (!state) return null;

  const stats = computeProjectStats(state);
  const counts = [
    { label: 'Tasks', value: state.tasks.length },
    { label: 'Open issues', value: stats.openIssues },
    { label: 'Test cases', value: state.testCases.length },
    { label: 'Stack entries', value: state.techEntries.length },
    { label: 'Tables', value: state.tables.length },
    { label: 'Decisions', value: state.decisions.length },
    { label: 'Milestones', value: state.milestones.length },
  ];

  return (
    <div className="about-body">
      <div className="data-list-header">
        <span className="data-list-count">About</span>
        {canEdit && (
          <Button
            size="sm"
            leftIcon={<PencilSimple size={13} aria-hidden="true" />}
            onClick={() => setEditOpen(true)}
          >
            Edit PRD
          </Button>
        )}
      </div>

      <div className="about-hero">
        <p className={`about-description${project.description.trim() ? '' : ' about-description-empty'}`}>
          {project.description.trim() ? renderInline(project.description) : 'No description yet.'}
        </p>
        <p className="about-meta">
          <span className="about-meta-chip">Team: {project.teamName}</span>
          <span className="about-meta-chip">Created {formatDate(project.createdAt)}</span>
          <span className="about-meta-chip">Updated {formatDate(project.updatedAt)}</span>
          <span className="about-meta-chip">
            <Badge tone={PROJECT_STATUS[project.status].tone}>{PROJECT_STATUS[project.status].label}</Badge>
          </span>
          <span className="about-meta-chip">
            <Badge tone={TEAM_ROLE[project.role].tone}>{TEAM_ROLE[project.role].label}</Badge>
          </span>
        </p>
      </div>

      <div className="about-stats">
        {counts.map((c) => (
          <div key={c.label} className="about-stat">
            <span className="about-stat-title">{c.label}</span>
            <span className="about-stat-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="about-cards">
        {PRD_SECTIONS.map((s) => {
          const value = project.prd[s.key];
          return (
            <section key={s.key} className="about-card">
              <h3 className="about-card-head">
                <s.icon size={14} weight="bold" aria-hidden="true" />
                <span className="about-card-title">{s.label}</span>
              </h3>
              {value.trim() ? (
                <div className="about-card-body">
                  <MarkdownBlocks text={value} />
                </div>
              ) : (
                <p className="about-card-empty">Not set yet.</p>
              )}
            </section>
          );
        })}
      </div>

      <EditPrdModal open={editOpen} onClose={() => setEditOpen(false)} project={project} />
    </div>
  );
}