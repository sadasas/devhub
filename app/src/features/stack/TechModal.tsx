import { useState } from 'react';
import { TECH_CATEGORY, TECH_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { TechEntry, TechEntryCategory, TechStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface TechModalProps {
  entryId: string | null;
  onClose: () => void;
}

export function TechModal({ entryId, onClose }: TechModalProps) {
  const { state, dispatch } = useProject();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const entry = entryId ? state?.techEntries.find((t) => t.id === entryId) : undefined;
  if (!state || !entry) return null;

  const update = (patch: UpdatePatch<TechEntry>) => {
    dispatch({ type: 'tech/update', id: entry.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'tech/remove', id: entry.id });
    onClose();
  };

  return (
    <Modal
      open={entryId !== null}
      title="Stack entry"
      onClose={onClose}
      width="sm"
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
          <Badge tone={TECH_CATEGORY[entry.category].tone}>{TECH_CATEGORY[entry.category].label}</Badge>
          <Badge tone={TECH_STATUS[entry.status].tone}>{TECH_STATUS[entry.status].label}</Badge>
        </div>
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
      </div>
    </Modal>
  );
}
