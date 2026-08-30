import { useEffect, useState } from 'react';
import { api, type ActivityEntry, type GranularEntity } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelative } from '../lib/utils';
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

const LONG_FIELDS = new Set(['description', 'reproduction', 'notes', 'steps', 'expected']);

function isLongValue(field: string, value: string): boolean {
  if (value === '—') return false;
  return value.length > 80 || value.includes('\n') || LONG_FIELDS.has(field);
}

function smartPreview(value: string, other: string, expanded: boolean): string {
  if (expanded || value.length <= 80) return value;
  // find first diff index against other
  const minLen = Math.min(value.length, other.length);
  let diff = minLen;
  for (let i = 0; i < minLen; i++) {
    if (value[i] !== other[i]) {
      diff = i;
      break;
    }
  }
  // if other is prefix and diff at end, center at end
  const windowSize = 80;
  let start = Math.max(0, diff - 30);
  let end = start + windowSize;
  if (end > value.length) {
    end = value.length;
    start = Math.max(0, end - windowSize);
  }
  let snippet = value.slice(start, end);
  // try to avoid cutting mid-word at edges when we have ellipsis
  if (start > 0) {
    const firstSpace = snippet.indexOf(' ');
    // if snippet starts mid-word, trim to next space
    if (firstSpace > 0 && firstSpace < 15) snippet = snippet.slice(firstSpace + 1);
    snippet = '…' + snippet;
  }
  if (end < value.length) {
    const lastSpace = snippet.lastIndexOf(' ');
    if (snippet.length > 70 && lastSpace > 50) snippet = snippet.slice(0, lastSpace);
    snippet = snippet.trimEnd() + '…';
  }
  return snippet;
}

function ActivityChangeRow({
  field,
  change,
  fieldLabel,
  displayValue,
}: {
  field: string;
  change: { from: unknown; to: unknown };
  fieldLabel: (f: string) => string;
  displayValue: (f: string, v:unknown) => string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const fromRaw = displayValue(field, change.from);
  const toRaw = displayValue(field, change.to);
  const long = isLongValue(field, fromRaw) || isLongValue(field, toRaw);
  if (!long) {
    return (
      <li className="activity-change">
        <span className="activity-field">{fieldLabel(field)}</span>
        <span className="activity-sep"> </span>
        <span className="activity-arrow">
          {fromRaw} {'→'} {toRaw}
        </span>
      </li>
    );
  }
  const fromPreview = smartPreview(fromRaw, toRaw, expanded);
  const toPreview = smartPreview(toRaw, fromRaw, expanded);
  const needsExpand = fromRaw.length > 80 || toRaw.length > 80 || fromRaw.includes('\n') || toRaw.includes('\n');
  const longest = Math.max(fromRaw.length, toRaw.length);
  const identicalPreview = !expanded && fromPreview === toPreview && fromRaw !== toRaw;
  return (
    <li className="activity-change activity-change-long">
      <span className="activity-field">{fieldLabel(field)}</span>
      <div className="activity-diff">
        <div className="activity-diff-from" title={fromRaw}>
          <span className="activity-diff-mark" aria-hidden="true">-</span>
          <span className="activity-diff-text">{fromPreview}</span>
        </div>
        <div className="activity-diff-to" title={toRaw}>
          <span className="activity-diff-mark" aria-hidden="true">+</span>
          <span className="activity-diff-text">{toPreview}</span>
        </div>
        {identicalPreview && !expanded && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('activity.identicalPreview')}</span>
        )}
        {needsExpand && (
          <button type="button" className="activity-expand" onClick={() => setExpanded((v) => !v)}>
            {expanded ? t('activity.collapse') : t('activity.expandWithCount', { count: longest })}
          </button>
        )}
      </div>
    </li>
  );
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

  const displayValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? t('activity.yes') : t('activity.no');
    if (['dueDate', 'startDate', 'targetDate', 'completedAt', 'createdAt', 'updatedAt'].includes(field) && typeof value === 'string') {
      const d = String(value).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
        try {
          return formatDate(String(value));
        } catch {
          return String(value);
        }
      }
    }
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
                  <ActivityChangeRow
                    key={field}
                    field={field}
                    change={change as { from: unknown; to: unknown }}
                    fieldLabel={fieldLabel}
                    displayValue={displayValue}
                  />
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
