import type { ActivityEntry } from '../../lib/api';
import { formatRelative } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { tabOfEntity } from '../../lib/tab-unread';

const ENTITY_KEYS = [
  'tasks',
  'issues',
  'testCases',
  'techEntries',
  'tables',
  'relations',
  'schemaVersions',
  'decisions',
  'milestones',
  'apiCollections',
  'apiEndpoints',
  'whiteboards',
] as const;

type EntityKey = (typeof ENTITY_KEYS)[number];

const MAX_ROWS = 5;

export interface DeletedItemsBannerProps {
  items: ActivityEntry[];
  activeTab?: string;
  dismissedUntil: Record<string, string | null> | string | null;
  onDismiss: (tab: string) => void;
}

export function DeletedItemsBanner({ items, activeTab = 'board', dismissedUntil, onDismiss }: DeletedItemsBannerProps) {
  const { t } = useTranslation('project');
  const until =
    dismissedUntil && typeof dismissedUntil === 'object' && !Array.isArray(dismissedUntil)
      ? (dismissedUntil as Record<string, string | null>)[activeTab] ?? null
      : (dismissedUntil as string | null);
  const visible = items
    .filter((entry) => entry.action === 'deleted')
    .filter((entry) => {
      const entryTab =
        (entry as unknown as { tab?: string }).tab ?? tabOfEntity(entry.entity as never);
      if (entryTab !== activeTab) return false;
      return !until || new Date(entry.createdAt).getTime() > new Date(until).getTime();
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (visible.length === 0) return null;

  const entityLabel = (entity: string): string =>
    (ENTITY_KEYS as readonly string[]).includes(entity)
      ? t(`banner.entity.${entity as EntityKey}`)
      : entity;

  return (
    <div className="deleted-banner" role="region" aria-label={t('banner.regionAria')}>
      <div className="deleted-banner-head">
        <Badge tone="danger">
          {t('banner.count', { count: visible.length })}
        </Badge>
        <span className="deleted-banner-copy">
          {t('banner.copy')}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onDismiss(activeTab)}>
          {t('banner.dismiss')}
        </Button>
      </div>
      <div className="deleted-banner-list">
        {visible.slice(0, MAX_ROWS).map((entry) => (
          <div key={entry.id} className="deleted-banner-item">
            <span className="deleted-banner-item-entity">
              {entityLabel(entry.entity)}
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
