import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import { TEAM_ROLE } from '../../lib/labels';
import type { TeamRole } from '../../lib/types';
import { useTeams } from '../../state/teams-context';
import { Envelope } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';
import { PlanLimitModal, type PlanLimitResource } from '../../components/PlanLimitModal';

interface InviteModalProps {
  teamId: string;
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

const INVITE_ROLES: Exclude<TeamRole, 'owner'>[] = ['admin', 'editor', 'viewer'];

export function InviteModal({ teamId, open, onClose, onInvited }: InviteModalProps) {
  const { t } = useTranslation('account');
  const { inviteMember } = useTeams();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<TeamRole, 'owner'>>('editor');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitResource, setLimitResource] = useState<PlanLimitResource>('members');

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
      if (isPlanLimitError(err)) {
        setLimitResource(err.details && (err.details as { resource?: string }).resource === 'projects' ? 'projects' : 'members');
        setLimitOpen(true);
        onClose();
      } else {
        setError(getErrorMessage(err, t('teams.inviteModal.sendError')));
        setSubmitting(false);
      }
    }
  }

  return (
    <>
      <Modal
        open={open}
        title={t('teams.inviteModal.title')}
        onClose={onClose}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('common:action.cancel')}
            </Button>
            <Button type="submit" form="invite-form" leftIcon={<Envelope size={13} aria-hidden="true" />} loading={submitting} disabled={!email.trim()}>
              {t('teams.inviteModal.send')}
            </Button>
          </>
        }
      >
      <form id="invite-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <p className="modal-copy">
          {t('teams.inviteModal.intro')}
        </p>
        <Input
          label={t('teams.inviteModal.email')}
          type="email"
          required
          autoFocus
          placeholder={t('teams.inviteModal.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div role="radiogroup" aria-label={t('teams.inviteModal.role')} className="role-options">
          {INVITE_ROLES.map((r) => (
            <label key={r} className={`role-option ${role === r ? 'role-option-active' : ''}`}>
              <input
                type="radio"
                name="invite-role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              <span className="role-option-head">
                <span className="role-option-label">{TEAM_ROLE[r].label}</span>
                <Badge tone={TEAM_ROLE[r].tone}>{TEAM_ROLE[r].label}</Badge>
              </span>
              <span className="role-option-desc">{t(`teams.changeRoleModal.desc.${r}`)}</span>
            </label>
          ))}
        </div>
        {error && <InlineError>{error}</InlineError>}
      </form>
      </Modal>
      <PlanLimitModal
        open={limitOpen && !open}
        resource={limitResource}
        teamId={teamId}
        onClose={() => setLimitOpen(false)}
      />
    </>
  );
}
