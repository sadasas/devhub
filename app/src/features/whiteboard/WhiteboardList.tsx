import { useState } from 'react';
import { ChalkboardSimple, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { applySort, type SortSpec } from '../../lib/sort';
import type { Whiteboard } from '../../lib/types';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { WhiteboardCard } from './WhiteboardCard';
import { NewWhiteboardModal } from './NewWhiteboardModal';

const MAX_BOARDS = 50;

const BOARD_SORT_SPECS: SortSpec<Whiteboard>[] = [
  { key: 'updatedAt', label: 'whiteboard.list.sortUpdated', get: (b) => b.updatedAt },
  { key: 'name', label: 'whiteboard.list.sortName', get: (b) => b.name },
  { key: 'createdAt', label: 'whiteboard.list.sortCreated', get: (b) => b.createdAt },
];

interface WhiteboardListProps {
  onOpen?: (id: string) => void;
  loading?: boolean;
  unreadIds?: ReadonlySet<string>;
}

export function WhiteboardList({ onOpen, loading = false, unreadIds }: WhiteboardListProps) {
  const { t } = useTranslation('extras');
  const { state, error, canEdit, dispatch } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  useNewParam(() => setOpenNew(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };

  if (loading || !state) {
    return (
      <div className="project-grid" role="status" aria-live="polite" aria-busy="true" aria-label="Loading whiteboards">
        <span className="sr-only">Loading whiteboards…</span>
        <div aria-hidden="true" style={{ display: 'contents' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="project-card" style={{ padding: 14, gap: 8, display: 'flex', flexDirection: 'column' }}>
              <Skeleton style={{ width: '70%', height: 14 }} />
              <Skeleton style={{ width: '100%', height: 11, opacity: 0.85 }} />
              <Skeleton style={{ width: '65%', height: 11, opacity: 0.85 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <Skeleton style={{ width: 56, height: 16, borderRadius: 999 }} />
                <Skeleton style={{ width: 64, height: 11 }} />
                <Skeleton style={{ width: 44, height: 11 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <InlineError>{error}</InlineError>;
  }

  const boardSortSpec = BOARD_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const boards = applySort(
    state.whiteboards,
    boardSortSpec,
    effectiveSort.dir,
  );
  const atCap = boards.length >= MAX_BOARDS;
  const deleting = deleteId ? state.whiteboards.find((b) => b.id === deleteId) : undefined;

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {t('whiteboard.list.count', { count: boards.length })}
          {atCap && <span className="field-helper">{t('whiteboard.list.capHint', { max: MAX_BOARDS })}</span>}
        </span>
        <span className="data-list-actions">
          <SortControl
            options={BOARD_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && !atCap && (
            <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setOpenNew(true)}>
              {t('whiteboard.list.newBoard')}
            </Button>
          )}
        </span>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          icon={<ChalkboardSimple size={22} />}
          title={t('whiteboard.list.emptyTitle')}
          description={t('whiteboard.list.emptyDesc')}
          action={
            canEdit && (
              <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setOpenNew(true)}>
                {t('whiteboard.list.newBoard')}
              </Button>
            )
          }
        />
      ) : (
        <div className="project-grid">
          {boards.map((board) => (
            <WhiteboardCard
              key={board.id}
              board={board}
              canEdit={canEdit}
              unread={unreadIds?.has(board.id)}
              onOpen={onOpen ? () => onOpen(board.id) : undefined}
              onDelete={canEdit ? () => setDeleteId(board.id) : undefined}
            />
          ))}
        </div>
      )}

      {openNew && <NewWhiteboardModal onClose={() => setOpenNew(false)} />}

      {deleting && (
        <ConfirmDeleteDialog
          open
          title={t('whiteboard.list.deleteTitle')}
          description={t('whiteboard.list.deleteDesc', { name: deleting.name, elements: deleting.elements.length })}
          onConfirm={() => {
            dispatch({ type: 'whiteboard/remove', id: deleting.id });
            setDeleteId(null);
          }}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}