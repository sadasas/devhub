import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../lib/api';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';

interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTeamModal({ open, onClose }: CreateTeamModalProps) {
  const { createTeam } = useTeams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const team = await createTeam(name.trim());
      setName('');
      onClose();
      navigate(`/team/${team.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create team.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="New team"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-team-form" loading={submitting} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-team-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <p className="modal-copy">
          A team is a workspace that holds your projects. You can invite other registered users to
          collaborate — you become the owner.
        </p>
        <Input
          label="Name"
          required
          autoFocus
          placeholder="e.g. My Startup"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <InlineError>{error}</InlineError>}
      </form>
    </Modal>
  );
}
