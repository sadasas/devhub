import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import type { ProjectTemplate } from '../../lib/types';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';
import { PlanLimitModal, type PlanLimitResource } from '../../components/PlanLimitModal';

interface InstantiateTemplateModalProps {
  open: boolean;
  template: ProjectTemplate | null;
  onClose: () => void;
}

export function InstantiateTemplateModal({ open, template, onClose }: InstantiateTemplateModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitResource, setLimitResource] = useState<PlanLimitResource>('projects');

  useEffect(() => {
    if (open) {
      setName(template?.name ?? '');
      setError(null);
    }
  }, [open, template]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!template) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.instantiateTemplate(template.id, name.trim() || undefined);
      onClose();
      navigate(`/project/${result.projectId}`);
    } catch (err) {
      if (isPlanLimitError(err)) {
        setLimitResource(err.details && (err.details as { resource?: string }).resource === 'members' ? 'members' : 'projects');
        setLimitOpen(true);
      } else {
        setError(getErrorMessage(err, 'Failed to create project from template.'));
      }
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        open={open && !limitOpen}
        title="Use template"
        onClose={onClose}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="instantiate-form" loading={submitting} disabled={!name.trim()}>
              Create project
            </Button>
          </>
        }
      >
        <form id="instantiate-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label="Project name"
            required
            autoFocus
            placeholder="e.g. New sprint board"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="field-helper">
            A new project will be created in {template?.teamName} with the template's tasks, issues,
            schema and more.
          </p>
          {error && <InlineError>{error}</InlineError>}
        </form>
      </Modal>
      <PlanLimitModal
        open={limitOpen}
        resource={limitResource}
        teamId={template?.teamId ?? ''}
        onClose={() => {
          setLimitOpen(false);
          onClose();
        }}
      />
    </>
  );
}
