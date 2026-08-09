import { useState } from 'react';
import { ISSUE_SEVERITY, ISSUE_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { Issue, IssueSeverity, IssueStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface IssueModalProps {
  issueId: string | null;
  onClose: () => void;
}

export function IssueModal({ issueId, onClose }: IssueModalProps) {
  const { state, dispatch } = useProject();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const issue = issueId ? state?.issues.find((i) => i.id === issueId) : undefined;
  if (!state || !issue) return null;

  const update = (patch: UpdatePatch<Issue>) => {
    dispatch({ type: 'issue/update', id: issue.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'issue/remove', id: issue.id });
    onClose();
  };

  return (
    <Modal
      open={issueId !== null}
      title="Issue"
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
          <Badge tone={ISSUE_SEVERITY[issue.severity].tone}>{ISSUE_SEVERITY[issue.severity].label}</Badge>
          <Badge tone={ISSUE_STATUS[issue.status].tone}>{ISSUE_STATUS[issue.status].label}</Badge>
        </div>
        <Input
          label="Title"
          value={issue.title}
          onChange={(e) => update({ title: e.target.value })}
        />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="issue-severity">
              Severity
            </label>
            <select
              id="issue-severity"
              className="select"
              value={issue.severity}
              onChange={(e) => update({ severity: e.target.value as IssueSeverity })}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="issue-status">
              Status
            </label>
            <select
              id="issue-status"
              className="select"
              value={issue.status}
              onChange={(e) => update({ status: e.target.value as IssueStatus })}
            >
              <option value="open">Open</option>
              <option value="reproduced">Reproduced</option>
              <option value="fixing">Fixing</option>
              <option value="resolved">Resolved</option>
              <option value="wontfix">Won't fix</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="issue-linked-task">
            Linked task
          </label>
          <select
            id="issue-linked-task"
            className="select"
            value={issue.linkedTaskId ?? ''}
            onChange={(e) => update({ linkedTaskId: e.target.value || null })}
          >
            <option value="">None</option>
            {state.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          label="Reproduction steps"
          rows={4}
          value={issue.reproduction}
          onChange={(e) => update({ reproduction: e.target.value })}
        />
        <p className="field-helper">Updated {formatRelative(issue.updatedAt)}</p>
      </div>
    </Modal>
  );
}
