import { useState } from 'react';
import { DECISION_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { Decision, DecisionStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface DecisionModalProps {
  decisionId: string | null;
  onClose: () => void;
}

export function DecisionModal({ decisionId, onClose }: DecisionModalProps) {
  const { state, dispatch } = useProject();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const decision = decisionId
    ? state?.decisions.find((d) => d.id === decisionId)
    : undefined;
  if (!state || !decision) return null;

  const update = (patch: UpdatePatch<Decision>) => {
    dispatch({ type: 'decision/update', id: decision.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'decision/remove', id: decision.id });
    onClose();
  };

  return (
    <Modal
      open={decisionId !== null}
      title="Decision record"
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
          <Badge tone={DECISION_STATUS[decision.status].tone}>
            {DECISION_STATUS[decision.status].label}
          </Badge>
          <span className="data-row-meta"># {decision.date}</span>
        </div>
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
      </div>
    </Modal>
  );
}
