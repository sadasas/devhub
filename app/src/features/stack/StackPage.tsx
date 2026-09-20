import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ListBullets, Plus, ShareNetwork, Stack } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { TechEntry, TechEntryCategory } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { TECH_CATEGORY, TECH_STATUS } from '../../lib/labels';
import { applySort, type SortSpec } from '../../lib/sort';
import { shortId } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { NewTechModal } from './NewTechModal';
import { TechModal } from './TechModal';
import { StackGraph } from './StackGraph';
import { DataErrorState } from '../../components/DataErrorState';

const CATEGORY_ORDER: TechEntryCategory[] = ['frontend', 'backend', 'database', 'tooling'];

const TECH_SORT_SPECS: SortSpec<TechEntry>[] = [
  { key: 'category', label: 'stack.sort.category', get: (e) => e.category, order: CATEGORY_ORDER },
  { key: 'name', label: 'stack.sort.name', get: (e) => e.name },
  { key: 'createdAt', label: 'stack.sort.createdAt', get: (e) => e.createdAt },
  {
    key: 'status',
    label: 'stack.sort.status',
    get: (e) => e.status,
    order: ['current', 'updateAvailable', 'majorUpgrade'],
  },
  { key: 'version', label: 'stack.sort.version', get: (e) => e.version || null },
];

type StackView = 'list' | 'graph';

