import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {} from '../../lib/api';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import type { PlanLimitResource } from '../../components/PlanLimitModal';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { isTourActive } from '../onboarding/tour-events';
import { Plus } from '@phosphor-icons/react';
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
  const errorRef = useRef<HTMLDivElement>(null);
  const autoFocusName = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

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
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const project = await create(name.trim(), description.trim(), teamId);
      setName('');
      setDescription('');
      onClose();
      // Tour rule: continue inside the project workspace (?tour=1 resumes at Plan).
      if (isTourActive()) {
        navigate(`/project/${project.id}?tab=board&tour=1`);
      } else {
        navigate(`/project/${project.id}`);
      }
    } catch (err) {
      if (isPlanLimitError(err)) {
        setLimitResource(err.details && (err.details as { resource?: string }).resource === 'members' ? 'members' : 'projects');
        setLimitOpen(true);
      } else {
        setError(getErrorMessage(err, t('dashboard.modal.createFailed')));
        requestAnimationFrame(() => errorRef.current?.focus());
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
          <Button variant="ghost" size="md" onClick={onClose}>
            {t('common:action.cancel')}
          </Button>
          <Button type="submit" size="md" form="new-project-form" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} loading={submitting} disabled={!name.trim() || (teams?.length ?? 0) === 0}>
            {t('dashboard.modal.create')}
          </Button>
        </>
      }
    >
      <form id="new-project-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('dashboard.modal.name')}
          required
          autoFocus={autoFocusName}
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
        {error && <div ref={errorRef} tabIndex={-1} className="form-error-focus"><InlineError>{error}</InlineError></div>}
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
