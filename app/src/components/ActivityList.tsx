import { useEffect, useState } from 'react';
import { api, type ActivityEntry, type GranularEntity } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { useOptionalAuth } from '../state/auth-context';
import { DetailEmpty } from './DetailList';
import { InlineError } from './InlineError';
import { Skeleton } from './Skeleton';

interface ActivityListProps {
  projectId: string;
  entity: GranularEntity;
  entityId: string;
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  title: 'Title',
  description: 'Description',
  labels: 'Labels',
  severity: 'Severity',
  reproduction: 'Reproduction',
  linkedTaskId: 'Linked task',
  name: 'Name',
  notes: 'Notes',
  estimate: 'Estimate',
  actualHours: 'Actual hours',
  milestoneId: 'Milestone',
  blockedBy: 'Blocked by',
  steps: 'Steps',
  expected: 'Expected result',
  taskId: 'Linked task',
  issueId: 'Linked issue',
  version: 'Version',
  targetDate: 'Target date',
  status2: 'Status',
};

function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function ActionVerb({ action }: { action: ActivityEntry['action'] }) {
  if (action === 'created') return <span className="activity-verb activity-created">created</span>;
  if (action === 'deleted') return <span className="activity-verb activity-deleted">deleted</span>;
  return <span className="activity-verb activity-updated">updated</span>;
}

export function ActivityList({ projectId, entity, entityId }: ActivityListProps) {
  const { user } = useOptionalAuth();
  const [items, setItems] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    api
      .fetchActivity(projectId, { entity, entityId, limit: 50 })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load activity');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, entity, entityId]);

  if (error) return <InlineError>{error}</InlineError>;
  if (items === null) {
    return (
      <div className="activity-list" aria-busy="true">
        <Skeleton style={{ width: '100%', height: '14px' }} />
        <Skeleton style={{ width: '80%', height: '14px' }} />
        <Skeleton style={{ width: '60%', height: '14px' }} />
      </div>
    );
  }
  if (items.length === 0) {
    return <DetailEmpty>No activity recorded yet.</DetailEmpty>;
  }

  return (
    <ul className="activity-list">
      {items.map((entry) => {
        const author =
          entry.authorId !== null && entry.authorId === user?.id ? 'You' : entry.authorName || 'Someone';
        const changes = Object.entries(entry.changes);
        return (
          <li key={entry.id} className="activity-item">
            <p className="activity-line">
              <span className="activity-author">{author}</span> <ActionVerb action={entry.action} />{' '}
              <span className="activity-summary">{entry.summary || '(untitled)'}</span>
              <span className="activity-time">{formatRelative(entry.createdAt)}</span>
            </p>
            {changes.length > 0 && (
              <ul className="activity-changes">
                {changes.map(([field, change]) => (
                  <li key={field} className="activity-change">
                    <span className="activity-field">{fieldLabel(field)}</span>
                    <span className="activity-arrow">{displayValue(change.from)} → {displayValue(change.to)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
