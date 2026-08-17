import { useState } from 'react';
import { CheckSquare, PencilSimple, Plus } from '@phosphor-icons/react';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { TEST_CASE_STATUS } from '../../lib/labels';
import { shortId } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { NewTestModal } from './NewTestModal';
import { TestModal } from './TestModal';
import { InlineError } from '../../components/InlineError';

export function TestsPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { state, loading, error, canEdit } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEntityDeepLink('testCases', setEditingId);
  useNewParam(() => setCreating(true), '1', canEdit);

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

  const tests = state.testCases;

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {tests.length} {tests.length === 1 ? 'test case' : 'test cases'}
        </span>
        {canEdit && (
          <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
            New test case
          </Button>
        )}
      </div>

      {tests.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={22} />}
          title="No test cases yet"
          description="Capture manual checks with steps and expected results, linked to a task or issue."
          action={
            canEdit && (
              <Button leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
                Add a test case
              </Button>
            )
          }
        />
      ) : (
        <div className="data-list">
          {tests.map((test) => {
            const linkedTask = test.taskId ? state.tasks.find((t) => t.id === test.taskId) : undefined;
            const linkedIssue = test.issueId
              ? state.issues.find((i) => i.id === test.issueId)
              : undefined;
return (
              <div key={test.id} className="data-row">
                <button
                  type="button"
                  className="data-row-main"
                  onClick={() => setEditingId(test.id)}
                >
                  <div className="data-row-title">
                    <span className="row-title-text">{test.name}</span>
                  </div>
                  <div className="data-row-sub">
                    Steps: {test.steps || '—'}
                    {test.expected && <span> · Expected: {test.expected}</span>}
                  </div>
                  <div className="data-row-meta">
                    {linkedTask && <span>task: {linkedTask.title}</span>}
                    {linkedIssue && <span>issue: {linkedIssue.title}</span>}
                    <span>#{shortId(test.id)}</span>
                    {unreadIds?.has(test.id) && (
                      <>
                        <span className="unread-dot" aria-hidden="true" />
                        <span className="sr-only">Unread</span>
                      </>
                    )}
                  </div>
                </button>
                <div className="data-row-side">
                  <Badge tone={TEST_CASE_STATUS[test.status].tone}>
                    {TEST_CASE_STATUS[test.status].label}
                  </Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-icon"
                      aria-label="Edit test case"
                      onClick={() => setEditingId(test.id)}
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

      <NewTestModal open={creating} onClose={() => setCreating(false)} />
      <TestModal testId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}
