import { PencilSimple, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { RowMenu } from '../../components/RowMenu';
import { formatRelative, shortId } from '../../lib/utils';
import type { Whiteboard } from '../../lib/types';

interface WhiteboardCardProps {
  board: Whiteboard;
  canEdit: boolean;
  unread?: boolean;
  /** Mode narrow (≤640px): Trash diganti kebab ⋮ + popup panel. */
  narrow?: boolean;
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function WhiteboardCard({ board, canEdit, unread = false, narrow = false, onOpen, onEdit, onDelete }: WhiteboardCardProps) {
  const { t } = useTranslation('extras');
  return (
    <div className="project-card wb-card">
      <div className="data-row-top">
        <button type="button" className="data-row-title-btn" onClick={onOpen} aria-disabled={!onOpen} aria-label={board.name}>
          <span className="project-card-title">{board.name}</span>
        </button>
        {(canEdit && !narrow && (onEdit || onDelete) || (canEdit && narrow && (onEdit || onDelete))) && (
          <span className="data-row-props">
            {canEdit && !narrow && (onEdit || onDelete) && (
              <span className="wb-card-actions">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-icon wb-edit"
                    aria-label={t('whiteboard.card.editBoard')}
                    title={t('whiteboard.card.editBoard')}
                    onClick={onEdit}
                  >
                    <PencilSimple size={14} aria-hidden="true" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="btn-icon wb-trash"
                    aria-label={t('whiteboard.card.deleteBoard')}
                    onClick={onDelete}
                  >
                    <Trash size={14} aria-hidden="true" />
                  </Button>
                )}
              </span>
            )}
            {canEdit && narrow && (onEdit || onDelete) && (
              <RowMenu
                triggerLabel={`More actions for ${board.name}`}
                menuLabel={`More actions for ${board.name}`}
                menuId={`wb-rowmenu-${board.id}`}
                actions={[
                  ...(onEdit
                    ? [
                        {
                          key: 'edit',
                          label: t('whiteboard.card.editBoard'),
                          icon: <PencilSimple size={14} aria-hidden="true" />,
                          onSelect: () => onEdit(),
                        },
                      ]
                    : []),
                  ...(onDelete
                    ? [
                        {
                          key: 'delete',
                          label: t('whiteboard.card.deleteBoard'),
                          icon: <Trash size={14} aria-hidden="true" />,
                          danger: true,
                          onSelect: () => onDelete(),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </span>
        )}
      </div>
      <button type="button" className="data-row-body wb-card-desc-btn" onClick={onOpen} aria-disabled={!onOpen} aria-label={`${board.name} — ${t('whiteboard.card.openBoard', { defaultValue: 'Open board' })}`}>
        <span className="project-card-desc">{board.description || t('whiteboard.card.noDescription')}</span>
      </button>
      {/* Meta baris sendiri full-width (di luar tombol + kolom aksi) agar
          tidak ikut menyusut saat hover — hanya judul + deskripsi yang
          menyerap selisih lebar (pola Gmail). */}
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
    </div>
  );
}