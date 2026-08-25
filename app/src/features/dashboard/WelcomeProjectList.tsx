import type { ReactNode } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';

interface WelcomeGroupProps {
  teamName: string;
  count: number;
  openIssues: number;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function WelcomeGroup({ teamName, count, openIssues, expanded, onToggle, children }: WelcomeGroupProps) {
  return (
    <section className="welcome-group" aria-label={teamName}>
      <button type="button" className="welcome-group-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="welcome-group-head-left">
          {expanded ? <CaretDown size={10} weight="bold" aria-hidden="true" /> : <CaretRight size={10} weight="bold" aria-hidden="true" />}
          <span className="welcome-group-name">{teamName}</span>
          <span className="welcome-group-count tabular">
            {count} {count === 1 ? 'project' : 'projects'}
          </span>
        </span>
        {openIssues > 0 && <span className="welcome-group-issues tabular">{openIssues} open</span>}
      </button>
      {expanded && <div className="welcome-group-body" role="list">{children}</div>}
    </section>
  );
}

interface WelcomeProjectListProps {
  children: ReactNode;
}

export function WelcomeProjectList({ children }: WelcomeProjectListProps) {
  return <div className="welcome-list" role="list">{children}</div>;
}
