import { useState } from 'react';
import type { FormEvent } from 'react';
import { newId, nowIso } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface SaveVersionModalProps {
  open: boolean;
  onClose: () => void;
}

export function SaveVersionModal({ open, onClose }: SaveVersionModalProps) {
  const { state, dispatch } = useProject();
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');

  if (!state) return null;
  const snapshot = { tables: state.tables, relations: state.relations };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!version.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'schemaVersion/add',
      version: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        version: version.trim(),
        appliedAt: ts,
        notes: notes.trim(),
        snapshot,
      },
    });
    setVersion('');
    setNotes('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Save schema version"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="save-version-form" disabled={!version.trim()}>
            Save version
          </Button>
        </>
      }
    >
      <form id="save-version-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Version"
          required
          autoFocus
          placeholder="1.1.0"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <Textarea
          label="Notes"
          rows={3}
          placeholder="What changed in this schema revision? — optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}
