import { useState } from 'react';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { newId, nowIso } from '../../lib/utils';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { WHITEBOARD_TEMPLATES } from './templates';

const MAX_BOARDS = 50;

interface NewWhiteboardModalProps {
  onClose: () => void;
}

export function NewWhiteboardModal({ onClose }: NewWhiteboardModalProps) {
  const { state, dispatch } = useProject();
  usePresenceStatus('Creating whiteboard');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const atCap = (state?.whiteboards.length ?? 0) >= MAX_BOARDS;

  const submit = () => {
    if (!name.trim() || atCap) return;
    const template = WHITEBOARD_TEMPLATES.find((t) => t.id === templateId) ?? WHITEBOARD_TEMPLATES[0]!;
    const ts = nowIso();
    dispatch({
      type: 'whiteboard/add',
      whiteboard: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        description: description.trim(),
        elements: template.build(),
      },
    });
    onClose();
  };

  return (
    <Modal
      open
      title="New whiteboard"
      onClose={onClose}
      width="md"
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
        <fieldset className="wb-template-grid">
          <legend>Template</legend>
          {WHITEBOARD_TEMPLATES.map((t) => (
            <label
              key={t.id}
              className={`wb-template-option${templateId === t.id ? ' wb-template-option-active' : ''}`}
            >
              <input
                type="radio"
                name="wb-template"
                value={t.id}
                checked={templateId === t.id}
                onChange={() => setTemplateId(t.id)}
              />
              <span className="wb-template-name">{t.name}</span>
              <span className="wb-template-desc">{t.description}</span>
            </label>
          ))}
        </fieldset>
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