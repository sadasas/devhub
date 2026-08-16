import { useState } from 'react';
import type { FormEvent } from 'react';
import { newId, nowIso } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewTableModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTableModal({ open, onClose }: NewTableModalProps) {
  const { dispatch } = useProject();
  usePresenceStatus('Creating table', open);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'table/add',
      table: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        comment: comment.trim(),
        columns: [],
        indexes: [],
      },
    });
    setName('');
    setComment('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title="New table"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-table-form" disabled={!name.trim()}>
            Create table
          </Button>
        </>
      }
    >
      <form id="new-table-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Name"
          required
          autoFocus
          placeholder="users"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label="Comment"
          rows={2}
          placeholder="What is this table for? — optional"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </form>
    </Modal>
  );
}
