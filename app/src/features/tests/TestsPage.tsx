import { useState } from 'react';
import { CheckSquare, PencilSimple, Plus } from '@phosphor-icons/react';
import { useProject } from '../../state/project-context';
import { TEST_CASE_STATUS } from '../../lib/labels';
import { shortId } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { NewTestModal } from './NewTestModal';
import { TestModal } from './TestModal';

export function TestsPage() {
  const { state, loading, error } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      <p className="field-error" role="alert">
        {error}
      </p>
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
        <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
          New test case
        </Button>
      </div>

      {tests.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={22} />}
          title="No test cases yet"
          description="Capture manual checks with steps and expected results, linked to a task or issue."
          action={
            <Button leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
              Add a test case
            </Button>
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
              <div
                key={test.id}
                className="data-row"
                role="button"
                tabIndex={0}
                onClick={() => setEditingId(test.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setEditingId(test.id);
                  }
                }}
              >
                <div className="data-row-main">
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
                  </div>
                </div>
                <div className="data-row-side">
                  <Badge tone={TEST_CASE_STATUS[test.status].tone}>
                    {TEST_CASE_STATUS[test.status].label}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-icon"
                    aria-label="Edit test case"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(test.id);
                    }}
                  >
                    <PencilSimple size={14} aria-hidden="true" />
                  </Button>
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
