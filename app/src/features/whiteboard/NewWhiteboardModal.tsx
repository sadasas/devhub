import { useState } from 'react';
import { useProject } from '../../state/project-context';
import { newId, nowIso } from '../../lib/utils';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

const MAX_BOARDS = 5;

interface NewWhiteboardModalProps {
  onClose: () => void;
}

export function NewWhiteboardModal({ onClose }: NewWhiteboardModalProps) {
  const { state, dispatch } = useProject();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const atCap = (state?.whiteboards.length ?? 0) >= MAX_BOARDS;

  const submit = () => {
    if (!name.trim() || atCap) return;
    const ts = nowIso();
    dispatch({
      type: 'whiteboard/add',
      whiteboard: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        description: description.trim(),
        elements: [],
      },
    });
    onClose();
  };

  return (
    <Modal
      open
      title="New whiteboard"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || atCap}>
            Create board
          </Button>
        </>
      }
    >
      <div className="form-stack">
        {atCap && <p className="field-helper">{MAX_BOARDS} boards per project — delete one to add another.</p>}
        <Input
          label="Name"
          required
          autoFocus
          maxLength={100}
          placeholder="e.g. Q3 architecture sketch"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label="Description"
          rows={3}
          maxLength={2000}
          helper="Up to 2000 characters"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}