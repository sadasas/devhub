import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {} from '../../lib/api';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import type { PlanLimitResource } from '../../components/PlanLimitModal';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Textarea } from '../../components/Textarea';
import { InlineError } from '../../components/InlineError';
import { FE_LIMITS } from '../../lib/limits';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  initialTeamId?: string | null;
}

export function NewProjectModal({ open, onClose, initialTeamId }: NewProjectModalProps) {
  const { t } = useTranslation('account');
  const { create } = useProjects();
  const { teams } = useTeams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitResource, setLimitResource] = useState<PlanLimitResource>('projects');

  useEffect(() => {
    if (open && teams && teams.length > 0) {
      if (initialTeamId && teams.some((t) => t.id === initialTeamId)) {
        setTeamId(initialTeamId);
      } else {
        setTeamId((prev) => (prev && teams.some((t) => t.id === prev) ? prev : (teams[0]?.id ?? '')));
      }
    }
  }, [open, teams, initialTeamId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teamId) {
      setError(t('dashboard.modal.selectTeamError'));
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
      if (isPlanLimitError(err)) {
        setLimitResource(err.details && (err.details as { resource?: string }).resource === 'members' ? 'members' : 'projects');
        setLimitOpen(true);
      } else {
        setError(getErrorMessage(err, t('dashboard.modal.createFailed')));
      }
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('dashboard.modal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:action.cancel')}
          </Button>
          <Button type="submit" form="new-project-form" loading={submitting} disabled={!name.trim() || (teams?.length ?? 0) === 0}>
            {t('dashboard.modal.create')}
          </Button>
        </>
      }
    >
      <form id="new-project-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('dashboard.modal.name')}
          required
          autoFocus
          placeholder={t('dashboard.modal.namePlaceholder')}
          value={name}
          maxLength={FE_LIMITS.PROJECT_NAME}
          showCount
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label={t('dashboard.modal.description')}
          rows={3}
          placeholder={t('dashboard.modal.descriptionPlaceholder')}
          value={description}
          maxLength={FE_LIMITS.PROJECT_DESCRIPTION}
          showCount
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="field">
          <label className="field-label" htmlFor="new-project-team">
            {t('dashboard.modal.team')}
          </label>
          {teams && teams.length === 0 ? (
            <p className="field-helper" id="new-project-team-hint">
              {t('dashboard.modal.teamEmptyHint')}
            </p>
          ) : (
            <SearchableSelect
              id="new-project-team"
              allowEmpty={false}
              placeholder={t('dashboard.modal.selectTeam')}
              value={teamId || null}
              options={(teams ?? []).map((team) => ({ value: team.id, label: team.name }))}
              onChange={(v) => setTeamId(v ?? '')}
            />
          )}
        </div>
        {error && <InlineError>{error}</InlineError>}
      </form>
      <PlanLimitModal
        open={limitOpen}
        resource={limitResource}
        teamId={teamId}
        onClose={() => {
          setLimitOpen(false);
          onClose();
        }}
      />
    </Modal>
  );
}
