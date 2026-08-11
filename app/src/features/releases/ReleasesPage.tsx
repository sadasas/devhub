import { useState } from 'react';
import { MILESTONE_STATUS } from '../../lib/labels';
import { formatDate, shortId } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { CalendarBlank, PencilSimple, Plus, Rocket } from '@phosphor-icons/react';
import { Skeleton } from '../../components/Skeleton';
import { MilestoneModal } from './MilestoneModal';
import { NewMilestoneModal } from './NewMilestoneModal';
import { InlineError } from '../../components/InlineError';

export function ReleasesPage() {
  const { state, loading, error, canEdit } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

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

  const milestones = [...state.milestones].sort((a, b) => {
    if (a.status === 'released' && b.status !== 'released') return 1;
    if (b.status === 'released' && a.status !== 'released') return -1;
    return (a.targetDate ?? '9999-99-99').localeCompare(b.targetDate ?? '9999-99-99');
  });

  const milestoneTasks = (id: string) => state.tasks.filter((t) => t.milestoneId === id);

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {milestones.length} milestone{milestones.length === 1 ? '' : 's'}
        </span>
        {canEdit && (
          <Button size="sm" onClick={() => setOpenNew(true)}>
            <Plus size={14} /> New milestone
          </Button>
        )}
      </div>

      {milestones.length === 0 ? (
        <EmptyState
          icon={<Rocket size={22} />}
          title="No milestones yet"
          description="Group work into releases and keep a changelog of what shipped with each."
          action={
            canEdit && (
              <Button size="sm" onClick={() => setOpenNew(true)}>
                <Plus size={14} /> New milestone
              </Button>
            )
          }
        />
      ) : (
        <div className="data-list">
          {milestones.map((m) => (
            <div
              key={m.id}
              className="data-row"
              role="button"
              tabIndex={0}
              onClick={() => setEditId(m.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setEditId(m.id);
                }
              }}
            >
              <div className="data-row-main">
                <div className="data-row-title">
                  <Badge tone={MILESTONE_STATUS[m.status].tone}>
                    {MILESTONE_STATUS[m.status].label}
                  </Badge>
                  <span className="row-title-text">{m.name}</span>
                  {m.version && <span className="data-row-meta">v{m.version}</span>}
                </div>
                {m.changelog && <div className="data-row-sub">{m.changelog}</div>}
                <div className="data-row-meta">
                  <span>
                    <CalendarBlank size={12} /> {m.targetDate ? formatDate(m.targetDate) : 'No target date'}
                  </span>
                  <span>#{shortId(m.id)}</span>
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
                      {milestoneTasks(m.id).filter((t) => t.status === 'done').length}/
                      {milestoneTasks(m.id).length} done
                    </span>
                  </div>
                )}
              </div>
              <div className="data-row-side">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="btn-icon"
                    aria-label="Edit milestone"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditId(m.id);
                    }}
                  >
                    <PencilSimple size={14} />
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
