import { useState } from 'react';
import { PencilSimple, Plus, Stack } from '@phosphor-icons/react';
import type { TechEntryCategory } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { TECH_CATEGORY, TECH_STATUS } from '../../lib/labels';
import { shortId } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { NewTechModal } from './NewTechModal';
import { TechModal } from './TechModal';
import { InlineError } from '../../components/InlineError';

const CATEGORY_ORDER: TechEntryCategory[] = ['frontend', 'backend', 'database', 'tooling'];

export function StackPage() {
  const { state, loading, error, canEdit } = useProject();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const entries = state.techEntries;
  const sorted = [...entries].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
        {canEdit && (
          <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
            New entry
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Stack size={22} />}
          title="No stack entries yet"
          description="Track what this project runs on — versions, categories and when an upgrade is due."
          action={
            canEdit && (
              <Button leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setCreating(true)}>
                Add a tech entry
              </Button>
            )
          }
        />
      ) : (
        <div className="data-list">
          {sorted.map((entry) => (
            <div
              key={entry.id}
              className="data-row"
              role="button"
              tabIndex={0}
              onClick={() => setEditingId(entry.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setEditingId(entry.id);
                }
              }}
            >
              <div className="data-row-main">
                <div className="data-row-title">
                  <span className="row-title-text">{entry.name}</span>
                  <Badge tone={TECH_STATUS[entry.status].tone}>{TECH_STATUS[entry.status].label}</Badge>
                </div>
                {entry.notes && <div className="data-row-sub">{entry.notes}</div>}
                <div className="data-row-meta">
                  <span>v{entry.version}</span>
                  <span>#{shortId(entry.id)}</span>
                </div>
              </div>
              <div className="data-row-side">
                <Badge tone={TECH_CATEGORY[entry.category].tone}>
                  {TECH_CATEGORY[entry.category].label}
                </Badge>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-icon"
                    aria-label="Edit entry"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(entry.id);
                    }}
                  >
                    <PencilSimple size={14} aria-hidden="true" />
                  </Button>
                )}
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
