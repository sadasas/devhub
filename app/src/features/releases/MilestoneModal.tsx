import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { MILESTONE_STATUS, TASK_STATUS } from '../../lib/labels';
import { formatRelative, shortId } from '../../lib/utils';
import type { State, Milestone, MilestoneStatus } from '../../lib/types';
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

interface MilestoneModalProps {
  milestoneId: string | null;
  onClose: () => void;
}

export function MilestoneModal({ milestoneId, onClose }: MilestoneModalProps) {
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [milestoneId]);

  const milestone = milestoneId
    ? state?.milestones.find((m) => m.id === milestoneId)
    : undefined;
  usePresenceStatus('Editing milestone', milestone !== null);
  if (!state || !milestone) return null;

  const milestoneTasks = state.tasks.filter((t) => t.milestoneId === milestone.id);

  const update = (patch: UpdatePatch<Milestone>) => {
    dispatch({ type: 'milestone/update', id: milestone.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'milestone/remove', id: milestone.id });
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
      open={milestoneId !== null}
      title={editing ? 'Edit milestone' : 'Milestone'}
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
          </>
        ) : (
          <>
            <h3 className="detail-title">{milestone.name}</h3>
            <DetailList>
              <DetailRow label="Status">
                <Badge tone={MILESTONE_STATUS[milestone.status].tone}>
                  {MILESTONE_STATUS[milestone.status].label}
                </Badge>
              </DetailRow>
              <DetailRow label="Version">
                <span className="font-mono">
                  {milestone.version ? `v${milestone.version}` : <DetailEmpty />}
                </span>
              </DetailRow>
              <DetailRow label="Target date">
                <span className="font-mono">
                  {milestone.targetDate ? milestone.targetDate.slice(0, 10) : <DetailEmpty />}
                </span>
              </DetailRow>
              <DetailRow label="Changelog">
                {milestone.changelog.trim() ? milestone.changelog : <DetailEmpty>No changelog.</DetailEmpty>}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">Activity</h4>
            <ActivityList projectId={projectId} entity="milestones" entityId={milestone.id} />
            <h4 className="detail-subtitle">
              Tasks in this release · {milestoneTasks.length}
            </h4>
            {milestoneTasks.length === 0 ? (
              <p className="field-helper">No tasks assigned to this milestone.</p>
            ) : (
              <ul className="release-task-list">
                {milestoneTasks.map((t) => (
                  <li key={t.id} className="release-task-row">
                    <span className="release-task-title">{t.title}</span>
                    <span className="release-task-side">
                      <Badge tone={TASK_STATUS[t.status].tone}>
                        {TASK_STATUS[t.status].label}
                      </Badge>
                      <span className="data-row-meta font-mono">#{shortId(t.id)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="field-helper">Updated {formatRelative(milestone.updatedAt)}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title="Delete milestone?"
      description="This permanently deletes the milestone. Tasks linked to it will be unassigned. This cannot be undone."
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}