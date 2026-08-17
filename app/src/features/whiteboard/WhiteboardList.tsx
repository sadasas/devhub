import { useState } from 'react';
import { ChalkboardSimple, Plus } from '@phosphor-icons/react';
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

const MAX_BOARDS = 5;

const BOARD_SORT_SPECS: SortSpec<Whiteboard>[] = [
  { key: 'updatedAt', label: 'Updated', get: (b) => b.updatedAt },
  { key: 'name', label: 'Name', get: (b) => b.name },
  { key: 'createdAt', label: 'Created', get: (b) => b.createdAt },
];

interface WhiteboardListProps {
  onOpen?: (id: string) => void;
  loading?: boolean;
  unreadIds?: ReadonlySet<string>;
}

export function WhiteboardList({ onOpen, loading = false, unreadIds }: WhiteboardListProps) {
  const { state, error, canEdit, dispatch } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  useNewParam(() => setOpenNew(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();

  if (loading || !state) {
    return (
      <div className="project-grid" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="project-card">
            <Skeleton className="skeleton-row" />
            <Skeleton className="skeleton-row skeleton-row-sm" />
            <Skeleton className="skeleton-row skeleton-row-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <InlineError>{error}</InlineError>;
  }

  const boardSortSpec = BOARD_SORT_SPECS.find((s) => s.key === sortValue?.key) ?? null;
  const boards = applySort(
    state.whiteboards,
    boardSortSpec,
    sortValue ? sortValue.dir : 'desc',
  );
  const atCap = boards.length >= MAX_BOARDS;
  const deleting = deleteId ? state.whiteboards.find((b) => b.id === deleteId) : undefined;

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {boards.length} whiteboard{boards.length === 1 ? '' : 's'}
          {atCap && <span className="field-helper"> — {MAX_BOARDS} boards per project, delete one to add another</span>}
        </span>
        <span className="data-list-actions">
          <SortControl
            options={BOARD_SORT_SPECS.map((s) => ({ value: s.key, label: s.label }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && !atCap && (
            <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setOpenNew(true)}>
              New board
            </Button>
          )}
        </span>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          icon={<ChalkboardSimple size={22} />}
          title="No whiteboards yet"
          description="Sketch ideas and flowcharts on a shared canvas."
          action={
            canEdit && (
              <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setOpenNew(true)}>
                New board
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
          title="Delete board"
          description={`This permanently deletes “${deleting.name}” and its ${deleting.elements.length} elements. This cannot be undone.`}
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