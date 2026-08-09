import { useState } from 'react';
import { MILESTONE_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { Milestone, MilestoneStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface MilestoneModalProps {
  milestoneId: string | null;
  onClose: () => void;
}

export function MilestoneModal({ milestoneId, onClose }: MilestoneModalProps) {
  const { state, dispatch } = useProject();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const milestone = milestoneId
    ? state?.milestones.find((m) => m.id === milestoneId)
    : undefined;
  if (!state || !milestone) return null;

  const update = (patch: UpdatePatch<Milestone>) => {
    dispatch({ type: 'milestone/update', id: milestone.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'milestone/remove', id: milestone.id });
    onClose();
  };

  return (
    <Modal
      open={milestoneId !== null}
      title="Milestone"
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
          <Badge tone={MILESTONE_STATUS[milestone.status].tone}>
            {MILESTONE_STATUS[milestone.status].label}
          </Badge>
          {milestone.version && <span className="data-row-meta">v{milestone.version}</span>}
        </div>
        <Input
          label="Name"
          value={milestone.name}
          onChange={(e) => update({ name: e.target.value })}
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
              value={milestone.version ?? ''}
              onChange={(e) => update({ version: e.target.value.trim() || null })}
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
              value={milestone.targetDate?.slice(0, 10) ?? ''}
              onChange={(e) => update({ targetDate: e.target.value || null })}
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
            value={milestone.status}
            onChange={(e) => update({ status: e.target.value as MilestoneStatus })}
          >
            <option value="planned">Planned</option>
            <option value="inProgress">In progress</option>
            <option value="released">Released</option>
          </select>
        </div>
        <Textarea
          label="Changelog"
          rows={4}
          value={milestone.changelog}
          onChange={(e) => update({ changelog: e.target.value })}
        />
        <p className="field-helper">Updated {formatRelative(milestone.updatedAt)}</p>
      </div>
    </Modal>
  );
}
