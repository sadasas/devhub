import { useState } from 'react';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { newId, nowIso } from '../../lib/utils';
import type { MilestoneStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewMilestoneModalProps {
  onClose: () => void;
}

export function NewMilestoneModal({ onClose }: NewMilestoneModalProps) {
  const { dispatch } = useProject();
  usePresenceStatus('Creating milestone');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('planned');
  const [changelog, setChangelog] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'milestone/add',
      milestone: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        version: version.trim().replace(/^v+/i, '') || null,
        targetDate: targetDate || null,
        status,
        changelog: changelog.trim(),
      },
    });
    onClose();
  };

  return (
    <Modal
      open
      title="New milestone"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim()}>
            Add milestone
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input
          label="Name"
          autoFocus
          placeholder="e.g. Public beta"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="milestone-version">
              Version
            </label>
            <input
              id="milestone-version"
              className="input"
              placeholder="0.1.0"
              inputMode="decimal"
              value={version}
              onChange={(e) => setVersion(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="milestone-target">
              Target date
            </label>
            <input
              id="milestone-target"
              className="input"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="milestone-status">
            Status
          </label>
          <select
            id="milestone-status"
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
          >
            <option value="planned">Planned</option>
            <option value="inProgress">In progress</option>
            <option value="released">Released</option>
          </select>
        </div>
        <Textarea
          label="Changelog"
          rows={4}
          helper="What shipped with this release"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
        />
      </div>
    </Modal>
  );
}
