import { useState } from 'react';
import { TEST_CASE_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { TestCase, TestCaseStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface TestModalProps {
  testId: string | null;
  onClose: () => void;
}

export function TestModal({ testId, onClose }: TestModalProps) {
  const { state, dispatch } = useProject();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const test = testId ? state?.testCases.find((t) => t.id === testId) : undefined;
  if (!state || !test) return null;

  const update = (patch: UpdatePatch<TestCase>) => {
    dispatch({ type: 'testCase/update', id: test.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'testCase/remove', id: test.id });
    onClose();
  };

  return (
    <Modal
      open={testId !== null}
      title="Test case"
      onClose={onClose}
      width="md"
      footer={
        <>
          {confirmDelete ? (
            <Button variant="danger" onClick={remove}>
              Confirm delete
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <div className="data-row-title">
          <Badge tone={TEST_CASE_STATUS[test.status].tone}>{TEST_CASE_STATUS[test.status].label}</Badge>
        </div>
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
            <label className="field-label" htmlFor="test-task">
              Linked task
            </label>
            <select
              id="test-task"
              className="select"
              value={test.taskId ?? ''}
              onChange={(e) => update({ taskId: e.target.value || null })}
            >
              <option value="">None</option>
              {state.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="test-issue">
            Linked issue
          </label>
          <select
            id="test-issue"
            className="select"
            value={test.issueId ?? ''}
            onChange={(e) => update({ issueId: e.target.value || null })}
          >
            <option value="">None</option>
            {state.issues.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
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
      </div>
    </Modal>
  );
}
