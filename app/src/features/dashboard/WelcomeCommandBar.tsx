import { MagnifyingGlass, CaretDown, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { Team } from '../../lib/types';

type SortOption = 'updated' | 'name' | 'issues' | 'progress';

interface WelcomeCommandBarProps {
  query: string;
  onQuery: (v: string) => void;
  sort: SortOption;
  onSort: (v: SortOption) => void;
  teamFilter: string | 'all';
  onTeamFilter: (v: string | 'all') => void;
  count: number;
  teams: Team[] | null;
}

export function WelcomeCommandBar({
  query,
  onQuery,
  sort,
  onSort,
  teamFilter,
  onTeamFilter,
  count,
  teams,
}: WelcomeCommandBarProps) {
  const { t } = useTranslation('account');
  return (
    <div className="welcome-command-bar" role="search" aria-label={t('dashboard.welcome.search.filterAria')}>
      <div className="welcome-search">
        <MagnifyingGlass size={14} aria-hidden="true" className="welcome-search-icon" />
        <input
          type="text"
          className="welcome-search-input"
          placeholder={t('dashboard.welcome.search.placeholder')}
          aria-label={t('dashboard.welcome.search.aria')}
          value={query}
          maxLength={200}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="welcome-search-clear" aria-label={t('dashboard.welcome.search.clearAria')} onClick={() => onQuery('')}>
            <X size={12} weight="bold" aria-hidden="true" />
          </button>
        )}
        <span className="welcome-search-hint" aria-hidden="true">
          <kbd className="welcome-kbd">⌘</kbd>
          <kbd className="welcome-kbd">K</kbd>
        </span>
      </div>

      <div className="welcome-command-actions">
        <label className="welcome-command-label">
          <span className="welcome-command-label-text">{t('dashboard.welcome.search.sortLabel')}</span>
          <span className="welcome-select-wrap">
            <select
              className="welcome-select"
              value={sort}
              onChange={(e) => onSort(e.target.value as SortOption)}
              aria-label={t('dashboard.welcome.search.sortAria')}
            >
              <option value="updated">{t('dashboard.welcome.search.sortUpdated')}</option>
              <option value="name">{t('dashboard.welcome.search.sortName')}</option>
              <option value="issues">{t('dashboard.welcome.search.sortIssues')}</option>
              <option value="progress">{t('dashboard.welcome.search.sortProgress')}</option>
            </select>
            <CaretDown size={10} aria-hidden="true" className="welcome-select-caret" />
          </span>
        </label>

        <label className="welcome-command-label">
          <span className="welcome-command-label-text">{t('dashboard.welcome.search.teamLabel')}</span>
          <span className="welcome-select-wrap">
            <select
              className="welcome-select"
              value={teamFilter}
              onChange={(e) => onTeamFilter(e.target.value as string | 'all')}
              aria-label={t('dashboard.welcome.search.teamAria')}
            >
              <option value="all">{t('dashboard.welcome.search.allTeams')}</option>
              {(teams ?? []).map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
            <CaretDown size={10} aria-hidden="true" className="welcome-select-caret" />
          </span>
        </label>

        <span className="welcome-count tabular" aria-live="polite" aria-atomic="true">
          {t('dashboard.welcome.search.count', { count })}
        </span>
      </div>
    </div>
  );
}

export type { SortOption };
