import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { ISSUE_SEVERITY, ISSUE_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { State, Issue, IssueSeverity, IssueStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty, DetailList, DetailRow } from '../../components/DetailList';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface IssueModalProps {
  issueId: string | null;
  onClose: () => void;
}

export function IssueModal({ issueId, onClose }: IssueModalProps) {
  const { state, dispatch, canEdit } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [issueId]);

  const issue = issueId ? state?.issues.find((i) => i.id === issueId) : undefined;
  if (!state || !issue) return null;

  const update = (patch: UpdatePatch<Issue>) => {
    dispatch({ type: 'issue/update', id: issue.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'issue/remove', id: issue.id });
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

  const linkedTask = issue.linkedTaskId
    ? state.tasks.find((t) => t.id === issue.linkedTaskId)
    : undefined;

  return (
    <>
    <Modal
      open={issueId !== null}
      title={editing ? 'Edit issue' : 'Issue'}
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
              label="Description"
              rows={3}
              value={issue.description}
              onChange={(e) => update({ description: e.target.value })}
            />
            <Textarea
              label="Reproduction steps"
              rows={4}
              value={issue.reproduction}
              onChange={(e) => update({ reproduction: e.target.value })}
            />
            <p className="field-helper">Updated {formatRelative(issue.updatedAt)}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{issue.title}</h3>
            <DetailList>
              <DetailRow label="Severity">
                <Badge tone={ISSUE_SEVERITY[issue.severity].tone}>
                  {ISSUE_SEVERITY[issue.severity].label}
                </Badge>
              </DetailRow>
              <DetailRow label="Status">
                <Badge tone={ISSUE_STATUS[issue.status].tone}>{ISSUE_STATUS[issue.status].label}</Badge>
              </DetailRow>
              <DetailRow label="Linked task">
                {linkedTask ? linkedTask.title : <DetailEmpty />}
              </DetailRow>
              <DetailRow label="Description">
                {issue.description.trim() ? issue.description : <DetailEmpty>No description.</DetailEmpty>}
              </DetailRow>
              <DetailRow label="Reproduction">
                {issue.reproduction.trim() ? (
                  issue.reproduction
                ) : (
                  <DetailEmpty>No reproduction steps.</DetailEmpty>
                )}
              </DetailRow>
            </DetailList>
            <p className="field-helper">Updated {formatRelative(issue.updatedAt)}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title="Delete issue?"
      description="This permanently deletes the issue. This cannot be undone."
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}