import { useState } from 'react';
import { CheckSquare, PencilSimple, Plus } from '@phosphor-icons/react';
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
import { EmptyState } from '../../components/EmptyState';
import { PinButton } from '../../components/PinButton';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { NewTestModal } from './NewTestModal';
import { TestModal } from './TestModal';
import { InlineError } from '../../components/InlineError';

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
  const { state, loading, error, canEdit, dispatch } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { t } = useTranslation('tracker');
  useEntityDeepLink('testCases', setEditingId);
  useNewParam(() => setCreating(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };

  if (loading) {
    return (
      <div className="data-list" aria-hidden="true">
        <div className="data-row">
          <Skeleton style={{ height: 16, width: '60%' }} />
        </div>
        <div className="data-row">
          <Skeleton style={{ height: 16, width: '45%' }} />
        </div>
        <div className="data-row">
          <Skeleton style={{ height: 16, width: '70%' }} />
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

  const sortSpec = TEST_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const tests = applySort(state.testCases, sortSpec, effectiveSort.dir, (t) => !!t.pinned);

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">{t('tests.count', { count: tests.length })}</span>
        <span className="data-list-actions">
          <SortControl
            options={TEST_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
              {t('tests.newTestCase')}
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
              <Button leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
                {t('tests.addTestCase')}
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
                <button
                  type="button"
                  className="data-row-main"
                  onClick={() => setEditingId(test.id)}
                >
                  <div className="data-row-title">
                    <span className="row-title-text">{test.name}</span>
                  </div>
                  <div className="data-row-sub">
                    {t('tests.rowSteps', { steps: test.steps || '—' })}
                    {test.expected && <span> · {t('tests.rowExpected', { expected: test.expected })}</span>}
                  </div>
                  <div className="data-row-meta">
                    {linkedTask && <span>{t('tests.metaTask', { title: linkedTask.title })}</span>}
                    {linkedIssue && <span>{t('tests.metaIssue', { title: linkedIssue.title })}</span>}
                    <span>#{shortId(test.id)}</span>
                    {unreadIds?.has(test.id) && (
                      <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>
                      )}
                  </div>
                </button>
                <div className="data-row-side">
                  <Badge tone={TEST_CASE_STATUS[test.status].tone}>
                    {t(`tests.status.${test.status}`)}
                  </Badge>
                  {canEdit && (
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
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-icon"
                      aria-label={t('tests.editAria')}
                      onClick={() => setEditingId(test.id)}
                    >
                      <PencilSimple size={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewTestModal open={creating} onClose={() => setCreating(false)} />
      <TestModal testId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}
