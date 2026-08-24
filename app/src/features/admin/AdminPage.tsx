import { useState } from 'react';
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
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">Platform-wide overview — users, teams, payments and packages.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowClockwise size={13} aria-hidden="true" />}
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          Refresh
        </Button>
      </header>

      <div className="sub-tabs" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'overview' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('overview')}
          aria-selected={tab === 'overview'}
        >
          <ChartLine size={13} aria-hidden="true" />
          Overview
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'users' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('users')}
          aria-selected={tab === 'users'}
        >
          <UsersThree size={13} aria-hidden="true" />
          Users
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'payments' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('payments')}
          aria-selected={tab === 'payments'}
        >
          <Receipt size={13} aria-hidden="true" />
          Payments
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'teams' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('teams')}
          aria-selected={tab === 'teams'}
        >
          <FolderSimple size={13} aria-hidden="true" />
          Teams
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'packages' ? 'sub-tab-active' : ''}`}
          onClick={() => setTab('packages')}
          aria-selected={tab === 'packages'}
        >
          <Package size={13} aria-hidden="true" />
          Packages
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
