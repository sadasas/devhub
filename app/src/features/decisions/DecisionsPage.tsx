import { useState } from 'react';
import { DECISION_STATUS } from '../../lib/labels';
import { shortId } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PencilSimple, Plus, Scales } from '@phosphor-icons/react';
import { Skeleton } from '../../components/Skeleton';
import { DecisionModal } from './DecisionModal';
import { NewDecisionModal } from './NewDecisionModal';
import { InlineError } from '../../components/InlineError';

export function DecisionsPage() {
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

  const decisions = [...state.decisions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {decisions.length} decision{decisions.length === 1 ? '' : 's'}
        </span>
        {canEdit && (
          <Button size="sm" onClick={() => setOpenNew(true)}>
            <Plus size={14} aria-hidden="true" /> New decision
          </Button>
        )}
      </div>

      {decisions.length === 0 ? (
        <EmptyState
          icon={<Scales size={22} />}
          title="No decisions yet"
          description="Record architecture choices and trade-offs as ADRs so future you remembers why."
          action={
            canEdit && (
              <Button size="sm" onClick={() => setOpenNew(true)}>
                <Plus size={14} /> New decision
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
                    {DECISION_STATUS[d.status].label}
                  </Badge>
                  <span className="row-title-text">{d.title}</span>
                </div>
                {d.context && <div className="data-row-sub">{d.context}</div>}
                <div className="data-row-meta">
                  <span>{d.options.length} option(s)</span>
                  <span># {d.date}</span>
                  <span>#{shortId(d.id)}</span>
                </div>
              </button>
              <div className="data-row-side">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="btn-icon"
                    aria-label="Edit decision"
                    onClick={() => setEditId(d.id)}
                  >
                    <PencilSimple size={14} aria-hidden="true" />
                  </Button>
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
