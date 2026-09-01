import { useState } from 'react';
import { Bug, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { ISSUE_SEVERITY, ISSUE_STATUS } from '../../lib/labels';
import { applySort, type SortSpec } from '../../lib/sort';
import { shortId } from '../../lib/utils';
import type { Issue } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PinButton } from '../../components/PinButton';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { IssueModal } from './IssueModal';
import { NewIssueModal } from './NewIssueModal';
import { InlineError } from '../../components/InlineError';

const ISSUE_SORT_SPECS: SortSpec<Issue>[] = [
  {
    key: 'severity',
    label: 'issues.sort.severity',
    get: (i) => i.severity,
    order: ['critical', 'high', 'medium', 'low'],
  },
  {
    key: 'status',
    label: 'issues.sort.status',
    get: (i) => i.status,
    order: ['open', 'reproduced', 'fixing', 'resolved', 'wontfix'],
  },
  { key: 'createdAt', label: 'issues.sort.createdAt', get: (i) => i.createdAt },
  { key: 'title', label: 'issues.sort.title', get: (i) => i.title },
];

export function IssuesPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { state, loading, error, canEdit, dispatch } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { t } = useTranslation('tracker');
  useEntityDeepLink('issues', setEditingId);
  useNewParam(() => setCreating(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };

  if (loading) {
    return (
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading issues">
        <span className="sr-only">Loading issues…</span>
        <div aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ height: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                  <Skeleton style={{ width: `${55 - i * 5}%`, height: 14 }} />
                </div>
                <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 64, height: 11, borderRadius: 999 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                </div>
              </div>
              <div className="data-row-side" style={{ justifyContent: 'flex-start', gap: 4 }}>
                <Skeleton style={{ width: 56, height: 18, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <InlineError>
        {error}
      </InlineError>
    );
  }

  if (!state) return null;

  const sortSpec = ISSUE_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const issues = applySort(state.issues, sortSpec, effectiveSort.dir, (i) => !!i.pinned);

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">{t('issues.count', { count: issues.length })}</span>
        <span className="data-list-actions">
          <SortControl
            options={ISSUE_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
              {t('issues.newIssue')}
            </Button>
          )}
        </span>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          icon={<Bug size={22} />}
          title={t('issues.emptyTitle')}
          description={t('issues.emptyDesc')}
          action={
            canEdit && (
              <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
                {t('issues.logIssue')}
              </Button>
            )
          }
        />
      ) : (
        <div className="data-list">
          {issues.map((issue) => {
            const linked = issue.linkedTaskId
              ? state.tasks.find((t) => t.id === issue.linkedTaskId)
              : undefined;
return (
              <div key={issue.id} className="data-row">
                <button
                  type="button"
                  className="data-row-main"
                  onClick={() => setEditingId(issue.id)}
                >
                  <div className="data-row-title">
                    <Badge tone={ISSUE_SEVERITY[issue.severity].tone}>
                      {t(`issues.severity.${issue.severity}`)}
                    </Badge>
                    <span className="row-title-text">{issue.title}</span>
                  </div>
                  {issue.description && <div className="data-row-sub">{issue.description}</div>}
                  {issue.reproduction && <div className="data-row-sub">{issue.reproduction}</div>}
                  <div className="data-row-meta">
                    {linked && <span>{t('issues.linkedTo', { title: linked.title })}</span>}
                    <span>#{shortId(issue.id)}</span>
                    {unreadIds?.has(issue.id) && (
                      <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>
                      )}
                  </div>
                </button>
                <div className="data-row-side" style={{ justifyContent: 'flex-start', gap: '4px' }}>
                  <Badge tone={ISSUE_STATUS[issue.status].tone}>{t(`issues.status.${issue.status}`)}</Badge>
                  {canEdit && (
                    <PinButton
                      pinned={!!issue.pinned}
                      label="issue"
                      onToggle={() =>
                        dispatch({
                          type: 'issue/update',
                          id: issue.id,
                          patch: { pinned: !issue.pinned },
                        })
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewIssueModal open={creating} onClose={() => setCreating(false)} />
      <IssueModal issueId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}
