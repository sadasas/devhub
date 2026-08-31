import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowClockwise,
  Buildings,
  ChartLine,
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

const TABS = [
  { id: 'overview', labelKey: 'admin.tabs.overview', Icon: ChartLine },
  { id: 'users', labelKey: 'admin.tabs.users', Icon: UsersThree },
  { id: 'teams', labelKey: 'admin.tabs.teams', Icon: Buildings },
  { id: 'payments', labelKey: 'admin.tabs.payments', Icon: Receipt },
  { id: 'packages', labelKey: 'admin.tabs.packages', Icon: Package },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTabId(value: string | null): value is TabId {
  return TABS.some((x) => x.id === value);
}

export function AdminPage() {
  const { t } = useTranslation('extras');
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const tabParam = searchParams.get('tab');
  const tab: TabId = isTabId(tabParam) ? tabParam : 'overview';

  const ALLOWED_PARAMS: Record<TabId, Set<string>> = {
    overview: new Set(['tab']),
    users: new Set(['tab', 'q', 'plan', 'page']),
    teams: new Set(['tab', 'plan', 'page']),
    payments: new Set(['tab', 'status', 'page']),
    packages: new Set(['tab', 'status']),
  };

  function setTab(next: TabId): void {
    if (next === tab) return;
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (next === 'overview') n.delete('tab');
        else n.set('tab', next);
        const allowed = ALLOWED_PARAMS[next];
        for (const k of [...n.keys()]) if (!allowed.has(k)) n.delete(k);
        return n;
      },
      { replace: true },
    );
  }

  // ARIA APG tabs: roving tabindex + panah kiri/kanan/Home/End (audit H2)
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const next = TABS[nextIndex];
    if (!next) return;
    setTab(next.id);
    document.getElementById(`admin-tab-${next.id}`)?.focus();
  }

  function handleRefresh(): void {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }

  // Dipanggil tiap loader tab selesai (idempoten) untuk mematikan spinner Refresh.
  // Stabil via useCallback agar identitas prop tidak memicu refetch berulang di tab.
  const handleSettled = useCallback((): void => {
    setRefreshing(false);
  }, []);

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
          loading={refreshing}
          leftIcon={<ArrowClockwise size={13} aria-hidden="true" />}
          onClick={handleRefresh}
        >
          {t('admin.refresh')}
        </Button>
      </header>

      <div className="sub-tabs" role="tablist" aria-label={t('admin.tabsAria')}>
        {TABS.map(({ id, labelKey, Icon }, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`admin-tab-${id}`}
            className={`sub-tab ${tab === id ? 'sub-tab-active' : ''}`}
            onClick={() => setTab(id)}
            onKeyDown={(e) => onTabKeyDown(e, i)}
            aria-selected={tab === id}
            aria-controls={`admin-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
          >
            <Icon size={13} aria-hidden="true" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {TABS.map(({ id }) => (
        <div
          key={id}
          id={`admin-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`admin-tab-${id}`}
          hidden={tab !== id}
        >
          {tab === id && (
            <>
              {id === 'overview' && <OverviewTab refreshKey={refreshKey} onSettled={handleSettled} />}
              {id === 'users' && <UsersTab refreshKey={refreshKey} onSettled={handleSettled} />}
              {id === 'teams' && <TeamsTab refreshKey={refreshKey} onSettled={handleSettled} />}
              {id === 'payments' && <PaymentsTab refreshKey={refreshKey} onSettled={handleSettled} />}
              {id === 'packages' && <PackagesTab refreshKey={refreshKey} onSettled={handleSettled} />}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
