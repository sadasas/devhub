import { useState } from 'react';
import type { FormEvent } from 'react';
import { newId, nowIso } from '../../lib/utils';
import type { TestCaseStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewTestModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTestModal({ open, onClose }: NewTestModalProps) {
  const { state, dispatch } = useProject();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TestCaseStatus>('pending');
  const [taskId, setTaskId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');

  if (!state) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'testCase/add',
      testCase: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        status,
        taskId: taskId || null,
        issueId: issueId || null,
        steps: steps.trim(),
        expected: expected.trim(),
      },
    });
    setName('');
    setStatus('pending');
    setTaskId('');
    setIssueId('');
    setSteps('');
    setExpected('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title="New test case"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-test-form" disabled={!name.trim()}>
            Add test case
          </Button>
        </>
      }
    >
      <form id="new-test-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Name"
          required
          autoFocus
          placeholder="e.g. Login with invalid password"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="field">
          <label className="field-label" htmlFor="new-test-status">
            Status
          </label>
          <select
            id="new-test-status"
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as TestCaseStatus)}
          >
            <option value="pending">Pending</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-test-task">
            Linked task
          </label>
          <select
            id="new-test-task"
            className="select"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          >
            <option value="">None</option>
            {state.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-test-issue">
            Linked issue
          </label>
          <select
            id="new-test-issue"
            className="select"
            value={issueId}
            onChange={(e) => setIssueId(e.target.value)}
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
          rows={3}
          placeholder="1. … 2. … — optional"
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
        <Textarea
          label="Expected result"
          rows={2}
          placeholder="What should happen — optional"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
      </form>
    </Modal>
  );
}
