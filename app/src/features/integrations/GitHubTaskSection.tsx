import { useTranslation } from 'react-i18next';
import { ArrowSquareOut, Check, Copy, GitBranch, GitCommit, GitPullRequest, Trash } from '@phosphor-icons/react';
import type { GitHubLink, Task } from '../../lib/types';
import { formatBranchName, hasMergedUnresolved, shortTaskKey } from '../../lib/github';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Button } from '../../components/Button';

interface GitHubTaskSectionProps {
  task: Task;
  canEdit: boolean;
  onChanged: (links: GitHubLink[]) => void;
  onMarkDone: () => void;
}

const KIND_ICON = {
  branch: GitBranch,
  pr: GitPullRequest,
  commit: GitCommit,
} as const;

function linkLabel(link: GitHubLink): string {
  const base = link.kind === 'pr' ? `PR #${link.ref}` : link.kind === 'branch' ? link.ref : link.ref.slice(0, 7);
  return `${base} · ${link.repo}`;
}

export function GitHubTaskSection({ task, canEdit, onChanged, onMarkDone }: GitHubTaskSectionProps) {
  const { t } = useTranslation('tracker');
  const { copied, copy } = useCopyFeedback();
  const links = task.githubLinks ?? [];
  const showSuggestDone = hasMergedUnresolved(task.githubLinks, task.status);
  const branchCmd = `git checkout -b ${formatBranchName(task.id, task.title)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 className="detail-subtitle">GitHub</h4>
      {showSuggestDone && canEdit && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--status-success-dim)',
            fontSize: 13,
          }}
        >
          <span>
            {t('board.github.mergedSuggest', {
              defaultValue: 'A linked PR was merged. Mark this task done?',
            })}
          </span>
          <Button type="button" variant="primary" size="sm" onClick={onMarkDone}>
            {t('board.github.markDone', { defaultValue: 'Mark done' })}
          </Button>
        </div>
      )}
      {links.length === 0 ? (
        <p className="field-helper">
          {t('board.github.noLinks', {
            defaultValue: 'No linked branches or PRs yet. Include DEV-{{key}} in a branch or PR to link automatically.',
            key: shortTaskKey(task.id),
          })}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {links.map((link) => {
            const Icon = KIND_ICON[link.kind] ?? GitCommit;
            return (
              <li
                key={link.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: 'var(--bg-inset)',
                  fontSize: 13,
                  minWidth: 0,
                }}
              >
                <Icon size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={link.title || linkLabel(link)}>
                  {linkLabel(link)}
                  {link.ciState === 'fail' && ' · CI failing'}
                  {link.reviewState === 'approved' && ' · Approved'}
                </span>
                {link.url && (
                  <a href={link.url} target="_blank" rel="noreferrer" aria-label={t('board.github.openInGithub', { defaultValue: 'Open in GitHub' })} style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
                    <ArrowSquareOut size={14} aria-hidden="true" />
                  </a>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('board.github.unlink', { defaultValue: 'Unlink {{ref}}', ref: link.ref })}
                    onClick={() => onChanged(links.filter((l) => l.id !== link.id))}
                  >
                    <Trash size={14} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 12,
            padding: '6px 8px',
            borderRadius: 8,
            background: 'var(--bg-inset)',
            color: 'var(--text-secondary)',
          }}
          title={branchCmd}
        >
          {branchCmd}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leftIcon={copied ? <Check size={14} weight="bold" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          onClick={() => void copy(branchCmd)}
          aria-live="polite"
        >
          {copied
            ? t('board.github.copied', { defaultValue: 'Copied' })
            : t('board.github.copyBranch', { defaultValue: 'Copy branch' })}
        </Button>
      </div>
      {!canEdit && links.length > 0 && (
        <p className="field-helper">
          {t('board.github.readonly', { defaultValue: 'Read-only: only editors can unlink.' })}
        </p>
      )}
    </div>
  );
}
