import { useState } from 'react';
import type { FormEvent } from 'react';
import { newId, nowIso } from '../../lib/utils';
import type { TechEntryCategory, TechStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewTechModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTechModal({ open, onClose }: NewTechModalProps) {
  const { dispatch } = useProject();
  usePresenceStatus('Creating tech entry', open);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [category, setCategory] = useState<TechEntryCategory>('frontend');
  const [status, setStatus] = useState<TechStatus>('current');
  const [notes, setNotes] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'tech/add',
      entry: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        version: version.trim(),
        category,
        status,
        notes: notes.trim(),
      },
    });
    setName('');
    setVersion('');
    setCategory('frontend');
    setStatus('current');
    setNotes('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title="New stack entry"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-tech-form" disabled={!name.trim()}>
            Add entry
          </Button>
        </>
      }
    >
      <form id="new-tech-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Name"
          required
          autoFocus
          placeholder="e.g. React"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Version"
          placeholder="e.g. 19.2.0"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="new-tech-category">
              Category
            </label>
            <select
              id="new-tech-category"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as TechEntryCategory)}
            >
              <option value="frontend">Frontend</option>
              <option value="backend">Backend</option>
              <option value="database">Database</option>
              <option value="tooling">Tooling</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="new-tech-status">
              Status
            </label>
            <select
              id="new-tech-status"
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as TechStatus)}
            >
              <option value="current">Current</option>
              <option value="updateAvailable">Update available</option>
              <option value="majorUpgrade">Major upgrade</option>
            </select>
          </div>
        </div>
        <Textarea
          label="Notes"
          rows={2}
          placeholder="Optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}
