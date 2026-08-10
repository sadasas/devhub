import { useState } from 'react';
import { FloppyDisk, Graph, LinkSimple, List, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { formatDate, shortId } from '../../lib/utils';
import type { Relation } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { ERD } from './ERD';
import { NewRelationModal } from './NewRelationModal';
import { NewTableModal } from './NewTableModal';
import { SaveVersionModal } from './SaveVersionModal';
import { TableModal } from './TableModal';

type SchemaView = 'tables' | 'erd';

export function SchemaPage() {
  const { state, loading, error, dispatch, canEdit } = useProject();
  const [view, setView] = useState<SchemaView>('tables');
  const [newTableOpen, setNewTableOpen] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);
  const [newRelationOpen, setNewRelationOpen] = useState(false);
  const [confirmRel, setConfirmRel] = useState<Relation | null>(null);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);

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
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  }

  if (!state) return null;

  const relationLabel = (rel: Relation) => {
    const ft = state.tables.find((t) => t.id === rel.fromTableId);
    const tt = state.tables.find((t) => t.id === rel.toTableId);
    const fc = ft?.columns.find((c) => c.id === rel.fromColumnId);
    const tc = tt?.columns.find((c) => c.id === rel.toColumnId);
    return `${ft?.name ?? '?'}.${fc?.name ?? '?'} → ${tt?.name ?? '?'}.${tc?.name ?? '?'}`;
  };

  return (
    <div>
      <div className="data-list-header">
        <span className="data-list-count">
          {state.tables.length} tables · {state.relations.length} relations · {state.schemaVersions.length}{' '}
          versions
        </span>
        <div className="data-list-actions">
          {canEdit && view === 'erd' && (
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
          type="button"
          className={`sub-tab ${view === 'tables' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('tables')}
          aria-current={view === 'tables' ? 'page' : undefined}
        >
          <List size={13} aria-hidden="true" />
          Tables
        </button>
        <button
          type="button"
          className={`sub-tab ${view === 'erd' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('erd')}
          aria-current={view === 'erd' ? 'page' : undefined}
        >
          <Graph size={13} aria-hidden="true" />
          ERD
        </button>
      </div>

      {view === 'tables' ? (
        state.tables.length === 0 ? (
          <div className="page-empty">
            <div className="empty-state">
              <Graph size={22} aria-hidden="true" />
              <p className="empty-state-title">No tables yet</p>
              <p className="empty-state-desc">
                Model your database — tables, columns, keys — then view the ERD.
              </p>
              {canEdit && (
                <Button size="sm" onClick={() => setNewTableOpen(true)}>
                  New table
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="data-list">
            {[...state.tables]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <div
                  key={t.id}
                  className="data-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => setTableId(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTableId(t.id);
                    }
                  }}
                >
                  <div className="data-row-main">
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
                    </div>
                  </div>
                  <div className="data-row-side">
                    {canEdit && (
                      <Button variant="ghost" size="sm" className="btn-icon" aria-label={`Edit table ${t.name}`}>
                        <PencilSimple size={13} aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )
      ) : (
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
                    </div>
                  </div>
                  <div className="data-row-side">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="btn-icon"
                        aria-label="Delete relation"
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
      )}

      <div className="versions-section">
        <div className="data-list-header">
          <span className="data-list-count">Schema versions</span>
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
          <p className="field-helper" style={{ padding: '4px 2px' }}>
            No versions recorded — snapshot the schema whenever it changes.
          </p>
        ) : (
          <div>
            {[...state.schemaVersions]
              .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
              .map((v) => (
                <div className="version-row" key={v.id}>
                  <Badge tone="accent">{v.version}</Badge>
                  <div className="version-main">
                    <div className="version-notes">{v.notes || 'No notes.'}</div>
                    <div className="version-date">applied {formatDate(v.appliedAt)}</div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <NewTableModal open={newTableOpen} onClose={() => setNewTableOpen(false)} />
      <TableModal tableId={tableId} onClose={() => setTableId(null)} />
      <NewRelationModal open={newRelationOpen} onClose={() => setNewRelationOpen(false)} />
      <SaveVersionModal open={saveVersionOpen} onClose={() => setSaveVersionOpen(false)} />
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
