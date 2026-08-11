import { useState } from 'react';
import { PencilSimple } from '@phosphor-icons/react';
import type { Project, ProjectPrd } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { useProjects } from '../../state/projects-context';
import { formatDate } from '../../lib/utils';
import { PROJECT_STATUS, TEAM_ROLE } from '../../lib/labels';
import { computeProjectStats } from '../../lib/stats';
import { ApiError } from '../../lib/api';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { Textarea } from '../../components/Textarea';

const PRD_SECTIONS: { key: keyof ProjectPrd; label: string; helper: string }[] = [
  {
    key: 'purpose',
    label: 'Purpose',
    helper: 'Why this project exists — the problem it solves.',
  },
  {
    key: 'goals',
    label: 'Goals',
    helper: 'What success looks like. One line per goal.',
  },
  {
    key: 'features',
    label: 'Features',
    helper: 'What this project will do. One feature per line.',
  },
  {
    key: 'scope',
    label: 'Scope',
    helper: 'What is in scope for this project.',
  },
  {
    key: 'outOfScope',
    label: 'Out of scope',
    helper: 'What is explicitly out of scope — for now or forever.',
  },
];

const EMPTY_PRD: ProjectPrd = { purpose: '', goals: '', features: '', scope: '', outOfScope: '' };

export function AboutPage({ project }: { project: Project }) {
  const { state, loading, error, canEdit } = useProject();
  const { update } = useProjects();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectPrd>(project.prd);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEdit() {
    setDraft({ ...EMPTY_PRD, ...project.prd });
    setSaveError(null);
    setEditing(true);
  }

  async function save() {
    setSaveError(null);
    setSaving(true);
    try {
      await update(project.id, { prd: draft });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

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
        <span className="data-list-count">About this project</span>
        {canEdit && !editing && (
          <Button
            size="sm"
            leftIcon={<PencilSimple size={13} aria-hidden="true" />}
            onClick={startEdit}
          >
            Edit PRD
          </Button>
        )}
      </div>

      <p className="about-description">{project.description || 'No description yet.'}</p>
      <p className="about-meta">
        <span>Team: {project.teamName}</span>
        <span>Created {formatDate(project.createdAt)}</span>
        <span>Updated {formatDate(project.updatedAt)}</span>
        <span>
          <Badge tone={PROJECT_STATUS[project.status].tone}>{PROJECT_STATUS[project.status].label}</Badge>
          <Badge tone={TEAM_ROLE[project.role].tone}>{TEAM_ROLE[project.role].label}</Badge>
        </span>
      </p>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {counts.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="stat-card-head">
              <span className="stat-card-title">{c.label}</span>
              <span className="stat-card-value">{c.value}</span>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <form
          className="about-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {PRD_SECTIONS.map((s) => (
            <Textarea
              key={s.key}
              label={s.label}
              helper={s.helper}
              value={draft[s.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
            />
          ))}
          {saveError && <InlineError>{saveError}</InlineError>}
          <div className="about-actions">
            <Button type="submit" loading={saving}>
              Save PRD
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setSaveError(null);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {PRD_SECTIONS.map((s) => {
            const value = project.prd[s.key];
            return (
              <section key={s.key} className="about-section">
                <h3 className="about-section-title">{s.label}</h3>
                <p className={`about-section-body${value ? '' : ' about-section-body-empty'}`}>
                  {value || 'Not set yet.'}
                </p>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
