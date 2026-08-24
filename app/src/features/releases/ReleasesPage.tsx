import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, shortId } from '../../lib/utils';
import { MILESTONE_STATUS } from '../../lib/labels';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { applySort, type SortSpec } from '../../lib/sort';
import { compareVersions } from '../../lib/compare-version';
import type { Milestone } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { CalendarBlank, PencilSimple, Plus, Rocket } from '@phosphor-icons/react';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { MilestoneModal } from './MilestoneModal';
import { NewMilestoneModal } from './NewMilestoneModal';
import { InlineError } from '../../components/InlineError';

const MILESTONE_SORT_SPECS: SortSpec<Milestone>[] = [
  { key: 'targetDate', label: 'releases.sort.targetDate', get: (m) => m.targetDate ?? null },
  { key: 'name', label: 'releases.sort.name', get: (m) => m.name },
  { key: 'createdAt', label: 'releases.sort.createdAt', get: (m) => m.createdAt },
  { key: 'version', label: 'releases.sort.version', get: (m) => m.version ?? null, compare: compareVersions },
];

export function ReleasesPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { t } = useTranslation('project');
  const { state, loading, error, canEdit } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  useEntityDeepLink('milestones', setEditId);
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

  const sortSpec = MILESTONE_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const milestones = applySort(state.milestones, sortSpec, effectiveSort.dir);

  const milestoneTasks = (id: string) => state.tasks.filter((t) => t.milestoneId === id);

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {t('releases.count', { count: milestones.length })}
        </span>
        <span className="data-list-actions">
          <SortControl
            options={MILESTONE_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && (
            <Button size="sm" onClick={() => setOpenNew(true)}>
              <Plus size={14} aria-hidden="true" /> {t('releases.newMilestone')}
            </Button>
          )}
        </span>
      </div>

      {milestones.length === 0 ? (
        <EmptyState
            icon={<Rocket size={22} />}
            title={t('releases.emptyTitle')}
            description={t('releases.emptyDesc')}
            action={
              canEdit && (
                <Button size="sm" onClick={() => setOpenNew(true)}>
                  <Plus size={14} /> {t('releases.newMilestone')}
                </Button>
              )
            }
          />
        )
      : (
        <div className="data-list">
          {milestones.map((m) => (
            <div key={m.id} className="data-row">
              <button
                type="button"
                className="data-row-main"
                onClick={() => setEditId(m.id)}
              >
                <div className="data-row-title">
                  <Badge tone={MILESTONE_STATUS[m.status].tone}>
                    {t(`releases.statusBadge.${m.status}`)}
                  </Badge>
                  <span className="row-title-text">{m.name}</span>
                  {m.version && <span className="data-row-meta">v{m.version.replace(/^v/i, '')}</span>}
                </div>
                {m.changelog && <div className="data-row-sub">{m.changelog}</div>}
                <div className="data-row-meta">
                  <span>
                    <CalendarBlank size={12} aria-hidden="true" />{' '}
                    {m.targetDate ? formatDate(m.targetDate) : t('releases.noTargetDate')}
                  </span>
                  <span>#{shortId(m.id)}</span>
                  {unreadIds?.has(m.id) && (
                    <>
                      <span className="unread-dot" aria-hidden="true" />
                      <span className="sr-only">{t('releases.unread')}</span>
                    </>
                  )}
                </div>
                {milestoneTasks(m.id).length > 0 && (
                  <div className="milestone-progress">
                    <div className="milestone-progress-track">
                      <div
                        className="milestone-progress-fill"
                        style={{
                          width: `${Math.round(
                            (milestoneTasks(m.id).filter((t) => t.status === 'done').length /
                              milestoneTasks(m.id).length) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="tabular">
                      {t('releases.progressDone', {
                        done: milestoneTasks(m.id).filter((task) => task.status === 'done').length,
                        total: milestoneTasks(m.id).length,
                      })}
                    </span>
                  </div>
                )}
              </button>
              <div className="data-row-side">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="btn-icon"
                    aria-label={t('releases.editAria')}
                    onClick={() => setEditId(m.id)}
                  >
                    <PencilSimple size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {openNew && <NewMilestoneModal onClose={() => setOpenNew(false)} />}
      <MilestoneModal milestoneId={editId} onClose={() => setEditId(null)} />
    </div>
  );
}
