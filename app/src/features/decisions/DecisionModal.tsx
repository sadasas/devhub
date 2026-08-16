import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { DECISION_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { State, Decision, DecisionStatus } from '../../lib/types';
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
import { Textarea } from '../../components/Textarea';

interface DecisionModalProps {
  decisionId: string | null;
  onClose: () => void;
}

export function DecisionModal({ decisionId, onClose }: DecisionModalProps) {
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [decisionId]);

  const decision = decisionId
    ? state?.decisions.find((d) => d.id === decisionId)
    : undefined;
  usePresenceStatus('Editing decision', decision !== null);
  if (!state || !decision) return null;

  const update = (patch: UpdatePatch<Decision>) => {
    dispatch({ type: 'decision/update', id: decision.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'decision/remove', id: decision.id });
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

  return (
    <>
    <Modal
      open={decisionId !== null}
      title={editing ? 'Edit decision record' : 'Decision record'}
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
              value={decision.title}
              onChange={(e) => update({ title: e.target.value })}
            />
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="decision-status">
                  Status
                </label>
                <select
                  id="decision-status"
                  className="select"
                  value={decision.status}
                  onChange={(e) => update({ status: e.target.value as DecisionStatus })}
                >
                  <option value="proposed">Proposed</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="superseded">Superseded</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="decision-date">
                  Date
                </label>
                <input
                  id="decision-date"
                  className="input"
                  type="date"
                  value={decision.date.slice(0, 10)}
                  onChange={(e) => update({ date: e.target.value })}
                />
              </div>
            </div>
            <Textarea
              label="Context"
              rows={3}
              value={decision.context}
              onChange={(e) => update({ context: e.target.value })}
            />
            <Textarea
              label="Options considered"
              rows={3}
              helper="One option per line"
              value={decision.options.join('\n')}
              onChange={(e) =>
                update({
                  options: e.target.value
                    .split('\n')
                    .map((o) => o.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                })
              }
            />
            <Textarea
              label="Decision"
              rows={3}
              value={decision.decision}
              onChange={(e) => update({ decision: e.target.value })}
            />
            <Textarea
              label="Consequences"
              rows={2}
              value={decision.consequences}
              onChange={(e) => update({ consequences: e.target.value })}
            />
            <p className="field-helper">Updated {formatRelative(decision.updatedAt)}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{decision.title}</h3>
            <DetailList>
              <DetailRow label="Status">
                <Badge tone={DECISION_STATUS[decision.status].tone}>
                  {DECISION_STATUS[decision.status].label}
                </Badge>
              </DetailRow>
              <DetailRow label="Date">
                <span className="font-mono"># {decision.date.slice(0, 10)}</span>
              </DetailRow>
              <DetailRow label="Context">
                {decision.context.trim() ? decision.context : <DetailEmpty>No context.</DetailEmpty>}
              </DetailRow>
              <DetailRow label="Options">
                {decision.options.length > 0 ? (
                  <ol className="detail-options">
                    {decision.options.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ol>
                ) : (
                  <DetailEmpty>No options considered.</DetailEmpty>
                )}
              </DetailRow>
              <DetailRow label="Decision">
                {decision.decision.trim() ? decision.decision : <DetailEmpty>No decision recorded.</DetailEmpty>}
              </DetailRow>
              <DetailRow label="Consequences">
                {decision.consequences.trim() ? (
                  decision.consequences
                ) : (
                  <DetailEmpty>No consequences recorded.</DetailEmpty>
                )}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">Activity</h4>
            <ActivityList projectId={projectId} entity="decisions" entityId={decision.id} />
            <p className="field-helper">Updated {formatRelative(decision.updatedAt)}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title="Delete decision record?"
      description="This permanently deletes the decision record. This cannot be undone."
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}