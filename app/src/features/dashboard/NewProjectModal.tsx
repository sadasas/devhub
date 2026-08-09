import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../lib/api';
import { useNavigation } from '../../state/navigation-context';
import { useProjects } from '../../state/projects-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const { create } = useProjects();
  const { openProject } = useNavigation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const project = await create(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
      openProject(project.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create project.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="New project"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-project-form" loading={submitting} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <form id="new-project-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Name"
          required
          autoFocus
          placeholder="e.g. Landing page"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label="Description"
          rows={3}
          placeholder="What is this project about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
