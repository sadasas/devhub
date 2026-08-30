import { Bug, Clock, Stack, SquaresFour, ArrowUpRight } from '@phosphor-icons/react';

interface WelcomeHeroMicroProps {
  total: number;
  needsAttention: number;
  done: number;
  totalTasks: number;
  openIssues: number;
  outdated: number;
  onFilter?: (kind: 'all' | 'attention' | 'issues' | 'outdated') => void;
  activeFilter?: string;
}

export function WelcomeHeroMicro({
  total,
  needsAttention,
  done,
  totalTasks,
  openIssues,
  outdated,
  onFilter,
  activeFilter,
}: WelcomeHeroMicroProps) {
  const pct = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;

  const cards = [
    {
      key: 'all',
      label: 'Total Projects',
      value: total,
      sub: needsAttention > 0 ? `${needsAttention} need attention` : 'all clear',
      icon: SquaresFour,
      tone: 'primary' as const,
      onClick: () => onFilter?.('all'),
    },
    {
      key: 'issues',
      label: 'Open Issues',
      value: openIssues,
      sub: openIssues === 0 ? 'no open issues' : `${openIssues} open`,
      icon: Bug,
      tone: 'warn' as const,
      onClick: () => onFilter?.('issues'),
    },
    {
      key: 'attention',
      label: 'Overdue Tasks',
      value: Math.max(0, totalTasks - done > 0 ? Math.min(needsAttention, totalTasks - done) : 0),
      sub: needsAttention > 0 ? 'due today + overdue' : 'nothing overdue',
      icon: Clock,
      tone: 'danger' as const,
      onClick: () => onFilter?.('attention'),
    },
    {
      key: 'outdated',
      label: 'Stack Health',
      value: outdated,
      sub: outdated === 0 ? 'all up to date' : `${outdated} outdated`,
      icon: Stack,
      tone: 'info' as const,
      onClick: () => onFilter?.('outdated'),
    },
  ];

  return (
    <div className="welcome-hero-bento" aria-label="Workspace summary">
      {cards.map((c) => {
        const isActive = activeFilter === c.key;
        const isPrimary = c.tone === 'primary';
        return (
          <button
            key={c.key}
            type="button"
            className={`bento-stat-card${isPrimary ? ' bento-stat-primary' : ''}${isActive ? ' bento-stat-active' : ''}`}
            onClick={c.onClick}
            aria-pressed={isActive}
            aria-label={`${c.label}: ${c.value}`}
          >
            <span className="bento-stat-head">
              <span className={`bento-stat-icon bento-stat-icon-${c.tone}`} aria-hidden="true">
                <c.icon size={22} weight="duotone" />
              </span>
              <span className="bento-stat-arrow" aria-hidden="true">
                <ArrowUpRight size={14} weight="bold" />
              </span>
            </span>
            <span className="bento-stat-value tabular">{c.value}</span>
            <span className="bento-stat-label">{c.label}</span>
            <span className="bento-stat-sub">{c.sub}</span>
            {isPrimary && totalTasks > 0 && (
              <span className="bento-stat-track" aria-hidden="true">
                <span className="bento-stat-fill" style={{ width: `${pct}%` }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
