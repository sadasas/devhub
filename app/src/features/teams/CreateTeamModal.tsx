import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';
import { FE_LIMITS } from '../../lib/limits';

interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTeamModal({ open, onClose }: CreateTeamModalProps) {
  const { t } = useTranslation('account');
  const { createTeam } = useTeams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedIcon = icon.trim() || null;
      const team = await createTeam(name.trim(), trimmedIcon);
      setName('');
      setIcon('');
      onClose();
      navigate(`/team/${team.id}`);
    } catch (err) {
      setError(getErrorMessage(err, t('teams.createModal.createError')));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('teams.createModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:action.cancel')}
          </Button>
          <Button type="submit" form="create-team-form" loading={submitting} disabled={!name.trim()}>
            {t('teams.createModal.create')}
          </Button>
        </>
      }
    >
      <form id="create-team-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <p className="modal-copy">
          {t('teams.createModal.intro')}
        </p>
        <div className="form-row">
          <div style={{ flex: '0 0 96px' }}>
            <Input
              label={t('teams.createModal.icon')}
              value={icon}
              placeholder="😀"
              maxLength={FE_LIMITS.TEAM_ICON}
              onChange={(e) => setIcon(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label={t('teams.createModal.name')}
              required
              autoFocus
              placeholder={t('teams.createModal.namePlaceholder')}
              value={name}
              maxLength={FE_LIMITS.TEAM_NAME}
              showCount
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        {error && <InlineError>{error}</InlineError>}
      </form>
    </Modal>
  );
}
