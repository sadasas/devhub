import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shortId } from '../../lib/utils';
import { DECISION_STATUS } from '../../lib/labels';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { applySort, type SortSpec } from '../../lib/sort';
import type { Decision } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Plus, Scales } from '@phosphor-icons/react';
import { PinButton } from '../../components/PinButton';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { DecisionModal } from './DecisionModal';
import { NewDecisionModal } from './NewDecisionModal';
import { InlineError } from '../../components/InlineError';

const DECISION_SORT_SPECS: SortSpec<Decision>[] = [
  { key: 'date', label: 'decisions.sort.date', get: (d) => d.date },
  {
    key: 'status',
    label: 'decisions.sort.status',
    get: (d) => d.status,
    order: ['proposed', 'accepted', 'rejected', 'superseded'],
  },
  { key: 'createdAt', label: 'decisions.sort.createdAt', get: (d) => d.createdAt },
  { key: 'title', label: 'decisions.sort.title', get: (d) => d.title },
];

export function DecisionsPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { t } = useTranslation('project');
  const { state, loading, error, canEdit, dispatch } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  useEntityDeepLink('decisions', setEditId);
  useNewParam(() => setOpenNew(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };

  if (loading) {
    return (
      <div className="data-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="data-row">
            <div className="data-row-main">
              <Skeleton className="skeleton-row" />
              <Skeleton className="skeleton-row skeleton-row-sm" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <InlineError>{error}</InlineError>
    );
  }

  if (!state) return null;

  const sortSpec = DECISION_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const decisions = applySort(state.decisions, sortSpec, effectiveSort.dir, (d) => !!d.pinned);

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {t('decisions.count', { count: decisions.length })}
        </span>
        <span className="data-list-actions">
          <SortControl
            options={DECISION_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && (
            <Button size="sm" onClick={() => setOpenNew(true)}>
              <Plus size={14} aria-hidden="true" /> {t('decisions.newDecision')}
            </Button>
          )}
        </span>
      </div>

      {decisions.length === 0 ? (
        <EmptyState
          icon={<Scales size={22} />}
          title={t('decisions.emptyTitle')}
          description={t('decisions.emptyDesc')}
          action={
            canEdit && (
              <Button size="sm" onClick={() => setOpenNew(true)}>
                <Plus size={14} /> {t('decisions.newDecision')}
              </Button>
            )
          }
        />
      ) : (
        <div className="data-list">
          {decisions.map((d) => (
            <div key={d.id} className="data-row">
              <button
                type="button"
                className="data-row-main"
                onClick={() => setEditId(d.id)}
              >
                <div className="data-row-title">
                  <Badge tone={DECISION_STATUS[d.status].tone}>
                    {t(`decisions.status.${d.status}`)}
                  </Badge>
                  <span className="row-title-text">{d.title}</span>
                </div>
                {d.context && <div className="data-row-sub">{d.context}</div>}
                <div className="data-row-meta">
                  <span>{d.options.length} option(s)</span>
                  <span># {d.date}</span>
                  <span>#{shortId(d.id)}</span>
                  {unreadIds?.has(d.id) && (
                    <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>
                    )}
                </div>
              </button>              <div className="data-row-side" style={{ justifyContent: 'flex-start', gap: '4px' }}>
                {canEdit && (
                  <PinButton
                    pinned={!!d.pinned}
                    label="decision"
                    onToggle={() =>
                      dispatch({ type: 'decision/update', id: d.id, patch: { pinned: !d.pinned } })
                    }
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {openNew && <NewDecisionModal onClose={() => setOpenNew(false)} />}
      <DecisionModal decisionId={editId} onClose={() => setEditId(null)} />
    </div>
  );
}
