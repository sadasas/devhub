import { useState } from 'react';
import { useProject } from '../../state/project-context';
import { newId, nowIso } from '../../lib/utils';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface CollectionModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function CollectionModal({ onClose, onCreated }: CollectionModalProps) {
  const { dispatch, state } = useProject();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (state?.apiCollections.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A collection with this name already exists.');
      return;
    }
    const ts = nowIso();
    const id = newId();
    dispatch({
      type: 'apiCollection/add',
      collection: {
        id,
        createdAt: ts,
        updatedAt: ts,
        name: trimmed,
        description: description.trim(),
      },
    });
    onCreated(id);
  };

  return (
    <Modal
      open
      title="New API collection"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="primary" onClick={submit} disabled={!name.trim()}>
            Create collection
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input
          label="Name"
          autoFocus
          placeholder="e.g. Users API"
          value={name}
          error={error ?? undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />
        <Textarea
          label="Description"
          rows={3}
          placeholder="What does this collection group?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}