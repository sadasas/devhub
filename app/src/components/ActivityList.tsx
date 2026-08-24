import { useEffect, useState } from 'react';
import { api, type ActivityEntry, type GranularEntity } from '../lib/api';
import { useTranslation } from 'react-i18next';
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

const FIELD_KEYS = new Set([
  'status',
  'priority',
  'title',
  'description',
  'labels',
  'severity',
  'reproduction',
  'linkedTaskId',
  'name',
  'notes',
  'estimate',
  'actualHours',
  'milestoneId',
  'blockedBy',
  'steps',
  'expected',
  'taskId',
  'issueId',
  'version',
  'targetDate',
  'dueDate',
  'startDate',
]);

function humanizeField(field: string): string {
  return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

export function ActivityList({ projectId, entity, entityId }: ActivityListProps) {
  const { user } = useOptionalAuth();
  const [items, setItems] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

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
          setError(err instanceof Error ? err.message : t('activity.loadFailed'));
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
    return <DetailEmpty>{t('activity.empty')}</DetailEmpty>;
  }

  const fieldLabel = (field: string): string =>
    FIELD_KEYS.has(field)
      ? t(`activity.fields.${field}`, { defaultValue: humanizeField(field) })
      : humanizeField(field);

  const displayValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? t('activity.yes') : t('activity.no');
    return String(value);
  };

  return (
    <ul className="activity-list">
      {items.map((entry) => {
        const author =
          entry.authorId !== null && entry.authorId === user?.id
            ? t('activity.authorYou')
            : entry.authorName || t('activity.authorUnknown');
        const changes = Object.entries(entry.changes);
        return (
          <li key={entry.id} className="activity-item">
            <p className="activity-line">
              <span className="activity-author">{author}</span> <ActionVerb action={entry.action} />{' '}
              <span className="activity-summary">{entry.summary || t('activity.untitled')}</span>
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

function ActionVerb({ action }: { action: ActivityEntry['action'] }) {
  const { t } = useTranslation();
  if (action === 'created') return <span className="activity-verb activity-created">{t('activity.verbCreated')}</span>;
  if (action === 'deleted') return <span className="activity-verb activity-deleted">{t('activity.verbDeleted')}</span>;
  return <span className="activity-verb activity-updated">{t('activity.verbUpdated')}</span>;
}
