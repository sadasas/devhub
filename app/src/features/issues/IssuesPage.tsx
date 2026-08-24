import { useState } from 'react';
import { Bug, PencilSimple, Plus } from '@phosphor-icons/react';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { ISSUE_SEVERITY, ISSUE_STATUS } from '../../lib/labels';
import { applySort, type SortSpec } from '../../lib/sort';
import { shortId } from '../../lib/utils';
import type { Issue } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PinButton } from '../../components/PinButton';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { IssueModal } from './IssueModal';
import { NewIssueModal } from './NewIssueModal';
import { InlineError } from '../../components/InlineError';

const ISSUE_SORT_SPECS: SortSpec<Issue>[] = [
  {
    key: 'severity',
    label: 'Severity',
    get: (i) => i.severity,
    order: ['critical', 'high', 'medium', 'low'],
  },
  {
    key: 'status',
    label: 'Status',
    get: (i) => i.status,
    order: ['open', 'reproduced', 'fixing', 'resolved', 'wontfix'],
  },
  { key: 'title', label: 'Title', get: (i) => i.title },
];

export function IssuesPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { state, loading, error, canEdit, dispatch } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEntityDeepLink('issues', setEditingId);
  useNewParam(() => setCreating(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };

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

  const sortSpec = ISSUE_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const issues = applySort(state.issues, sortSpec, effectiveSort.dir, (i) => !!i.pinned);

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
        </span>
        <span className="data-list-actions">
          <SortControl
            options={ISSUE_SORT_SPECS.map((s) => ({ value: s.key, label: s.label }))}
            value={effectiveSort}
            onChange={setSort}
          />
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
              New issue
            </Button>
          )}
        </span>
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
                    {unreadIds?.has(issue.id) && (
                      <>
                        <span className="unread-dot" aria-hidden="true" />
                        <span className="sr-only">Unread</span>
                      </>
                    )}
                  </div>
                </button>
                <div className="data-row-side">
                  <Badge tone={ISSUE_STATUS[issue.status].tone}>{ISSUE_STATUS[issue.status].label}</Badge>
                  {canEdit && (
                    <PinButton
                      pinned={!!issue.pinned}
                      label="issue"
                      onToggle={() =>
                        dispatch({
                          type: 'issue/update',
                          id: issue.id,
                          patch: { pinned: !issue.pinned },
                        })
                      }
                    />
                  )}
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
