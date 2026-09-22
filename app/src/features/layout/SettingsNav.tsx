import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FE_LIMITS } from '../../lib/limits';
import {
  CaretLeft,
  ChartBar,
  CurrencyCircleDollar,
  GearSix,
  MagnifyingGlass,
  Trash,
} from '@phosphor-icons/react';
import { SETTINGS_SUB_KEYS, normalizeSettingsSection, type SettingsSection } from '../dashboard/settingsSections';

interface SettingsNavProps {
  teamSlug: string;
  dashboardTo: string;
  /** Dipanggil saat user memilih section — drawer mobile memakainya untuk menutup. */
  onSelect?: () => void;
}

// Team-settings nav that REPLACES the main sidebar content on the settings
// route (single-sidebar rule): back to app, filter, and the 5 sections.
// Links carry ?section=; the settings tab renders the matching panel, so
// this nav holds no selection state beyond the URL.
export function SettingsNav({ teamSlug, dashboardTo, onSelect }: SettingsNavProps) {
  const { t } = useTranslation('account');
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const active = normalizeSettingsSection(searchParams.get('section'));

  const items: { key: SettingsSection; icon: ReactNode; label: string }[] = [
    { key: 'general', icon: <GearSix size={15} weight="duotone" aria-hidden="true" />, label: t('dashboard.team.settingsGeneralTitle') as string },
    { key: 'plan', icon: <CurrencyCircleDollar size={15} weight="duotone" aria-hidden="true" />, label: t('dashboard.team.settingsNavPlanBilling') as string },
    { key: 'usage', icon: <ChartBar size={15} weight="duotone" aria-hidden="true" />, label: t('dashboard.team.settingsUsageTitle') as string },
    { key: 'danger', icon: <Trash size={15} weight="duotone" aria-hidden="true" />, label: t('dashboard.team.settingsDangerTitle') as string },
  ];
  const filter = query.trim().toLowerCase();
  // Unresolved i18n keys echo back as-is — drop them so raw keys never leak.
  const subLabel = (key: string): string | null => {
    const value = t(key) as string;
    return value && value !== key ? value : null;
  };
  const visible = items
    .map((item) => {
      const subs = SETTINGS_SUB_KEYS[item.key]
        .map(subLabel)
        .filter((label): label is string => label !== null)
        .filter((label) => !filter || label.toLowerCase().includes(filter));
      const matched = !filter || item.label.toLowerCase().includes(filter) || subs.length > 0;
      return { item, subs: filter ? subs.slice(0, 2) : [], matched };
    })
    .filter((row) => row.matched);
  const base = `/${encodeURIComponent(teamSlug)}/settings`;

  return (
    <nav className="settings-nav" aria-label={t('dashboard.team.settingsHeading') as string}>
      <Link to={dashboardTo} className="sidebar-item settings-nav-back">
        <CaretLeft size={15} weight="duotone" aria-hidden="true" />
        <span className="sidebar-item-label">{t('dashboard.team.settingsNavBack')}</span>
      </Link>
      <div className="settings-nav-search" role="search">
        <MagnifyingGlass size={14} aria-hidden="true" className="settings-nav-search-icon" />
        <input
          type="text"
          className="settings-nav-search-input"
          placeholder={t('dashboard.team.settingsNavSearchPlaceholder') as string}
          aria-label={t('dashboard.team.settingsNavSearchAria') as string}
          value={query}
          maxLength={FE_LIMITS.SEARCH}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {visible.map(({ item, subs }) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            to={`${base}?section=${item.key}`}
            className={isActive ? 'sidebar-item sidebar-item-active settings-nav-item' : 'sidebar-item settings-nav-item'}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              setQuery('');
              onSelect?.();
            }}
          >
            {item.icon}
            <span className="settings-nav-item-text">
              <span className="sidebar-item-label">{item.label}</span>
              {subs.length > 0 && (
                <span className="settings-nav-item-sub">
                  {t('dashboard.team.settingsNavMatches') as string} {subs.join(' · ')}
                </span>
              )}
            </span>
          </Link>
        );
      })}
      {visible.length === 0 && (
        <p role="status" className="settings-nav-empty">{t('dashboard.team.settingsNavNoResults')}</p>
      )}
    </nav>
  );
}
