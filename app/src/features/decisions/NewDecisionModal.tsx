import { useState } from 'react';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { newId, nowIso } from '../../lib/utils';
import type { DecisionStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewDecisionModalProps {
  onClose: () => void;
}

export function NewDecisionModal({ onClose }: NewDecisionModalProps) {
  const { dispatch } = useProject();
  usePresenceStatus('Creating decision');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<DecisionStatus>('proposed');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [context, setContext] = useState('');
  const [options, setOptions] = useState('');
  const [decision, setDecision] = useState('');
  const [consequences, setConsequences] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'decision/add',
      decision: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        status,
        date,
        context: context.trim(),
        options: options
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean)
          .slice(0, 20),
        decision: decision.trim(),
        consequences: consequences.trim(),
      },
    });
    onClose();
  };

  return (
    <Modal
      open
      title="New decision"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!title.trim()}>
            Add decision
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input
          label="Title"
          autoFocus
          placeholder="e.g. Choose PostgreSQL over MongoDB"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="decision-status">
              Status
            </label>
            <select
              id="decision-status"
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as DecisionStatus)}
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
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <Textarea
          label="Context"
          rows={3}
          placeholder="What led to this decision? What problem is being solved?"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
        <Textarea
          label="Options considered"
          rows={3}
          helper="One option per line"
          placeholder={'Option A: …\nOption B: …'}
          value={options}
          onChange={(e) => setOptions(e.target.value)}
        />
        <Textarea
          label="Decision"
          rows={3}
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
        />
        <Textarea
          label="Consequences"
          rows={2}
          placeholder="What changes as a result?"
          value={consequences}
          onChange={(e) => setConsequences(e.target.value)}
        />
      </div>
    </Modal>
  );
}
