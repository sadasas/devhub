import { useState } from 'react';
import { Bug, PencilSimple, Plus } from '@phosphor-icons/react';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { ISSUE_SEVERITY, ISSUE_STATUS } from '../../lib/labels';
import { shortId } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { IssueModal } from './IssueModal';
import { NewIssueModal } from './NewIssueModal';
import { InlineError } from '../../components/InlineError';

export function IssuesPage() {
  const { state, loading, error, canEdit } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEntityDeepLink('issues', setEditingId);

  if (loading) {
    return (
      <div className="data-list" aria-hidden="true">
        <div className="data-row">
          <Skeleton style={{ height: 16, width: '60%' }} />
        </div>
        <div className="data-row">
          <Skeleton style={{ height: 16, width: '45%' }} />
        </div>
        <div className="data-row">
          <Skeleton style={{ height: 16, width: '70%' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <InlineError>
        {error}
      </InlineError>
    );
  }

  if (!state) return null;

  const issues = state.issues;

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
        </span>
        {canEdit && (
          <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
            New issue
          </Button>
        )}
      </div>

      {issues.length === 0 ? (
        <EmptyState
          icon={<Bug size={22} />}
          title="No issues yet"
          description="Log bugs with a severity level and reproduction steps so they don't get lost."
          action={
            canEdit && (
              <Button leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
                Log an issue
              </Button>
            )
          }
        />
      ) : (
        <div className="data-list">
          {issues.map((issue) => {
            const linked = issue.linkedTaskId
              ? state.tasks.find((t) => t.id === issue.linkedTaskId)
              : undefined;
return (
              <div key={issue.id} className="data-row">
                <button
                  type="button"
                  className="data-row-main"
                  onClick={() => setEditingId(issue.id)}
                >
                  <div className="data-row-title">
                    <Badge tone={ISSUE_SEVERITY[issue.severity].tone}>
                      {ISSUE_SEVERITY[issue.severity].label}
                    </Badge>
                    <span className="row-title-text">{issue.title}</span>
                  </div>
                  {issue.description && <div className="data-row-sub">{issue.description}</div>}
                  {issue.reproduction && <div className="data-row-sub">{issue.reproduction}</div>}
                  <div className="data-row-meta">
                    {linked && <span>linked: {linked.title}</span>}
                    <span>#{shortId(issue.id)}</span>
                  </div>
                </button>
                <div className="data-row-side">
                  <Badge tone={ISSUE_STATUS[issue.status].tone}>{ISSUE_STATUS[issue.status].label}</Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-icon"
                      aria-label="Edit issue"
                      onClick={() => setEditingId(issue.id)}
                    >
                      <PencilSimple size={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewIssueModal open={creating} onClose={() => setCreating(false)} />
      <IssueModal issueId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}
