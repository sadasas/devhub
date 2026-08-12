import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../lib/api';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { InlineError } from '../../components/InlineError';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const { create } = useProjects();
  const { teams } = useTeams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && teams && teams.length > 0) {
      setTeamId((prev) => (prev && teams.some((t) => t.id === prev) ? prev : (teams[0]?.id ?? '')));
    }
  }, [open, teams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teamId) {
      setError('Select a team first.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const project = await create(name.trim(), description.trim(), teamId);
      setName('');
      setDescription('');
      onClose();
      navigate(`/project/${project.id}`);
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
          <Button type="submit" form="new-project-form" loading={submitting} disabled={!name.trim() || (teams?.length ?? 0) === 0}>
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
        <div className="field">
          <label className="field-label" htmlFor="new-project-team">
            Team
          </label>
          {teams && teams.length === 0 ? (
            <p className="field-helper" id="new-project-team-hint">
              You have no teams yet — create one from the sidebar, then return here to add a project.
            </p>
          ) : (
            <select
              id="new-project-team"
              className="select"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {error && <InlineError>{error}</InlineError>}
      </form>
    </Modal>
  );
}
