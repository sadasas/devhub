import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { TECH_CATEGORY, TECH_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { State, TechEntry, TechEntryCategory, TechStatus } from '../../lib/types';
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

interface TechModalProps {
  entryId: string | null;
  onClose: () => void;
}

export function TechModal({ entryId, onClose }: TechModalProps) {
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [entryId]);

  const entry = entryId ? state?.techEntries.find((t) => t.id === entryId) : undefined;
  usePresenceStatus('Editing tech entry', entry != null);
  if (!state || !entry) return null;

  const update = (patch: UpdatePatch<TechEntry>) => {
    dispatch({ type: 'tech/update', id: entry.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'tech/remove', id: entry.id });
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
      open={entryId !== null}
      title={editing ? 'Edit stack entry' : 'Stack entry'}
      onClose={onClose}
      width="sm"
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
            <Input label="Name" value={entry.name} onChange={(e) => update({ name: e.target.value })} />
            <Input
              label="Version"
              value={entry.version}
              placeholder="—"
              onChange={(e) => update({ version: e.target.value })}
            />
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="tech-category">
                  Category
                </label>
                <select
                  id="tech-category"
                  className="select"
                  value={entry.category}
                  onChange={(e) => update({ category: e.target.value as TechEntryCategory })}
                >
                  <option value="frontend">Frontend</option>
                  <option value="backend">Backend</option>
                  <option value="database">Database</option>
                  <option value="tooling">Tooling</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="tech-status">
                  Status
                </label>
                <select
                  id="tech-status"
                  className="select"
                  value={entry.status}
                  onChange={(e) => update({ status: e.target.value as TechStatus })}
                >
                  <option value="current">Current</option>
                  <option value="updateAvailable">Update available</option>
                  <option value="majorUpgrade">Major upgrade</option>
                </select>
              </div>
            </div>
            <Textarea
              label="Notes"
              rows={3}
              value={entry.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
            <p className="field-helper">Updated {formatRelative(entry.updatedAt)}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{entry.name}</h3>
            <DetailList>
              <DetailRow label="Category">
                <Badge tone={TECH_CATEGORY[entry.category].tone}>
                  {TECH_CATEGORY[entry.category].label}
                </Badge>
              </DetailRow>
              <DetailRow label="Status">
                <Badge tone={TECH_STATUS[entry.status].tone}>{TECH_STATUS[entry.status].label}</Badge>
              </DetailRow>
              <DetailRow label="Version">
                <span className="font-mono">{entry.version.trim() ? entry.version : <DetailEmpty />}</span>
              </DetailRow>
              <DetailRow label="Notes">
                {entry.notes.trim() ? entry.notes : <DetailEmpty>No notes.</DetailEmpty>}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">Activity</h4>
            <ActivityList projectId={projectId} entity="techEntries" entityId={entry.id} />
            <p className="field-helper">Updated {formatRelative(entry.updatedAt)}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title="Delete stack entry?"
      description="This permanently deletes this stack entry. This cannot be undone."
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}