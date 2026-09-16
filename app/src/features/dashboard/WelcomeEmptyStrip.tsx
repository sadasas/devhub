import { Plus, UploadSimple, MagnifyingGlass, Users } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';

export function WelcomeEmptyNoTeam({ onCreateTeam }: { onCreateTeam: () => void }) {
  const { t } = useTranslation('account');
  return (
    <div className="welcome-empty-strip" role="status" aria-live="polite">
      <span className="welcome-empty-icon" aria-hidden="true">
        <Users size={22} weight="duotone" />
      </span>
      <h3 className="welcome-empty-title">{t('dashboard.welcome.empty.noTeamTitle')}</h3>
      <p className="welcome-empty-desc">{t('dashboard.welcome.empty.noTeamDesc')}</p>
      <div className="welcome-empty-actions">
        <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={onCreateTeam} data-tour-id="create-team">
          {t('dashboard.welcome.empty.createTeam')}
        </Button>
      </div>
    </div>
  );
}

export function WelcomeEmptyNoProject({
  teamName,
  onCreate,
  onImport,
}: {
  teamName?: string;
  onCreate: () => void;
  onImport?: () => void;
}) {
  const { t } = useTranslation('account');
  return (
    <div className="welcome-empty-strip" role="status">
      <span className="welcome-empty-icon" aria-hidden="true">
        <Plus size={22} weight="duotone" />
      </span>
      <h3 className="welcome-empty-title">{teamName ? t('dashboard.welcome.empty.noProjectIn', { name: teamName }) : t('dashboard.welcome.empty.noProjectTitle')}</h3>
      <p className="welcome-empty-desc">{t('dashboard.welcome.empty.noProjectDesc')}</p>
      <div className="welcome-empty-actions">
        <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={onCreate} data-tour-id="create-project">
          {t('dashboard.welcome.empty.createProject')}
        </Button>
        {onImport && (
          <Button size="md" variant="ghost" leftIcon={<UploadSimple size={14} aria-hidden="true" />} onClick={onImport}>
            {t('dashboard.welcome.empty.import')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function WelcomeEmptyNoResult({ query, onClear }: { query: string; onClear: () => void }) {
  const { t } = useTranslation('account');
  return (
    <div className="welcome-empty-strip welcome-empty-strip-muted" role="status">
      <span className="welcome-empty-icon" aria-hidden="true">
        <MagnifyingGlass size={22} aria-hidden="true" />
      </span>
      <h3 className="welcome-empty-title">{t('dashboard.welcome.empty.noResultTitle', { query })}</h3>
      <p className="welcome-empty-desc">{t('dashboard.welcome.empty.noResultDesc')}</p>
      <div className="welcome-empty-actions">
        <Button size="sm" variant="ghost" onClick={onClear}>
          {t('dashboard.welcome.empty.clearFilter')}
        </Button>
      </div>
    </div>
  );
}
