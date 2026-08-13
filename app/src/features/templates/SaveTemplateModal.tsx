import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { InlineError } from '../../components/InlineError';

interface SaveTemplateModalProps {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export function SaveTemplateModal({ open, projectId, projectName, onClose }: SaveTemplateModalProps) {
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(projectName);
      setDescription('');
      setSaved(false);
      setError(null);
    }
  }, [open, projectName]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.saveTemplate(projectId, name.trim(), description.trim());
      setSaved(true);
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Save as template"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {saved ? 'Close' : 'Cancel'}
          </Button>
          {!saved && (
            <Button type="submit" form="save-template-form" loading={submitting} disabled={!name.trim()}>
              Save template
            </Button>
          )}
        </>
      }
    >
      {saved ? (
        <p className="field-helper">
          Template saved. Find it and create new projects from it under “Project templates” in the
          sidebar.
        </p>
      ) : (
        <form id="save-template-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label="Template name"
            required
            autoFocus
            placeholder="e.g. Blank sprint board"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            label="Description"
            rows={3}
            placeholder="What is this template for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <InlineError>{error}</InlineError>}
        </form>
      )}
    </Modal>
  );
}