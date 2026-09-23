import { useEffect, useState } from 'react';
import { Bug, Plus, PushPin, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { ISSUE_SEVERITY, ISSUE_STATUS } from '../../lib/labels';
import { IssueStatusIcon, TaskSeverityIcon } from '../../lib/task-icons';
import { applySort, type SortSpec } from '../../lib/sort';
import { shortId } from '../../lib/utils';
import type { Issue } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { EmptyState } from '../../components/EmptyState';
import { PinButton } from '../../components/PinButton';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { IssueModal } from './IssueModal';
import { NewIssueModal } from './NewIssueModal';
import { DataErrorState } from '../../components/DataErrorState';
import { RowMenu } from '../../components/RowMenu';

/** Header ringkas ≤640px (count hilang, sort icon-only, + Issue). */
function useIsIssuesNarrow(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (): void => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}

const ISSUE_SORT_SPECS: SortSpec<Issue>[] = [  {
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
  const { state, loading, error, loadError, canEdit, dispatch, retryLoad } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { t } = useTranslation('tracker');
  useEntityDeepLink('issues', setEditingId);
  useNewParam(() => setCreating(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const isNarrow = useIsIssuesNarrow();

  if (loading) {
    return (
      <>
      <div className="data-list-header" aria-hidden="true">
        <Skeleton style={{ width: 90, height: 13 }} />
        <span className="data-list-actions" style={{ display: 'flex', gap: 8 }}>
          <Skeleton style={{ width: 110, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 96, height: 28, borderRadius: 8 }} />
        </span>
      </div>
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading issues">
        <span className="sr-only">Loading issues…</span>
        <div aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ minHeight: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                  <Skeleton style={{ width: `${55 - i * 5}%`, height: 14 }} />
                </div>
                <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
                <Skeleton style={{ width: '55%', height: 11, opacity: 0.65 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 64, height: 11 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                </div>
              </div>
              <div className="data-row-side" style={{ justifyContent: 'flex-start', gap: 4 }}>
                <Skeleton style={{ width: 56, height: 18, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
    );
  }

  if (error) {
    return <DataErrorState error={loadError ?? error} onRetry={retryLoad} />;
  }

  if (!state) return null;

  const sortSpec = ISSUE_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const issues = applySort(state.issues, sortSpec, effectiveSort.dir, (i) => !!i.pinned);

  return (
    <div className="issues-page">
      <div className="data-list-header">
        <span className="data-list-count">{t('issues.count', { count: issues.length })}</span>
        <span className="data-list-actions">
          <SortControl
            options={ISSUE_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
              {isNarrow ? t('issues.newIssueShort', { defaultValue: 'Issue' }) : t('issues.newIssue')}
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
              <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
                {isNarrow ? t('issues.newIssueShort', { defaultValue: 'Issue' }) : t('issues.newIssue')}
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
              <div key={issue.id} className={`data-row issue-row${issue.pinned ? ' is-pinned' : ''}`}>
                <div className="data-row-top">
                  <button
                    type="button"
                    className="data-row-btn"
                    onClick={() => setEditingId(issue.id)}
                    aria-label={issue.title}
                  >
                    <span className="data-row-title">
                      <Badge tone={ISSUE_SEVERITY[issue.severity].tone}>
                        <TaskSeverityIcon severity={issue.severity} size={11} />
                        {t(`issues.severity.${issue.severity}`)}
                      </Badge>
                      <span className="row-title-text">{issue.title}</span>
                    </span>
                  </button>
                  <span className="data-row-props">
                    {canEdit ? (
                      <span className={`row-swap${issue.pinned ? ' is-pinned' : ''}`}>
                        <span className="swap-status">
                      <Badge tone={ISSUE_STATUS[issue.status].tone}>
                        <IssueStatusIcon status={issue.status} size={11} />
                        {t(`issues.status.${issue.status}`)}
                      </Badge>
                        </span>
                        {!isNarrow && (
                          <span className="swap-group">
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
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icon btn-danger swap-trash"
                              aria-label={`Delete issue ${issue.title}`}
                              title={`Delete issue ${issue.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const btn = e.currentTarget;
                                setConfirmDeleteId(issue.id);
                                // Sama seperti PinButton: blur pointer-only agar
                                // :focus-within tidak nyangkut. Bonus: focus trap
                                // mengembalikan fokus ke body (bukan Trash) saat
                                // dialog ditutup via pointer, jadi actions tetap
                                // hilang. Keyboard (detail 0) tetap restore ke Trash.
                                if (e.detail !== 0) btn.blur();
                              }}
                            >
                              <Trash size={13} aria-hidden="true" />
                            </button>
                          </span>
                        )}
                        {isNarrow && (
                          <RowMenu
                            triggerLabel={`More actions for ${issue.title}`}
                            menuLabel={`More actions for ${issue.title}`}
                            menuId={`issue-rowmenu-${issue.id}`}
                            actions={[
                              {
                                key: 'pin',
                                // English hardcoded mengikuti preseden PinButton
                                // ("Pin/Unpin issue") dan menu Archive/Restore
                                // di ProjectPage.
                                label: issue.pinned ? 'Unpin issue' : 'Pin issue',
                                icon: <PushPin size={14} weight={issue.pinned ? 'fill' : 'regular'} />,
                                onSelect: () =>
                                  dispatch({
                                    type: 'issue/update',
                                    id: issue.id,
                                    patch: { pinned: !issue.pinned },
                                  }),
                              },
                              {
                                key: 'delete',
                                label: t('issues.modal.delete'),
                                icon: <Trash size={14} />,
                                danger: true,
                                onSelect: () => setConfirmDeleteId(issue.id),
                              },
                            ]}
                          />
                        )}
                      </span>
                    ) : (
                      <Badge tone={ISSUE_STATUS[issue.status].tone}>
                        <IssueStatusIcon status={issue.status} size={11} />
                        {t(`issues.status.${issue.status}`)}
                      </Badge>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  className="data-row-body"
                  onClick={() => setEditingId(issue.id)}
                  aria-label={`${issue.title} — ${t('issues.openDetails', { defaultValue: 'Open issue details' })}`}
                >
                  {issue.description && <span className="data-row-sub">{issue.description}</span>}
                  {issue.reproduction && <span className="data-row-sub">{issue.reproduction}</span>}
                  <span className="data-row-meta">
                    {linked && <span>{t('issues.linkedTo', { title: linked.title })}</span>}
                    <span>#{shortId(issue.id)}</span>
                    {unreadIds?.has(issue.id) && (
                      <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <NewIssueModal open={creating} onClose={() => setCreating(false)} />
      <IssueModal issueId={editingId} onClose={() => setEditingId(null)} />
      <ConfirmDeleteDialog
        open={confirmDeleteId !== null}
        title={t('issues.modal.deleteConfirmTitle')}
        description={t('issues.modal.deleteConfirmBody')}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId === null) return;
          const targetId = confirmDeleteId;
          setConfirmDeleteId(null);
          if (editingId === targetId) setEditingId(null);
          dispatch({ type: 'issue/remove', id: targetId });
        }}
      />
    </div>
  );
}
