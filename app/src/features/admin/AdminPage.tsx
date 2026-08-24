import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowClockwise,
  ChartLine,
  FolderSimple,
  Package,
  Receipt,
  UsersThree,
} from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { OverviewTab } from './OverviewTab';
import { PaymentsTab } from './PaymentsTab';
import { PackagesTab } from './PackagesTab';
import { TeamsTab } from './TeamsTab';
import { UsersTab } from './UsersTab';

type Tab = 'overview' | 'users' | 'payments' | 'teams' | 'packages';

export function AdminPage() {
  const { t } = useTranslation('extras');
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('admin.title')}</h1>
          <p className="page-subtitle">{t('admin.subtitle')}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowClockwise size={13} aria-hidden="true" />}
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          {t('admin.refresh')}
        </Button>
      </header>

      <div className="sub-tabs" role="tablist" aria-label={t('admin.tabsAria')}>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'overview' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('overview')}
          aria-selected={tab === 'overview'}
        >
          <ChartLine size={13} aria-hidden="true" />
          {t('admin.tabs.overview')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'users' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('users')}
          aria-selected={tab === 'users'}
        >
          <UsersThree size={13} aria-hidden="true" />
          {t('admin.tabs.users')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'payments' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('payments')}
          aria-selected={tab === 'payments'}
        >
          <Receipt size={13} aria-hidden="true" />
          {t('admin.tabs.payments')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'teams' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('teams')}
          aria-selected={tab === 'teams'}
        >
          <FolderSimple size={13} aria-hidden="true" />
          {t('admin.tabs.teams')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'packages' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('packages')}
          aria-selected={tab === 'packages'}
        >
          <Package size={13} aria-hidden="true" />
          {t('admin.tabs.packages')}
        </button>
      </div>

      {tab === 'overview' && <OverviewTab refreshKey={refreshKey} />}
      {tab === 'users' && <UsersTab refreshKey={refreshKey} />}
      {tab === 'payments' && <PaymentsTab refreshKey={refreshKey} />}
      {tab === 'teams' && <TeamsTab refreshKey={refreshKey} />}
      {tab === 'packages' && <PackagesTab refreshKey={refreshKey} />}
    </div>
  );
}
