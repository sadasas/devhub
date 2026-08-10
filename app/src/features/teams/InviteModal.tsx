import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../lib/api';
import { TEAM_ROLE } from '../../lib/labels';
import type { TeamRole } from '../../lib/types';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';

interface InviteModalProps {
  teamId: string;
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

const INVITE_ROLES: Exclude<TeamRole, 'owner'>[] = ['admin', 'editor', 'viewer'];

export function InviteModal({ teamId, open, onClose, onInvited }: InviteModalProps) {
  const { inviteMember } = useTeams();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<TeamRole, 'owner'>>('editor');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await inviteMember(teamId, email.trim(), role);
      setEmail('');
      setRole('editor');
      onClose();
      onInvited();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send invitation.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Invite member"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={submitting} disabled={!email.trim()}>
            Send invite
          </Button>
        </>
      }
    >
      <form id="invite-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <p className="modal-copy">
          Invite a registered DevHub user by email. They must accept the invitation before they
          can join this team.
        </p>
        <Input
          label="Email"
          type="email"
          required
          autoFocus
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="field">
          <label className="field-label" htmlFor="invite-role">
            Role
          </label>
          <select
            id="invite-role"
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value as Exclude<TeamRole, 'owner'>)}
          >
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {TEAM_ROLE[r].label}
              </option>
            ))}
          </select>
        </div>
        {error && <InlineError>{error}</InlineError>}
      </form>
    </Modal>
  );
}
