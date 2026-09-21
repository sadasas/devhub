import { useEffect, useState } from 'react';
import { CheckSquare, Plus, PushPin, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { TEST_CASE_STATUS } from '../../lib/labels';
import { applySort, type SortSpec } from '../../lib/sort';
import { shortId } from '../../lib/utils';
import type { TestCase } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { EmptyState } from '../../components/EmptyState';
import { PinButton } from '../../components/PinButton';
import { RowMenu } from '../../components/RowMenu';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { NewTestModal } from './NewTestModal';
import { TestModal } from './TestModal';
import { DataErrorState } from '../../components/DataErrorState';

/** Header ringkas ≤640px (count hilang, sort icon-only, + Test case). */
function useIsTestsNarrow(): boolean {
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

const TEST_SORT_SPECS: SortSpec<TestCase>[] = [
  {
    key: 'status',
    label: 'tests.sort.status',
    get: (t) => t.status,
    order: ['pending', 'pass', 'fail'],
  },
  { key: 'name', label: 'tests.sort.name', get: (t) => t.name },
  { key: 'createdAt', label: 'tests.sort.createdAt', get: (t) => t.createdAt },
];

export function TestsPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { state, loading, error, loadError, canEdit, dispatch, retryLoad } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { t } = useTranslation('tracker');
  useEntityDeepLink('testCases', setEditingId);
  useNewParam(() => setCreating(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const isNarrow = useIsTestsNarrow();

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
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading tests">
        <span className="sr-only">Loading tests…</span>
        <div aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ minHeight: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: '55%', height: 14 }} />
                </div>
                <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
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

  const sortSpec = TEST_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const tests = applySort(state.testCases, sortSpec, effectiveSort.dir, (t) => !!t.pinned);

  return (
    <div className="tests-page">
      <div className="data-list-header">
        <span className="data-list-count">{t('tests.count', { count: tests.length })}</span>
        <span className="data-list-actions">
          <SortControl
            options={TEST_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
              {isNarrow ? t('tests.newTestCaseShort', { defaultValue: 'Test case' }) : t('tests.newTestCase')}
            </Button>
          )}
        </span>
      </div>

      {tests.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={22} />}
          title={t('tests.emptyTitle')}
          description={t('tests.emptyDesc')}
          action={
            canEdit && (
              <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
                {isNarrow ? t('tests.newTestCaseShort', { defaultValue: 'Test case' }) : t('tests.newTestCase')}
              </Button>
            )
          }
        />
      ) : (
        <div className="data-list">
          {tests.map((test) => {
            const linkedTask = test.taskId ? state.tasks.find((t) => t.id === test.taskId) : undefined;
            const linkedIssue = test.issueId
              ? state.issues.find((i) => i.id === test.issueId)
              : undefined;
return (
              <div key={test.id} className="data-row">
                <div className="data-row-top">
                  <button
                    type="button"
                    className="data-row-title-btn"
                    onClick={() => setEditingId(test.id)}
                    aria-label={test.name}
                  >
                    <span className="data-row-title">
                      <span className="row-title-text">{test.name}</span>
                    </span>
                  </button>
                  <span className="data-row-props">
                    {canEdit ? (
                      <span className={`row-swap${test.pinned ? ' is-pinned' : ''}`}>
                        <span className="swap-status">
                          <Badge tone={TEST_CASE_STATUS[test.status].tone}>
                            {t(`tests.status.${test.status}`)}
                          </Badge>
                        </span>
                        {!isNarrow && (
                          <span className="swap-group">
                            <PinButton
                              pinned={!!test.pinned}
                              label="test case"
                              onToggle={() =>
                                dispatch({
                                  type: 'testCase/update',
                                  id: test.id,
                                  patch: { pinned: !test.pinned },
                                })
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icon btn-danger swap-trash"
                              aria-label={`Delete test case ${test.name}`}
                              title={`Delete test case ${test.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const btn = e.currentTarget;
                                setConfirmDeleteId(test.id);
                                // Blur pointer-only agar :focus-within tidak
                                // nyangkut (pola IssuesPage).
                                if (e.detail !== 0) btn.blur();
                              }}
                            >
                              <Trash size={13} aria-hidden="true" />
                            </button>
                          </span>
                        )}
                        {isNarrow && (
                          <RowMenu
                            triggerLabel={`More actions for ${test.name}`}
                            menuLabel={`More actions for ${test.name}`}
                            menuId={`test-rowmenu-${test.id}`}
                            actions={[
                              {
                                key: 'pin',
                                // English hardcoded mengikuti preseden PinButton.
                                label: test.pinned ? 'Unpin test case' : 'Pin test case',
                                icon: <PushPin size={14} weight={test.pinned ? 'fill' : 'regular'} />,
                                onSelect: () =>
                                  dispatch({
                                    type: 'testCase/update',
                                    id: test.id,
                                    patch: { pinned: !test.pinned },
                                  }),
                              },
                              {
                                key: 'delete',
                                label: t('tests.modal.delete'),
                                icon: <Trash size={14} />,
                                danger: true,
                                onSelect: () => setConfirmDeleteId(test.id),
                              },
                            ]}
                          />
                        )}
                      </span>
                    ) : (
                      <Badge tone={TEST_CASE_STATUS[test.status].tone}>
                        {t(`tests.status.${test.status}`)}
                      </Badge>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  className="data-row-body"
                  onClick={() => setEditingId(test.id)}
                  aria-label={`${test.name} — ${t('tests.openDetails', { defaultValue: 'Open test case details' })}`}
                >
                  <span className="data-row-sub">
                    {t('tests.rowSteps', { steps: test.steps || '—' })}
                    {test.expected && <span> · {t('tests.rowExpected', { expected: test.expected })}</span>}
                  </span>
                  <span className="data-row-meta">
                    {linkedTask && <span>{t('tests.metaTask', { title: linkedTask.title })}</span>}
                    {linkedIssue && <span>{t('tests.metaIssue', { title: linkedIssue.title })}</span>}
                    <span>#{shortId(test.id)}</span>
                    {unreadIds?.has(test.id) && (
                      <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>
                      )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <NewTestModal open={creating} onClose={() => setCreating(false)} />
      <TestModal testId={editingId} onClose={() => setEditingId(null)} />
      <ConfirmDeleteDialog
        open={confirmDeleteId !== null}
        title={t('tests.modal.deleteConfirmTitle')}
        description={t('tests.modal.deleteConfirmBody')}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId === null) return;
          const targetId = confirmDeleteId;
          setConfirmDeleteId(null);
          if (editingId === targetId) setEditingId(null);
          dispatch({ type: 'testCase/remove', id: targetId });
        }}
      />
    </div>
  );
}
