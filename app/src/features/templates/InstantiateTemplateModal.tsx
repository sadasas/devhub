import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import type { ProjectTemplate } from '../../lib/types';
import { useTeams } from '../../state/teams-context';
import { readLastActiveTeamId } from '../layout/WorkspaceSwitcher';
import { Copy } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';
import { SearchableSelect } from '../../components/SearchableSelect';
import { PlanLimitModal, type PlanLimitResource } from '../../components/PlanLimitModal';

interface InstantiateTemplateModalProps {
  open: boolean;
  template: ProjectTemplate | null;
  onClose: () => void;
  // Optional override for the default target team (defaults to last active).
  initialTeamId?: string | null;
}

// Resolve the default target workspace: explicit prop wins, then the last
// active workspace, then the first team the user belongs to.
function resolveDefaultTeamId(
  teams: { id: string }[] | null,
  initialTeamId?: string | null,
): string {
  if (!teams || teams.length === 0) return '';
  if (initialTeamId && teams.some((tm) => tm.id === initialTeamId)) return initialTeamId;
  const last = readLastActiveTeamId();
  if (last && teams.some((tm) => tm.id === last)) return last;
  return teams[0]?.id ?? '';
}

export function InstantiateTemplateModal({
  open,
  template,
  onClose,
  initialTeamId,
}: InstantiateTemplateModalProps) {
  const { t } = useTranslation('extras');
  const navigate = useNavigate();
  const { teams } = useTeams();
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitResource, setLimitResource] = useState<PlanLimitResource>('projects');

  useEffect(() => {
    if (open) {
      setName(template?.name ?? '');
      setTeamId(resolveDefaultTeamId(teams, initialTeamId));
      setError(null);
    }
  }, [open, template, teams, initialTeamId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!template) return;
    if (!teamId) {
      setError(t('templates.errors.noTeam'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.instantiateTemplate(template.id, teamId, name.trim() || undefined);
      onClose();
      navigate(`/project/${result.projectId}`);
    } catch (err) {
      if (isPlanLimitError(err)) {
        setLimitResource(
          err.details && (err.details as { resource?: string }).resource === 'members'
            ? 'members'
            : 'projects',
        );
        setLimitOpen(true);
      } else {
        setError(getErrorMessage(err, t('templates.errors.instantiate')));
      }
      setSubmitting(false);
    }
  }

  const teamOptions = (teams ?? []).map((tm) => ({ value: tm.id, label: tm.name }));
  const noTeams = teams !== null && teams.length === 0;

  return (
    <>
      <Modal
        open={open && !limitOpen}
        title={t('templates.useTitle')}
        onClose={onClose}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('templates.cancel')}
            </Button>
            <Button
              type="submit"
              form="instantiate-form"
              leftIcon={<Copy size={13} aria-hidden="true" />}
              loading={submitting}
              disabled={!name.trim() || !teamId}
            >
              {t('templates.createProject')}
            </Button>
          </>
        }
      >
        <form id="instantiate-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label={t('templates.projectName')}
            required
            autoFocus
            placeholder={t('templates.projectNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="field">
            {noTeams ? (
              <p className="field-helper" id="instantiate-team-hint">
                {t('templates.teamEmptyHint')}
              </p>
            ) : (
              <SearchableSelect
                id="instantiate-team"
                label={t('templates.targetTeam')}
                allowEmpty={false}
                searchable={teamOptions.length > 6}
                placeholder={t('templates.selectTeam')}
                value={teamId || null}
                options={teamOptions}
                onChange={(v) => setTeamId(v ?? '')}
              />
            )}
          </div>
          <p className="field-helper" id="instantiate-helper">
            {t('templates.instantiateHelper')}
          </p>
          {error && <InlineError>{error}</InlineError>}
        </form>
      </Modal>
      <PlanLimitModal
        open={limitOpen}
        resource={limitResource}
        teamId={teamId}
        onClose={() => {
          setLimitOpen(false);
          onClose();
        }}
      />
    </>
  );
}
