import { Bug, Clock, Stack, SquaresFour, ArrowUpRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface WelcomeHeroMicroProps {
  total: number;
  needsAttention: number;
  done: number;
  totalTasks: number;
  openIssues: number;
  overdue: number;
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
  overdue,
  outdated,
  onFilter,
  activeFilter,
}: WelcomeHeroMicroProps) {
  const { t } = useTranslation('account');
  const pct = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;

  const cards = [
    {
      key: 'all',
      label: t('dashboard.welcome.hero.totalLabel'),
      value: total,
      sub: needsAttention > 0 ? t('dashboard.welcome.hero.needsAttention', { count: needsAttention }) : t('dashboard.welcome.hero.allClear'),
      icon: SquaresFour,
      tone: 'primary' as const,
      onClick: () => onFilter?.('all'),
    },
    {
      key: 'issues',
      label: t('dashboard.welcome.hero.issuesLabel'),
      value: openIssues,
      sub: openIssues === 0 ? t('dashboard.welcome.hero.noOpenIssues') : t('dashboard.welcome.hero.open', { count: openIssues }),
      icon: Bug,
      tone: 'warn' as const,
      onClick: () => onFilter?.('issues'),
    },
    {
      key: 'attention',
      label: t('dashboard.welcome.hero.overdueLabel'),
      value: overdue,
      sub: overdue > 0 ? t('dashboard.welcome.hero.overdue', { count: overdue }) : t('dashboard.welcome.hero.nothingOverdue'),
      icon: Clock,
      tone: 'danger' as const,
      onClick: () => onFilter?.('attention'),
    },
    {
      key: 'outdated',
      label: t('dashboard.welcome.hero.healthLabel'),
      value: outdated,
      sub: outdated === 0 ? t('dashboard.welcome.hero.upToDate') : t('dashboard.welcome.hero.outdated', { count: outdated }),
      icon: Stack,
      tone: 'info' as const,
      onClick: () => onFilter?.('outdated'),
    },
  ];

  return (
    <div className="welcome-hero-bento" role="group" aria-label={t('dashboard.welcome.hero.summaryAria')}>
      {cards.map((c) => {
        // Single-select: tanpa filter = 'all' yang tersorot. Hanya 1 kartu tersorot.
        const isSelected = (activeFilter ?? 'all') === c.key;
        return (
          <button
            key={c.key}
            type="button"
            className={`bento-stat-card${isSelected ? ` bento-stat-selected bento-stat-tone-${c.tone}` : ''}`}
            onClick={c.onClick}
            aria-pressed={isSelected}
          >
            <span className="bento-stat-head">
              <span className={`bento-stat-icon bento-stat-icon-${c.tone}`} aria-hidden="true">
                <c.icon size={16} weight="duotone" />
              </span>
              <span className="bento-stat-arrow" aria-hidden="true">
                <ArrowUpRight size={14} weight="bold" />
              </span>
            </span>
            <span className="bento-stat-value tabular">{c.value}</span>
            <span className="bento-stat-label">{c.label}</span>
            <span className="bento-stat-sub">{c.sub}</span>
            {c.key === 'all' && isSelected && totalTasks > 0 && (
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
