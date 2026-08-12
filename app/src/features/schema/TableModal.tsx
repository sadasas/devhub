import { useEffect, useRef, useState } from 'react';
import { Plus, Trash, X } from '@phosphor-icons/react';
import { newId, formatRelative } from '../../lib/utils';
import type { State, Column } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty, DetailList, DetailRow } from '../../components/DetailList';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface TableModalProps {
  tableId: string | null;
  onClose: () => void;
}

export function TableModal({ tableId, onClose }: TableModalProps) {
  const { state, dispatch, canEdit } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [tableId]);

  const table = tableId ? state?.tables.find((t) => t.id === tableId) : undefined;
  if (!state || !table) return null;

  const update = (patch: UpdatePatch<typeof table>) => {
    dispatch({ type: 'table/update', id: table.id, patch });
  };

  const updateColumn = (columnId: string, patch: Partial<Omit<Column, 'id'>>) => {
    update({ columns: table.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)) });
  };

  const addColumn = () => {
    update({
      columns: [...table.columns, { id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '' }],
    });
  };

  const removeColumn = (columnId: string) => {
    update({ columns: table.columns.filter((c) => c.id !== columnId) });
    state.relations
      .filter((r) => r.fromColumnId === columnId || r.toColumnId === columnId)
      .forEach((r) => dispatch({ type: 'relation/remove', id: r.id }));
  };

  const remove = () => {
    dispatch({ type: 'table/remove', id: table.id });
    onClose();
  };

  const startEditing = () => {
    editSnapshot.current = structuredClone(state);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (editSnapshot.current) {
      dispatch({ type: 'replace', state: editSnapshot.current });
      editSnapshot.current = null;
    }
    setEditing(false);
  };

  const finishEditing = () => {
    editSnapshot.current = null;
    setEditing(false);
    onClose();
  };

  return (
    <>
    <Modal
      open={tableId !== null}
      title={editing ? 'Edit table' : 'Table'}
      onClose={onClose}
      width="lg"
      footer={
        <>
          {canEdit && !editing && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                Cancel
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                Done
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                Edit
              </Button>
            )
          )}
        </>
      }
    >
      <div className="form-stack">
        {editing ? (
          <>
            <Input
              label="Name"
              value={table.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <Textarea
              label="Comment"
              rows={2}
              value={table.comment}
              onChange={(e) => update({ comment: e.target.value })}
            />
            <div className="field">
              <span className="field-label">Columns</span>
              <div className="col-edit-grid">
                <div className="col-edit-caption" aria-hidden="true">
                  <span>Name</span>
                  <span>Type</span>
                  <span className="col-edit-check">Null</span>
                  <span className="col-edit-check">PK</span>
                  <span>Default</span>
                  <span />
                </div>
                {table.columns.map((c) => (
                  <div className="col-edit-row" key={c.id}>
                    <input
                      className="input"
                      aria-label={`Column ${c.name || 'name'}`}
                      placeholder="name"
                      value={c.name}
                      onChange={(e) => updateColumn(c.id, { name: e.target.value })}
                    />
                    <input
                      className="input"
                      aria-label={`Type of ${c.name || 'column'}`}
                      placeholder="uuid"
                      value={c.type}
                      onChange={(e) => updateColumn(c.id, { type: e.target.value })}
                    />
                    <label className="col-edit-check" title="Nullable">
                      <input
                        type="checkbox"
                        checked={c.nullable}
                        onChange={(e) => updateColumn(c.id, { nullable: e.target.checked })}
                      />
                    </label>
                    <label className="col-edit-check" title="Primary key">
                      <input
                        type="checkbox"
                        checked={c.primaryKey}
                        onChange={(e) => updateColumn(c.id, { primaryKey: e.target.checked })}
                      />
                    </label>
                    <input
                      className="input"
                      aria-label={`Default of ${c.name || 'column'}`}
                      placeholder="—"
                      value={c.default ?? ''}
                      onChange={(e) => updateColumn(c.id, { default: e.target.value || null })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-icon"
                      aria-label={`Delete column ${c.name || 'unnamed'}`}
                      onClick={() => removeColumn(c.id)}
                    >
                      <X size={13} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                {table.columns.length === 0 && (
                  <p className="field-helper">No columns yet — add the first one.</p>
                )}
              </div>
              <Button variant="ghost" size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={addColumn}>
                Add column
              </Button>
            </div>
            <Input
              label="Indexes"
              helper="Comma-separated column or expression names."
              placeholder="created_at, lower(email)"
              value={table.indexes.join(', ')}
              onChange={(e) =>
                update({ indexes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
              }
            />
            <p className="field-helper">
              Updated {formatRelative(table.updatedAt)} · deleting a column removes its relations
            </p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{table.name || <DetailEmpty>Unnamed table</DetailEmpty>}</h3>
            <DetailList>
              <DetailRow label="Comment">
                {table.comment.trim() ? table.comment : <DetailEmpty>No comment.</DetailEmpty>}
              </DetailRow>
              <DetailRow label="Columns">
                {table.columns.length === 0 ? (
                  <DetailEmpty>No columns yet.</DetailEmpty>
                ) : (
                  <div>
                    <div className="detail-col-caption" aria-hidden="true">
                      <span>Name</span>
                      <span>Type</span>
                      <span className="detail-col-flags">Flags</span>
                      <span>Default</span>
                    </div>
                    {table.columns.map((c) => (
                      <div className="detail-col-row" key={c.id}>
                        <span className="detail-col-name">{c.name || <DetailEmpty>unnamed</DetailEmpty>}</span>
                        <span className="detail-col-type">{c.type || <DetailEmpty />}</span>
                        <span className="detail-col-flags">
                          {c.primaryKey && <Badge tone="accent">PK</Badge>}
                          {c.nullable && <Badge>NULL</Badge>}
                        </span>
                        <span className="detail-col-default">{c.default ?? <DetailEmpty />}</span>
                      </div>
                    ))}
                  </div>
                )}
              </DetailRow>
              <DetailRow label="Indexes">
                {table.indexes.length > 0 ? (
                  <span className="detail-chips">
                    {table.indexes.map((i) => (
                      <span key={i} className="font-mono">
                        {i}
                      </span>
                    ))}
                  </span>
                ) : (
                  <DetailEmpty />
                )}
              </DetailRow>
            </DetailList>
            <p className="field-helper">Updated {formatRelative(table.updatedAt)}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title="Delete table?"
      description="This permanently deletes the table, its columns and its relations. This cannot be undone."
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}