import { useEffect, useState } from 'react';
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
import { DataErrorState } from '../../components/DataErrorState';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { WhiteboardCard } from './WhiteboardCard';
import { EditWhiteboardModal } from './EditWhiteboardModal';
import { NewWhiteboardModal } from './NewWhiteboardModal';

const MAX_BOARDS = 50;

/** Header ringkas ≤640px (sort icon-only, + Board) — pola IssuesPage. */
function useIsWhiteboardNarrow(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (): void => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}

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
  const { state, error, loadError, canEdit, dispatch, retryLoad } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  useNewParam(() => setOpenNew(true), '1', canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const isNarrow = useIsWhiteboardNarrow();

  if (error) {
    return <DataErrorState error={loadError ?? error} onRetry={retryLoad} />;
  }

  if (loading || !state) {
    return (
      <>
      <div className="data-list-header" aria-hidden="true">
        <span className="data-list-actions" style={{ display: "flex", gap: 8 }}>
          <Skeleton style={{ width: 110, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 96, height: 28, borderRadius: 8 }} />
        </span>
      </div>
      <div className="project-grid" role="status" aria-live="polite" aria-busy="true" aria-label={t('common:loading.whiteboards')}>
        <span className="sr-only">{t('common:loading.whiteboards')}…</span>
        <div aria-hidden="true" style={{ display: 'contents' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="project-card wb-card">
              <div className="wb-card-main">
                <Skeleton style={{ width: '70%', height: 14 }} />
                <Skeleton style={{ width: '100%', height: 11, opacity: 0.85 }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <Skeleton style={{ width: 56, height: 16, borderRadius: 6 }} />
                  <Skeleton style={{ width: 64, height: 11 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                  <Skeleton style={{ width: 32, height: 16, borderRadius: 999 }} />
                </div>
              </div>
              <Skeleton style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
      </>
    );
  }

  const boardSortSpec = BOARD_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const boards = applySort(
    state.whiteboards,
    boardSortSpec,
    effectiveSort.dir,
  );
  const atCap = boards.length >= MAX_BOARDS;
  const deleting = deleteId ? state.whiteboards.find((b) => b.id === deleteId) : undefined;
  const editing = editId ? state.whiteboards.find((b) => b.id === editId) : undefined;

  return (
    <div className="whiteboard-page">
      <div className="data-list-header">
        {atCap && <span className="field-helper">{t('whiteboard.list.capHint', { max: MAX_BOARDS })}</span>}
        <span className="data-list-actions">
          <SortControl
            options={BOARD_SORT_SPECS.map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && !atCap && (
            <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setOpenNew(true)}>
              {isNarrow ? t('whiteboard.list.newBoardShort', { defaultValue: 'Board' }) : t('whiteboard.list.newBoard')}
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
              <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setOpenNew(true)}>
                {isNarrow ? t('whiteboard.list.newBoardShort', { defaultValue: 'Board' }) : t('whiteboard.list.newBoard')}
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
              narrow={isNarrow}
              unread={unreadIds?.has(board.id)}
              onOpen={onOpen ? () => onOpen(board.id) : undefined}
              onEdit={canEdit ? () => setEditId(board.id) : undefined}
              onDelete={canEdit ? () => setDeleteId(board.id) : undefined}
            />
          ))}
        </div>
      )}

      {openNew && <NewWhiteboardModal onClose={() => setOpenNew(false)} onCreated={onOpen} />}

      {editing && <EditWhiteboardModal board={editing} onClose={() => setEditId(null)} />}

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