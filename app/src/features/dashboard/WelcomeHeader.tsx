import { Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';

interface WelcomeHeaderProps {
  displayName: string;
  projectCount: number;
  openIssuesTotal: number;
  outdatedTotal: number;
  onNewProject: () => void;
}

export function WelcomeHeader({ displayName, projectCount, openIssuesTotal, outdatedTotal, onNewProject }: WelcomeHeaderProps) {
  const { t } = useTranslation('account');
  const subtitle =
    projectCount === 0
      ? t('dashboard.subtitle')
      : `${t('dashboard.welcome.projects', { count: projectCount })} · ${t('dashboard.welcome.openIssues', { count: openIssuesTotal })}${outdatedTotal > 0 ? t('dashboard.welcome.outdatedSuffix', { count: outdatedTotal }) : ''}`;

  return (
    <header className="page-header welcome-header">
      <div className="welcome-header-copy">
        <h2 className="page-title">
          {t('dashboard.welcome.title', { name: displayName })}
        </h2>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={onNewProject} data-tour-id="create-project">
        {t('dashboard.newProject')}
      </Button>
    </header>
  );
}
