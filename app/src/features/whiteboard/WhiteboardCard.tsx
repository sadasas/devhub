import { Trash } from '@phosphor-icons/react';
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
  return (
    <div className="project-card wb-card">
      <button type="button" className="wb-card-main" onClick={onOpen}>
        <span className="project-card-title">{board.name}</span>
        <span className="project-card-desc">{board.description || 'No description.'}</span>
        <span className="project-card-meta">
          <Badge tone="neutral">
            {board.elements.length} element{board.elements.length === 1 ? '' : 's'}
          </Badge>
          <span className="project-card-updated">{formatRelative(board.updatedAt)}</span>
          <span className="project-card-updated">#{shortId(board.id)}</span>
          {unread && (
            <>
              <span className="unread-dot" aria-hidden="true" />
              <span className="sr-only">Unread</span>
            </>
          )}
        </span>
      </button>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="btn-icon"
          aria-label="Delete board"
          onClick={onDelete}
        >
          <Trash size={14} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}