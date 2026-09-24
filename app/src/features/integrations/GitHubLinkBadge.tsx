import { GithubLogo } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { aggregatePrBadge } from '../../lib/github';
import type { GitHubLink } from '../../lib/types';
import { Tooltip } from '../../components/Tooltip';

/**
 * Badge 1 baris agregat PR untuk kartu task (pola GCalSyncedMark):
 * `PR #123 Open · CI failing`. Render null bila tanpa link PR (fail-soft).
 * Detail penuh (branch/commit/review) tinggal di GitHubTaskSection.
 */
const TONE_COLOR: Record<string, string> = {
  info: 'var(--status-info)',
  success: 'var(--status-success)',
  warn: 'var(--status-warn)',
  danger: 'var(--status-danger)',
  muted: 'var(--text-muted)',
};

export function GitHubLinkBadge({ links }: { links: GitHubLink[] | undefined }) {
  const { t } = useTranslation('tracker');
  const badge = aggregatePrBadge(links);
  if (!badge) return null;
  return (
    <Tooltip title={badge.title || t('board.github.openPr', { defaultValue: 'Open pull request' })}>
      <a
        href={badge.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: TONE_COLOR[badge.tone] ?? 'var(--text-muted)',
          textDecoration: 'none',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <GithubLogo size={11} aria-hidden="true" />
        <span>{badge.label}</span>
      </a>
    </Tooltip>
  );
}
