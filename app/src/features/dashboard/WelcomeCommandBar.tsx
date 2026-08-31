import { MagnifyingGlass, CaretDown, X } from '@phosphor-icons/react';
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
  return (
    <div className="welcome-command-bar" role="search" aria-label="Filter projects">
      <div className="welcome-search">
        <MagnifyingGlass size={14} aria-hidden="true" className="welcome-search-icon" />
        <input
          type="text"
          className="welcome-search-input"
          placeholder="Search projects…"
          aria-label="Search projects"
          value={query}
          maxLength={200}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="welcome-search-clear" aria-label="Clear search" onClick={() => onQuery('')}>
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
          <span className="welcome-command-label-text">Sort</span>
          <span className="welcome-select-wrap">
            <select
              className="welcome-select"
              value={sort}
              onChange={(e) => onSort(e.target.value as SortOption)}
              aria-label="Sort projects"
            >
              <option value="updated">Updated</option>
              <option value="name">Name</option>
              <option value="issues">Issues</option>
              <option value="progress">Progress</option>
            </select>
            <CaretDown size={10} aria-hidden="true" className="welcome-select-caret" />
          </span>
        </label>

        <label className="welcome-command-label">
          <span className="welcome-command-label-text">Team</span>
          <span className="welcome-select-wrap">
            <select
              className="welcome-select"
              value={teamFilter}
              onChange={(e) => onTeamFilter(e.target.value as string | 'all')}
              aria-label="Filter by team"
            >
              <option value="all">All teams</option>
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
          {count} {count === 1 ? 'project' : 'projects'}
        </span>
      </div>
    </div>
  );
}

export type { SortOption };
