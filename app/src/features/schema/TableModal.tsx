import { useEffect, useRef, useState } from 'react';
import { Plus, Trash, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, formatRelative } from '../../lib/utils';
import type { State, Column } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Badge } from '../../components/Badge';
import { ActivityList } from '../../components/ActivityList';
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
  const { t } = useTranslation('project');
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [tableId]);

  const table = tableId ? state?.tables.find((t) => t.id === tableId) : undefined;
  usePresenceStatus('Editing table', table != null);
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
      title={editing ? t('schema.table.editTitle') : t('schema.table.viewTitle')}
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
              {t('schema.table.delete')}
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                {t('schema.table.cancel')}
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                {t('schema.table.done')}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                {t('schema.table.edit')}
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
              label={t('schema.table.nameLabel')}
              value={table.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <Textarea
              label={t('schema.table.commentLabel')}
              rows={2}
              value={table.comment}
              onChange={(e) => update({ comment: e.target.value })}
            />
            <div className="field">
              <span className="field-label">{t('schema.table.columnsLabel')}</span>
              <div className="col-edit-grid">
                <div className="col-edit-caption" aria-hidden="true">
                  <span>{t('schema.table.captionName')}</span>
                  <span>{t('schema.table.captionType')}</span>
                  <span className="col-edit-check">{t('schema.table.captionNull')}</span>
                  <span className="col-edit-check">{t('schema.table.captionPk')}</span>
                  <span>{t('schema.table.captionDefault')}</span>
                  <span />
                </div>
                {table.columns.map((c) => (
                  <div className="col-edit-row" key={c.id}>
                    <input
                      className="input"
                      aria-label={t('schema.table.colAria', { name: c.name || t('schema.table.fbName') })}
                      placeholder={t('schema.table.namePlaceholder')}
                      value={c.name}
                      onChange={(e) => updateColumn(c.id, { name: e.target.value })}
                    />
                    <input
                      className="input"
                      aria-label={t('schema.table.typeAria', { name: c.name || t('schema.table.fbColumn') })}
                      placeholder={t('schema.table.typePlaceholder')}
                      value={c.type}
                      onChange={(e) => updateColumn(c.id, { type: e.target.value })}
                    />
                    <label className="col-edit-check" title={t('schema.table.nullableTitle')}>
                      <input
                        type="checkbox"
                        checked={c.nullable}
                        aria-label={t('schema.table.nullableAria', { name: c.name || t('schema.table.fbUnnamed') })}
                        onChange={(e) => updateColumn(c.id, { nullable: e.target.checked })}
                      />
                    </label>
                    <label className="col-edit-check" title={t('schema.table.primaryKeyTitle')}>
                      <input
                        type="checkbox"
                        checked={c.primaryKey}
                        aria-label={t('schema.table.pkAria', { name: c.name || t('schema.table.fbUnnamed') })}
                        onChange={(e) => updateColumn(c.id, { primaryKey: e.target.checked })}
                      />
                    </label>
                    <input
                      className="input"
                      aria-label={t('schema.table.defaultAria', { name: c.name || t('schema.table.fbColumn') })}
                      placeholder={t('schema.table.defaultPlaceholder')}
                      value={c.default ?? ''}
                      onChange={(e) => updateColumn(c.id, { default: e.target.value || null })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-icon"
                      aria-label={t('schema.table.deleteColAria', { name: c.name || t('schema.table.fbUnnamed') })}
                      onClick={() => removeColumn(c.id)}
                    >
                      <X size={13} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                {table.columns.length === 0 && (
                  <p className="field-helper">{t('schema.table.noColumnsYetEdit')}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={addColumn}>
                {t('schema.table.addColumn')}
              </Button>
            </div>
            <Input
              label={t('schema.table.indexesLabel')}
              helper={t('schema.table.indexesHelper')}
              placeholder={t('schema.table.indexesPlaceholder')}
              value={table.indexes.join(', ')}
              onChange={(e) =>
                update({ indexes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
              }
            />
            <p className="field-helper">
              {t('schema.table.updatedEditInfo', { time: formatRelative(table.updatedAt) })}
            </p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{table.name || <DetailEmpty>{t('schema.table.unnamedTable')}</DetailEmpty>}</h3>
            <DetailList>
              <DetailRow label={t('schema.table.commentLabel')}>
                {table.comment.trim() ? table.comment : <DetailEmpty>{t('schema.noComment')}</DetailEmpty>}
              </DetailRow>
              <DetailRow label={t('schema.table.columnsLabel')}>
                {table.columns.length === 0 ? (
                  <DetailEmpty>{t('schema.table.noColumnsView')}</DetailEmpty>
                ) : (
                  <div>
                    <div className="detail-col-caption" aria-hidden="true">
                      <span>{t('schema.table.captionName')}</span>
                      <span>{t('schema.table.captionType')}</span>
                      <span className="detail-col-flags">{t('schema.table.detailCaptionFlags')}</span>
                      <span>{t('schema.table.captionDefault')}</span>
                    </div>
                    {table.columns.map((c) => (
                      <div className="detail-col-row" key={c.id}>
                        <span className="detail-col-name">{c.name || <DetailEmpty>{t('schema.table.unnamedColumn')}</DetailEmpty>}</span>
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
              <DetailRow label={t('schema.table.indexesLabel')}>
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
            <h4 className="detail-subtitle">{t('schema.table.activity')}</h4>
            <ActivityList projectId={projectId} entity="tables" entityId={table.id} />
            <p className="field-helper">{t('schema.table.updated', { time: formatRelative(table.updatedAt) })}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title={t('schema.table.deleteConfirmTitle')}
      description={t('schema.table.deleteConfirmBody')}
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}