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
      : `${projectCount} ${projectCount === 1 ? 'project' : 'projects'} · ${openIssuesTotal} ${openIssuesTotal === 1 ? 'open issue' : 'open issues'}${outdatedTotal > 0 ? ` · ${outdatedTotal} outdated` : ''}`;

  return (
    <header className="page-header welcome-header">
      <div className="welcome-header-copy">
        <h1 className="page-title">
          {t('dashboard.welcomeTitle', { defaultValue: `Welcome back, ${displayName}`, name: displayName })}
        </h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={onNewProject}>
        {t('dashboard.newProject')}
      </Button>
    </header>
  );
}