/** Header ringkas ≤640px (count hilang, mode/sort icon-only, + Entry). */
function useIsStackNarrow(): boolean {
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

export function StackPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { t } = useTranslation('project');
  const { state, loading, error, loadError, canEdit, retryLoad } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const view: StackView = searchParams.get('stackView') === 'graph' ? 'graph' : 'list';
  const setView = useCallback(
    (next: StackView) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('stackView', next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const tabListRef = useRef<HTMLButtonElement>(null);
  const tabGraphRef = useRef<HTMLButtonElement>(null);
  const handleViewKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next: StackView = view === 'list' ? 'graph' : 'list';
      setView(next);
      (next === 'list' ? tabListRef : tabGraphRef).current?.focus();
    },
    [view, setView],
  );
  useEntityDeepLink('techEntries', setEditingId);
  useNewParam(() => setCreating(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const isNarrow = useIsStackNarrow();

  if (loading) {
    return (
      <>
      <div className="data-list-header" aria-hidden="true">
        <Skeleton style={{ width: 90, height: 13 }} />
        <span className="data-list-actions" style={{ display: "flex", gap: 8 }}>
          <Skeleton style={{ width: 110, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 96, height: 28, borderRadius: 8 }} />
        </span>
      </div>
      <div className="stack-subtabs-row" aria-hidden="true">
        <span style={{ display: "flex", gap: 4 }}>
          <Skeleton style={{ width: 72, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 72, height: 28, borderRadius: 8 }} />
        </span>
      </div>
      {view === "graph" ? (
        <div className="stack-graph-wrap" role="status" aria-live="polite" aria-busy="true" aria-label="Loading stack graph">
          <span className="sr-only">Loading stack graph…</span>
          <div aria-hidden="true">
            <Skeleton style={{ width: "100%", height: 320, borderRadius: 12 }} />
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Skeleton style={{ width: 96, height: 12 }} />
                  <Skeleton style={{ width: 140, height: 11 }} />
                  <Skeleton style={{ width: 120, height: 11 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading stack">
        <span className="sr-only">Loading stack…</span>
        <div aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ minHeight: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: `${50 + i * 5}%`, height: 14 }} />
                  <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                </div>
                <Skeleton style={{ width: '60%', height: 11, opacity: 0.8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 44, height: 11 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                </div>
              </div>
              <div className="data-row-side">
                <Skeleton style={{ width: 64, height: 18, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
      </>
    );
  }

  if (error) {
    return <DataErrorState error={loadError ?? error} onRetry={retryLoad} />;
  }

  if (!state) return null;

  const entries = state.techEntries;
  const sortSpec = TECH_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const sorted = sortSpec
    ? applySort(entries, sortSpec, effectiveSort.dir)
    : [...entries].sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
          a.name.localeCompare(b.name),
      );

  return (
    <div className="stack-page">
<div className="data-list-header">
        {!isNarrow ? (
          <span className="data-list-count">
            {t('stack.count', { count: entries.length })}
          </span>
        ) : (
          <span className="sr-only" role="status">
            {t('stack.count', { count: entries.length })}
          </span>
        )}
        <span className="data-list-actions">
          {view === 'list' && (
            <SortControl
              options={TECH_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
              value={sortValue}
              onChange={setSort}
            />
          )}
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
              {isNarrow ? t('stack.newEntryShort', { defaultValue: 'Entry' }) : t('stack.newEntry')}
            </Button>
          )}
        </span>
      </div>
      <div className="stack-subtabs-row">
        <div className="sub-tabs stack-view-toggle" role="tablist" aria-label={t('stack.viewAria')}>
          <button
            ref={tabListRef}
            type="button"
            className={`sub-tab ${view === 'list' ? 'sub-tab-active' : ''}`}
            role="tab"
            id="tab-stack-list"
            aria-controls="stack-panel"
            aria-selected={view === 'list'}
            tabIndex={view === 'list' ? 0 : -1}
            aria-label={t('stack.listTab')}
            title={t('stack.listTab')}
            onClick={() => setView('list')}
            onKeyDown={handleViewKeyDown}
          >
            <ListBullets size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('stack.listTab')}</span>
          </button>
          <button
            ref={tabGraphRef}
            type="button"
            className={`sub-tab ${view === 'graph' ? 'sub-tab-active' : ''}`}
            role="tab"
            id="tab-stack-graph"
            aria-controls="stack-panel"
            aria-selected={view === 'graph'}
            tabIndex={view === 'graph' ? 0 : -1}
            aria-label={t('stack.graphTab')}
            title={t('stack.graphTab')}
            onClick={() => setView('graph')}
            onKeyDown={handleViewKeyDown}
          >
            <ShareNetwork size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('stack.graphTab')}</span>
          </button>
        </div>
        <div className="stack-subtabs-actions" />
      </div>

      <div id="stack-panel" role="tabpanel" aria-labelledby={view === 'list' ? 'tab-stack-list' : 'tab-stack-graph'} tabIndex={0}>
      {entries.length === 0 ? (
        <EmptyState
          icon={<Stack size={22} />}
          title={t('stack.emptyTitle')}
          description={t('stack.emptyDesc')}
          action={
            canEdit && (
              <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
                {isNarrow ? t('stack.newEntryShort', { defaultValue: 'Entry' }) : t('stack.newEntry')}
              </Button>
            )
          }
        />
      ) : view === 'graph' ? (
        <StackGraph entries={entries} onOpen={setEditingId} />
      ) : (
        <div className="data-list">
{sorted.map((entry) => (
            <div key={entry.id} className="data-row">
              <div className="data-row-top">
                <button
                  type="button"
                  className="data-row-title-btn"
                  onClick={() => setEditingId(entry.id)}
                  aria-label={entry.name}
                >
                  <span className="data-row-title">
                    <span className="row-title-text">{entry.name}</span>
                    <Badge tone={TECH_STATUS[entry.status].tone}>
                      {t(`stack.statusBadge.${entry.status}`)}
                    </Badge>
                  </span>
                </button>
                <span className="data-row-props">
                  <Badge tone={TECH_CATEGORY[entry.category].tone}>
                    {t(`stack.category.${entry.category}`)}
                  </Badge>
                </span>
              </div>
              <button
                type="button"
                className="data-row-body"
                onClick={() => setEditingId(entry.id)}
                aria-label={`${entry.name} — ${t('stack.openDetails', { defaultValue: 'Open tech entry details' })}`}
              >
                {entry.notes && <span className="data-row-sub">{entry.notes}</span>}
                <span className="data-row-meta">
                  <span>v{entry.version}</span>
                  <span>#{shortId(entry.id)}</span>
                  {unreadIds?.has(entry.id) && (
                    <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>
                    )}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
      </div>

      <NewTechModal open={creating} onClose={() => setCreating(false)} />
      <TechModal entryId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}
