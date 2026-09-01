import { useState } from 'react';
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
import { InlineError } from '../../components/InlineError';

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

const VIEW_KEY = 'devhub.stackView';

function loadView(): StackView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'graph' ? 'graph' : 'list';
  } catch {
    return 'list';
  }
}

export function StackPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { t } = useTranslation('project');
  const { state, loading, error, canEdit } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<StackView>(loadView);
  useEntityDeepLink('techEntries', setEditingId);
  useNewParam(() => setCreating(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };

  const switchView = (next: StackView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // storage unavailable — view stays for this session
    }
  };

  if (loading) {
    return (
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading stack">
        <span className="sr-only">Loading stack…</span>
        <div aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ height: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: `${50 + i * 5}%`, height: 14 }} />
                  <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                </div>
                <Skeleton style={{ width: '60%', height: 11, opacity: 0.8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 44, height: 11, borderRadius: 999 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                </div>
              </div>
              <div className="data-row-side">
                <Skeleton style={{ width: 64, height: 18, borderRadius: 999 }} />
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
    <div>
<div className="data-list-header">
        <div className="stack-header-left">
          <span className="data-list-count">
            {t('stack.count', { count: entries.length })}
          </span>
          <div className="sub-tabs stack-view-toggle" role="tablist" aria-label={t('stack.viewAria')}>
            <button
              type="button"
              className={`sub-tab ${view === 'list' ? 'sub-tab-active' : ''}`}
              role="tab"
              aria-selected={view === 'list'}
              onClick={() => switchView('list')}
            >
              <ListBullets size={13} aria-hidden="true" />
              {t('stack.listTab')}
            </button>
            <button
              type="button"
              className={`sub-tab ${view === 'graph' ? 'sub-tab-active' : ''}`}
              role="tab"
              aria-selected={view === 'graph'}
              onClick={() => switchView('graph')}
            >
              <ShareNetwork size={13} aria-hidden="true" />
              {t('stack.graphTab')}
            </button>
          </div>
        </div>
        <span className="data-list-actions">
          {view === 'list' && (
            <SortControl
              options={TECH_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
              value={sortValue}
              onChange={setSort}
            />
          )}
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
              {t('stack.newEntry')}
            </Button>
          )}
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Stack size={22} />}
          title={t('stack.emptyTitle')}
          description={t('stack.emptyDesc')}
          action={
            canEdit && (
              <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setCreating(true)}>
                {t('stack.addEntry')}
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
              <button
                type="button"
                className="data-row-main"
                onClick={() => setEditingId(entry.id)}
              >
                <div className="data-row-title">
                  <span className="row-title-text">{entry.name}</span>
                  <Badge tone={TECH_STATUS[entry.status].tone}>
                    {t(`stack.statusBadge.${entry.status}`)}
                  </Badge>
                </div>
                {entry.notes && <div className="data-row-sub">{entry.notes}</div>}
                <div className="data-row-meta">
                  <span>v{entry.version}</span>
                  <span>#{shortId(entry.id)}</span>
                  {unreadIds?.has(entry.id) && (
                    <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>
                    )}
                </div>
              </button>
              <div className="data-row-side">
                <Badge tone={TECH_CATEGORY[entry.category].tone}>
                  {t(`stack.category.${entry.category}`)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewTechModal open={creating} onClose={() => setCreating(false)} />
      <TechModal entryId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}
