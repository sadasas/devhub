import { useEffect, useState } from 'react';
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
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { EmptyState } from '../../components/EmptyState';
import { Plus, PushPin, Scales, Trash } from '@phosphor-icons/react';
import { PinButton } from '../../components/PinButton';
import { RowMenu } from '../../components/RowMenu';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { DecisionModal } from './DecisionModal';
import { NewDecisionModal } from './NewDecisionModal';
import { DataErrorState } from '../../components/DataErrorState';

/** Header ringkas ≤640px (count hilang, sort icon-only, + Decision). */
function useIsDecisionsNarrow(): boolean {
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

const DECISION_SORT_SPECS: SortSpec<Decision>[] = [  { key: 'date', label: 'decisions.sort.date', get: (d) => d.date },
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
  const { state, loading, error, loadError, canEdit, dispatch, retryLoad } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useEntityDeepLink('decisions', setEditId);
  useNewParam(() => setOpenNew(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const isNarrow = useIsDecisionsNarrow();

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
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading decisions">
        <span className="sr-only">Loading decisions…</span>
        <div aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ minHeight: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                  <Skeleton style={{ width: `${55 - i * 5}%`, height: 14 }} />
                </div>
                <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 64, height: 11 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                  <Skeleton style={{ width: 52, height: 11 }} />
                </div>
              </div>
              <div className="data-row-side">
                <Skeleton style={{ width: 28, height: 28, borderRadius: 8 }} />
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

  const sortSpec = DECISION_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const decisions = applySort(state.decisions, sortSpec, effectiveSort.dir, (d) => !!d.pinned);

  return (
    <div className="decisions-page">
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
            <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setOpenNew(true)}>
              {isNarrow ? t('decisions.newDecisionShort', { defaultValue: 'Decision' }) : t('decisions.newDecision')}
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
              <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setOpenNew(true)}>
                {isNarrow ? t('decisions.newDecisionShort', { defaultValue: 'Decision' }) : t('decisions.newDecision')}
              </Button>
            )
          }
        />
      ) : (
        <div className="data-list">
          {decisions.map((d) => (
            <div key={d.id} className="data-row">
              <div className="data-row-top">
                <button
                  type="button"
                  className="data-row-title-btn"
                  onClick={() => setEditId(d.id)}
                  aria-label={d.title}
                >
                  <span className="data-row-title">
                    <Badge tone={DECISION_STATUS[d.status].tone}>
                      {t(`decisions.status.${d.status}`)}
                    </Badge>
                    <span className="row-title-text">{d.title}</span>
                  </span>
                </button>
                <span className="data-row-props">
                  {canEdit && !isNarrow && (
                    <span className={`row-swap${d.pinned ? ' is-pinned' : ''}`}>
                      <span className="swap-group">
                        <PinButton
                          pinned={!!d.pinned}
                          label="decision"
                          onToggle={() =>
                            dispatch({ type: 'decision/update', id: d.id, patch: { pinned: !d.pinned } })
                          }
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon btn-danger swap-trash"
                          aria-label={`Delete decision ${d.title}`}
                          title={`Delete decision ${d.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const btn = e.currentTarget;
                            setConfirmDeleteId(d.id);
                            // Blur pointer-only agar :focus-within tidak
                            // nyangkut (pola IssuesPage).
                            if (e.detail !== 0) btn.blur();
                          }}
                        >
                          <Trash size={13} aria-hidden="true" />
                        </button>
                      </span>
                    </span>
                  )}
                  {canEdit && isNarrow && (
                    <RowMenu
                      triggerLabel={`More actions for ${d.title}`}
                      menuLabel={`More actions for ${d.title}`}
                      menuId={`decision-rowmenu-${d.id}`}
                      actions={[
                        {
                          key: 'pin',
                          // English hardcoded mengikuti preseden PinButton.
                          label: d.pinned ? 'Unpin decision' : 'Pin decision',
                          icon: <PushPin size={14} weight={d.pinned ? 'fill' : 'regular'} />,
                          onSelect: () =>
                            dispatch({ type: 'decision/update', id: d.id, patch: { pinned: !d.pinned } }),
                        },
                        {
                          key: 'delete',
                          label: t('decisions.modal.delete'),
                          icon: <Trash size={14} />,
                          danger: true,
                          onSelect: () => setConfirmDeleteId(d.id),
                        },
                      ]}
                    />
                  )}
                </span>
              </div>
              <button
                type="button"
                className="data-row-body"
                onClick={() => setEditId(d.id)}
                aria-label={`${d.title} — ${t('decisions.openDetails', { defaultValue: 'Open decision details' })}`}
              >
                {d.context && <span className="data-row-sub">{d.context}</span>}
                <span className="data-row-meta">
                  <span>{d.options.length} option(s)</span>
                  <span># {d.date}</span>
                  <span>#{shortId(d.id)}</span>
                  {unreadIds?.has(d.id) && (
                    <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>
                    )}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {openNew && <NewDecisionModal onClose={() => setOpenNew(false)} />}
      <DecisionModal decisionId={editId} onClose={() => setEditId(null)} />
      <ConfirmDeleteDialog
        open={confirmDeleteId !== null}
        title={t('decisions.modal.deleteConfirmTitle')}
        description={t('decisions.modal.deleteConfirmBody')}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId === null) return;
          const targetId = confirmDeleteId;
          setConfirmDeleteId(null);
          if (editId === targetId) setEditId(null);
          dispatch({ type: 'decision/remove', id: targetId });
        }}
      />
    </div>
  );
}
