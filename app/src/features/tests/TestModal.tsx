import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { TEST_CASE_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { State, TestCase, TestCaseStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Badge } from '../../components/Badge';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty, DetailList, DetailRow } from '../../components/DetailList';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Textarea } from '../../components/Textarea';

interface TestModalProps {
  testId: string | null;
  onClose: () => void;
}

export function TestModal({ testId, onClose }: TestModalProps) {
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [testId]);

  const test = testId ? state?.testCases.find((t) => t.id === testId) : undefined;
  usePresenceStatus('Editing test case', test != null);
  if (!state || !test) return null;

  const update = (patch: UpdatePatch<TestCase>) => {
    dispatch({ type: 'testCase/update', id: test.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'testCase/remove', id: test.id });
    onClose();
  };

  const startEditing = () => {
    editSnapshot.current = structuredClone(state);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (editSnapshot.current) {
      dispatch({ type: 'replace', state: editSnapshot.current });
      editSnapshot.current = null;
    }
    setEditing(false);
  };

  const finishEditing = () => {
    editSnapshot.current = null;
    setEditing(false);
    onClose();
  };

  const linkedTask = test.taskId ? state.tasks.find((t) => t.id === test.taskId) : undefined;
  const linkedIssue = test.issueId ? state.issues.find((i) => i.id === test.issueId) : undefined;

  return (
    <>
    <Modal
      open={testId !== null}
      title={editing ? 'Edit test case' : 'Test case'}
      onClose={onClose}
      width="md"
      footer={
        <>
          {canEdit && !editing && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                Cancel
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                Done
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                Edit
              </Button>
            )
          )}
        </>
      }
    >
      <div className="form-stack">
        {editing ? (
          <>
            <Input label="Name" value={test.name} onChange={(e) => update({ name: e.target.value })} />
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="test-status">
                  Status
                </label>
                <select
                  id="test-status"
                  className="select"
                  value={test.status}
                  onChange={(e) => update({ status: e.target.value as TestCaseStatus })}
                >
                  <option value="pending">Pending</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>
              <div className="field">
                <SearchableSelect
                  id="test-task"
                  label="Linked task"
                  value={test.taskId}
                  options={state.tasks.map((t) => ({ value: t.id, label: t.title }))}
                  onChange={(v) => update({ taskId: v })}
                />
              </div>
            </div>
            <div className="field">
              <SearchableSelect
                id="test-issue"
                label="Linked issue"
                value={test.issueId}
                options={state.issues.map((i) => ({ value: i.id, label: i.title }))}
                onChange={(v) => update({ issueId: v })}
              />
            </div>
            <Textarea
              label="Steps"
              rows={4}
              value={test.steps}
              onChange={(e) => update({ steps: e.target.value })}
            />
            <Textarea
              label="Expected result"
              rows={2}
              value={test.expected}
              onChange={(e) => update({ expected: e.target.value })}
            />
            <p className="field-helper">Updated {formatRelative(test.updatedAt)}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{test.name}</h3>
            <DetailList>
              <DetailRow label="Status">
                <Badge tone={TEST_CASE_STATUS[test.status].tone}>
                  {TEST_CASE_STATUS[test.status].label}
                </Badge>
              </DetailRow>
              <DetailRow label="Linked task">
                {linkedTask ? linkedTask.title : <DetailEmpty />}
              </DetailRow>
              <DetailRow label="Linked issue">
                {linkedIssue ? linkedIssue.title : <DetailEmpty />}
              </DetailRow>
              <DetailRow label="Steps">
                {test.steps.trim() ? test.steps : <DetailEmpty>No steps.</DetailEmpty>}
              </DetailRow>
              <DetailRow label="Expected">
                {test.expected.trim() ? test.expected : <DetailEmpty>No expected result.</DetailEmpty>}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">Activity</h4>
            <ActivityList projectId={projectId} entity="testCases" entityId={test.id} />
            <p className="field-helper">Updated {formatRelative(test.updatedAt)}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title="Delete test case?"
      description="This permanently deletes the test case. This cannot be undone."
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}