import { Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatRelative, shortId } from '../../lib/utils';
import type { Whiteboard } from '../../lib/types';

interface WhiteboardCardProps {
  board: Whiteboard;
  canEdit: boolean;
  unread?: boolean;
  onOpen?: () => void;
  onDelete?: () => void;
}

export function WhiteboardCard({ board, canEdit, unread = false, onOpen, onDelete }: WhiteboardCardProps) {
  const { t } = useTranslation('extras');
  return (
    <div className="project-card wb-card">
      <button type="button" className="wb-card-main" onClick={onOpen}>
        <span className="project-card-title">{board.name}</span>
        <span className="project-card-desc">{board.description || t('whiteboard.card.noDescription')}</span>
        <span className="project-card-meta">
          <Badge tone="neutral">
            {t('whiteboard.card.elements', { count: board.elements.length })}
          </Badge>
          <span className="project-card-updated">{formatRelative(board.updatedAt)}</span>
          <span className="project-card-updated">#{shortId(board.id)}</span>
          {unread && (
            <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">
              New
            </span>
          )}
        </span>
      </button>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="btn-icon"
          aria-label={t('whiteboard.card.deleteBoard')}
          onClick={onDelete}
        >
          <Trash size={14} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}