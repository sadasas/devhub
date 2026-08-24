import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FloppyDisk, GitDiff, Graph, LinkSimple, List, Plus, Trash } from '@phosphor-icons/react';
import { formatDate, relationLabel as formatRelation, shortId } from '../../lib/utils';
import type { Relation, SchemaVersion, Table } from '../../lib/types';
import { applySort, type SortSpec } from '../../lib/sort';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useSortParam } from '../../hooks/useSortParam';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { ERD } from './ERD';
import { NewRelationModal } from './NewRelationModal';
import { NewTableModal } from './NewTableModal';
import { SaveVersionModal } from './SaveVersionModal';
import { DiffVersionModal } from './DiffVersionModal';
import { TableModal } from './TableModal';
import { InlineError } from '../../components/InlineError';

type SchemaView = 'tables' | 'erd';

const TABLE_SORT_SPECS: SortSpec<Table>[] = [
  { key: 'name', label: 'Name', get: (t) => t.name },
  { key: 'createdAt', label: 'Created', get: (t) => t.createdAt },
];

const VERSION_SORT_SPECS: SortSpec<SchemaVersion>[] = [
  { key: 'appliedAt', label: 'Applied', get: (v) => v.appliedAt },
];

export function SchemaPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { state, loading, error, dispatch, canEdit } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('schemaView');
  const view: SchemaView = viewParam === 'erd' ? 'erd' : 'tables';
  const setView = useCallback(
    (next: SchemaView) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('schemaView', next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const { value: versionSortValue, setSort: setVersionSort } = useSortParam('sortv');
  const tableSortSpec = TABLE_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const versionSortSpec = VERSION_SORT_SPECS.find((s) => s.key === versionSortValue?.key) ?? null;
  const [newTableOpen, setNewTableOpen] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);
  useEntityDeepLink('tables', setTableId);
  const [newRelationOpen, setNewRelationOpen] = useState(false);
  const [confirmRel, setConfirmRel] = useState<Relation | null>(null);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);

  const tabTablesRef = useRef<HTMLButtonElement>(null);
  const tabErdRef = useRef<HTMLButtonElement>(null);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = view === 'tables' ? 'erd' : 'tables';
        setView(next);
        (next === 'tables' ? tabTablesRef : tabErdRef).current?.focus();
      }
    },
    [view, setView],
  );

  if (loading) {
    return (
      <div className="data-list">
        <Skeleton className="data-row" style={{ height: 44 }} />
        <Skeleton className="data-row" style={{ height: 44 }} />
        <Skeleton className="data-row" style={{ height: 44 }} />
      </div>
    );
  }

  if (error) {
    return (
      <InlineError>
        {error}
      </InlineError>
    );
  }

  if (!state) return null;

  const relationLabel = (rel: Relation) => {
    const ft = state.tables.find((t) => t.id === rel.fromTableId);
    const tt = state.tables.find((t) => t.id === rel.toTableId);
    return formatRelation(
      ft?.name,
      ft?.columns.find((c) => c.id === rel.fromColumnId)?.name,
      tt?.name,
      tt?.columns.find((c) => c.id === rel.toColumnId)?.name,
    );
  };

  return (
    <div className="page">
      <div className="data-list-header">
        <span className="data-list-count">
          {state.tables.length} tables · {state.relations.length} relations · {state.schemaVersions.length}{' '}
          versions
        </span>
        <div className="data-list-actions">
          <SortControl
            options={TABLE_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: s.label }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LinkSimple size={13} aria-hidden="true" />}
              onClick={() => setNewRelationOpen(true)}
            >
              New relation
            </Button>
          )}
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setNewTableOpen(true)}>
              New table
            </Button>
          )}
        </div>
      </div>

      <div className="sub-tabs" role="tablist" aria-label="Schema view">
        <button
          ref={tabTablesRef}
          type="button"
          className={`sub-tab ${view === 'tables' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('tables')}
          onKeyDown={handleTabKeyDown}
          role="tab"
          id="tab-tables"
          aria-selected={view === 'tables'}
          aria-controls="panel-tables"
          tabIndex={view === 'tables' ? 0 : -1}
        >
          <List size={13} aria-hidden="true" />
          Tables
        </button>
        <button
          ref={tabErdRef}
          type="button"
          className={`sub-tab ${view === 'erd' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('erd')}
          onKeyDown={handleTabKeyDown}
          role="tab"
          id="tab-erd"
          aria-selected={view === 'erd'}
          aria-controls="panel-erd"
          tabIndex={view === 'erd' ? 0 : -1}
        >
          <Graph size={13} aria-hidden="true" />
          ERD
        </button>
      </div>

      <div className="schema-layout">
        <div className="schema-main">
          {view === 'tables' ? (
            <div id="panel-tables" role="tabpanel" aria-labelledby="tab-tables" tabIndex={0}>
              {state.tables.length === 0 ? (
                <EmptyState
                  icon={<Graph size={22} />}
                  title="No tables yet"
                  description="Model your database — tables, columns, keys — then view the ERD."
                  action={canEdit ? <Button size="sm" onClick={() => setNewTableOpen(true)}>New table</Button> : undefined}
                />
              ) : (
                <div className="data-list">
                  {applySort(state.tables, tableSortSpec, effectiveSort.dir).map((t) => (
                    <div key={t.id} className="data-row">
                      <button
                        type="button"
                        className="data-row-main"
                        onClick={() => setTableId(t.id)}
                        aria-label={`Edit table ${t.name}`}
                      >
                        <div className="data-row-title">
                          <span className="row-title-text">{t.name}</span>
                        </div>
                        <div className="data-row-sub">{t.comment || 'No comment.'}</div>
                        <div className="data-row-meta">
                          <span>
                            {t.columns.length} column{t.columns.length === 1 ? '' : 's'}
                          </span>
                          <span>
                            {t.indexes.length} index{t.indexes.length === 1 ? '' : 'es'}
                          </span>
                          <span>#{shortId(t.id)}</span>
                          {unreadIds?.has(t.id) && (
                            <>
                              <span className="unread-dot" aria-hidden="true" />
                              <span className="sr-only">Unread</span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div id="panel-erd" role="tabpanel" aria-labelledby="tab-erd" tabIndex={0}>
              <div className="erd-wrap">
                <ERD
                  state={state}
                  onDeleteRelation={setConfirmRel}
                  onNewTable={canEdit ? () => setNewTableOpen(true) : () => {}}
                />
                {state.relations.length > 0 && (
                  <div className="data-list relation-list">
                    <span className="data-list-count">Relations</span>
                    {state.relations.map((r) => (
                      <div className="data-row" key={r.id}>
                        <div className="data-row-main">
                          <div className="data-row-title">
                            <span className="row-title-text font-mono">{relationLabel(r)}</span>
                          </div>
                          <div className="data-row-meta">
                            <span>{r.cardinality}</span>
                            <span>on delete: {r.onDelete}</span>
                            <span>#{shortId(r.id)}</span>
                            {unreadIds?.has(r.id) && (
                              <>
                                <span className="unread-dot" aria-hidden="true" />
                                <span className="sr-only">Unread</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="data-row-side">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="btn-icon"
                              aria-label={`Delete relation ${relationLabel(r)}`}
                              onClick={() => setConfirmRel(r)}
                            >
                              <Trash size={13} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="schema-side" aria-label="Schema versions">
          <div className="versions-section">
            <div className="data-list-header">
              <span className="data-list-count">Schema versions</span>
              <SortControl
                options={VERSION_SORT_SPECS.map((s) => ({ value: s.key, label: s.label }))}
                value={versionSortValue}
                onChange={setVersionSort}
              />
              {state.schemaVersions.filter((v) => v.snapshot).length >= 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<GitDiff size={13} aria-hidden="true" />}
                  onClick={() => setDiffOpen(true)}
                >
                  Diff versions
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<FloppyDisk size={13} aria-hidden="true" />}
                  onClick={() => setSaveVersionOpen(true)}
                >
                  Save version
                </Button>
              )}
            </div>
            {state.schemaVersions.length === 0 ? (
              <EmptyState
                icon={<FloppyDisk size={22} />}
                title="No versions yet"
                description="Snapshot the schema whenever it changes."
                action={canEdit ? <Button size="sm" variant="ghost" leftIcon={<FloppyDisk size={13} aria-hidden="true" />} onClick={() => setSaveVersionOpen(true)}>Save version</Button> : undefined}
              />
            ) : (
              <div>
                {applySort(state.schemaVersions, versionSortSpec, versionSortValue?.dir ?? 'asc').map(
                  (v) => (
                    <div className="version-row" key={v.id}>
                      <Badge tone="accent">{v.version}</Badge>
                      {unreadIds?.has(v.id) && (
                        <>
                          <span className="unread-dot" aria-hidden="true" />
                          <span className="sr-only">Unread</span>
                        </>
                      )}
                      <div className="version-main">
                        <div className="version-notes">{v.notes || 'No notes.'}</div>
                        <div className="version-date">applied {formatDate(v.appliedAt)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <NewTableModal open={newTableOpen} onClose={() => setNewTableOpen(false)} />
      <TableModal tableId={tableId} onClose={() => setTableId(null)} />
      <NewRelationModal open={newRelationOpen} onClose={() => setNewRelationOpen(false)} />
      <SaveVersionModal open={saveVersionOpen} onClose={() => setSaveVersionOpen(false)} />
      <DiffVersionModal open={diffOpen} versions={state.schemaVersions} onClose={() => setDiffOpen(false)} />
      <Modal
        open={confirmRel !== null}
        title="Delete relation"
        onClose={() => setConfirmRel(null)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRel(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmRel) dispatch({ type: 'relation/remove', id: confirmRel.id });
                setConfirmRel(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="modal-copy">
          Remove the relation {confirmRel ? relationLabel(confirmRel) : ''}? Tables and columns stay
          untouched.
        </p>
      </Modal>
    </div>
  );
}
