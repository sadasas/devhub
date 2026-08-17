import type { ActivityEntry } from '../../lib/api';
import { formatRelative } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';

const ENTITY_LABELS: Record<string, string> = {
  tasks: 'Task',
  issues: 'Issue',
  testCases: 'Test',
  techEntries: 'Tech',
  tables: 'Table',
  relations: 'Relation',
  schemaVersions: 'Schema',
  decisions: 'Decision',
  milestones: 'Milestone',
  apiCollections: 'Collection',
  apiEndpoints: 'Endpoint',
  whiteboards: 'Board',
};

const MAX_ROWS = 5;

export interface DeletedItemsBannerProps {
  items: ActivityEntry[];
  dismissedUntil: string | null;
  onDismiss: () => void;
}

export function DeletedItemsBanner({ items, dismissedUntil, onDismiss }: DeletedItemsBannerProps) {
  const visible = items
    .filter((entry) => entry.action === 'deleted')
    .filter(
      (entry) =>
        !dismissedUntil ||
        new Date(entry.createdAt).getTime() > new Date(dismissedUntil).getTime(),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (visible.length === 0) return null;

  return (
    <div className="deleted-banner" role="region" aria-label="Deleted items">
      <div className="deleted-banner-head">
        <Badge tone="danger">
          {visible.length} deleted
        </Badge>
        <span className="deleted-banner-copy">
          These items were deleted. Deletion records are kept briefly and cannot be restored.
        </span>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <div className="deleted-banner-list">
        {visible.slice(0, MAX_ROWS).map((entry) => (
          <div key={entry.id} className="deleted-banner-item">
            <span className="deleted-banner-item-entity">
              {ENTITY_LABELS[entry.entity] ?? entry.entity}
            </span>
            <span className="deleted-banner-item-summary" title={entry.summary}>
              {entry.summary}
            </span>
            <span className="deleted-banner-item-meta">
              {entry.authorName} · {formatRelative(entry.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
