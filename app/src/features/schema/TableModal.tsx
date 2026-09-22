import { useEffect, useState } from 'react';
import { CheckCircle, Clock, FileText, Plus, Table, Trash, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelative, newId } from '../../lib/utils';
import type { Column } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { FE_LIMITS } from '../../lib/limits';
import { canAutoincrement, isPlainIndex, isUniqueIndex, togglePlainIndex, toggleUnique } from './column-helpers';
import { ActivityList } from '../../components/ActivityList';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { MarkdownField } from '../../components/MarkdownField';
import { Modal } from '../../components/Modal';
import { ColumnTypeCombobox } from './ColumnTypeCombobox';
import { ColumnFlagsToggle } from './ColumnFlagsToggle';

type ActiveField = 'name' | null;

interface TableModalProps {
  tableId: string | null;
  onClose: () => void;
}

export function TableModal({ tableId, onClose }: TableModalProps) {
  const { t } = useTranslation(['project', 'tracker']);
  const { state, dispatch, canEdit, projectId, saving, lastSavedAt } = useProject();
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setActiveField(null);
    setConfirmOpen(false);
  }, [tableId]);

  const table = tableId ? state?.tables.find((t) => t.id === tableId) : undefined;
  usePresenceStatus(t('schema.table.presenceEditing'), table != null);
  if (!state || !table) return null;

  const update = (patch: UpdatePatch<typeof table>) => {
    dispatch({ type: 'table/update', id: table.id, patch });
  };

  const updateColumn = (columnId: string, patch: Partial<Omit<Column, 'id'>>) => {
    update({ columns: table.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)) });
  };

  const addColumn = () => {
    const id = newId();
    update({
      columns: [...table.columns, { id, name: '', type: '', nullable: true, primaryKey: false, comment: '' }],
    });
    // Fokus input nama kolom baru setelah baris ter-render.
    window.setTimeout(() => {
      try {
        document.getElementById(`tbl-col-name-${id}`)?.focus();
      } catch {
        /* jsdom / no-op */
      }
    }, 0);
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

  const titleEmpty = table.name.trim() === '';

  return (
    <>
      <Modal
        open={tableId !== null}
        title={t('schema.table.viewTitle')}
        onClose={onClose}
        width="lg"
        footer={
          canEdit ? (
            <>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash size={14} aria-hidden="true" />}
                onClick={() => setConfirmOpen(true)}
              >
                {t('schema.table.delete')}
              </Button>
              {(saving || lastSavedAt) && !titleEmpty && (
                <span className="save-state" role="status">
                  {saving ? (
                    t('tracker:board.taskModal.autosaveSaving')
                  ) : (
                    <>
                      <CheckCircle size={13} weight="bold" aria-hidden="true" />
                      {t('tracker:board.taskModal.autosaveSaved')}
                    </>
                  )}
                </span>
              )}
            </>
          ) : undefined
        }
      >
        <div className="form-stack">
          <>
            {/* Title inline — komponen Input yang sama persis dengan NewTableModal */}
            {activeField === 'name' && canEdit ? (
              <Input
                label={t('schema.table.nameLabel')}
                required
                autoFocus
                placeholder={t('schema.newTableModal.namePlaceholder')}
                value={table.name}
                onChange={(e) => update({ name: e.target.value })}
                onBlur={() => setActiveField(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setActiveField(null);
                  if (e.key === 'Escape') setActiveField(null);
                }}
                id="tbl-title-input"
                maxLength={FE_LIMITS.TABLE_NAME}
                showCount
              />
            ) : (
              <>
                <label className="field-label" htmlFor="tbl-title-input">
                  {t('schema.table.nameLabel')}
                  <span className="field-required" aria-hidden="true">
                    {' '}*
                  </span>
                </label>
                <h3
                  className="detail-title"
                  onClick={() => canEdit && setActiveField('name')}
                style={{
                  cursor: canEdit ? 'text' : undefined,
                  padding: '4px 6px',
                  margin: '-4px -6px',
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => {
                  if (canEdit) (e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                title={canEdit ? t('tracker:issues.modal.clickToEdit') : undefined}
                role={canEdit ? 'button' : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onKeyDown={(e) => {
                  if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setActiveField('name');
                  }
                }}
              >
                {table.name || <DetailEmpty>{t('schema.table.unnamedTable')}</DetailEmpty>}
              </h3>
              </>
            )}
            {titleEmpty && activeField !== 'name' && <InlineError>{t('tracker:issues.modal.titleRequired')}</InlineError>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
              {/* Created time — seperti Issue/Task */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Clock size={12} aria-hidden="true" /> {t('tracker:issues.modal.createdTimeLabel')}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {formatDate(table.createdAt)} {new Date(table.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Comment — MarkdownField seperti IssueModal */}
              {canEdit ? (
                <MarkdownField
                  label={t('schema.table.commentLabel')}
                  icon={FileText}
                  value={table.comment}
                  onChange={(v) => update({ comment: v })}
                  placeholder={t('schema.newTableModal.commentPlaceholder')}
                  maxLength={FE_LIMITS.TABLE_COMMENT}
                  rows={3}
                  variant="bare"
                  previewToggle
                />
              ) : (
                <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} aria-hidden="true" /> {t('schema.table.commentLabel')}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: table.comment.trim() ? 'var(--text-secondary)' : 'var(--text-muted)',
                      minHeight: 40,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {table.comment.trim() ? table.comment : t('schema.noComment')}
                  </div>
                </div>
              )}

              {/* Columns — card bg-inset, selalu editable jika canEdit */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Table size={12} aria-hidden="true" /> {t('schema.table.columnsLabel')} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>· {table.columns.length}</span>
                  </span>
                  {canEdit && (
                    <Button variant="ghost" size="sm" leftIcon={<Plus size={14} aria-hidden="true" />} onClick={addColumn}>
                      {t('schema.table.addColumn')}
                    </Button>
                  )}
                </div>
                {canEdit ? (
                  <>
                    <div className="col-edit-grid">
                      <div className="col-edit-caption" aria-hidden="true">
                        <span>{t('schema.table.captionName')}</span>
                        <span>{t('schema.table.captionType')}</span>
                        <span className="col-edit-caption-flags">{t('schema.table.detailCaptionFlags')}</span>
                        <span>{t('schema.table.captionDefault')}</span>
                        <span className="col-edit-caption-comment">{t('schema.table.captionComment')}</span>
                        <span />
                      </div>
                      {table.columns.map((c) => (
                        <div className="col-edit-row" key={c.id}>
                          <input
                            className="input"
                            id={`tbl-col-name-${c.id}`}
                            aria-label={t('schema.table.colAria', { name: c.name || t('schema.table.fbName') })}
                            placeholder={t('schema.table.namePlaceholder')}
                            value={c.name}
                            maxLength={FE_LIMITS.COLUMN_NAME}
                            required
                            onChange={(e) => updateColumn(c.id, { name: e.target.value })}
                          />
                          <ColumnTypeCombobox
                            id={`col-type-${c.id}`}
                            value={c.type}
                            onChange={(next) => updateColumn(c.id, { type: next })}
                            ariaLabel={t('schema.table.typeAria', { name: c.name || t('schema.table.fbColumn') })}
                            customAriaLabel={t('schema.table.typeCustomAria', { name: c.name || t('schema.table.fbColumn') })}
                          />
                          <ColumnFlagsToggle
                            value={{
                              nullable: c.nullable,
                              primaryKey: c.primaryKey,
                              unique: isUniqueIndex(table.indexes, c.name),
                              autoincrement: c.autoincrement ?? false,
                              indexed: isPlainIndex(table.indexes, c.name),
                            }}
                            onChange={(next) => {
                              const wasUnique = isUniqueIndex(table.indexes, c.name);
                              if (next.unique !== wasUnique) {
                                update({ indexes: toggleUnique(table.indexes, c.name) });
                              }
                              const wasIndexed = isPlainIndex(table.indexes, c.name);
                              if ((next.indexed ?? false) !== wasIndexed) {
                                update({ indexes: togglePlainIndex(table.indexes, c.name) });
                              }
                              const patch: Partial<Pick<Column, 'nullable' | 'primaryKey' | 'autoincrement'>> = {};
                              if (next.nullable !== c.nullable || next.primaryKey !== c.primaryKey) {
                                patch.nullable = next.nullable;
                                patch.primaryKey = next.primaryKey;
                              }
                              if ((next.autoincrement ?? false) !== (c.autoincrement ?? false)) {
                                patch.autoincrement = next.autoincrement ?? false;
                              }
                              if (Object.keys(patch).length > 0) updateColumn(c.id, patch);
                            }}
                            uniqueDisabled={c.name.trim() === ''}
                            uniqueDisabledTitle={t('schema.table.uniqueDisabledTitle')}
                            autoDisabled={!canAutoincrement(c.type)}
                            autoDisabledTitle={t('schema.table.autoDisabledTitle')}
                            indexedDisabled={c.name.trim() === ''}
                            indexedDisabledTitle={t('schema.table.indexedDisabledTitle')}
                            nullableLabel={t('schema.table.nullableAria', { name: c.name || t('schema.table.fbUnnamed') })}
                            primaryLabel={t('schema.table.pkAria', { name: c.name || t('schema.table.fbUnnamed') })}
                            uniqueLabel={t('schema.table.uniqueAria', { name: c.name || t('schema.table.fbUnnamed') })}
                            autoLabel={t('schema.table.autoAria', { name: c.name || t('schema.table.fbUnnamed') })}
                            indexedLabel={t('schema.table.indexedAria', { name: c.name || t('schema.table.fbUnnamed') })}
                          />
                          <input
                            className="input"
                            aria-label={t('schema.table.defaultAria', { name: c.name || t('schema.table.fbColumn') })}
                            placeholder={t('schema.table.defaultPlaceholder')}
                            value={c.default ?? ''}
                            maxLength={FE_LIMITS.COLUMN_DEFAULT}
                            onChange={(e) => updateColumn(c.id, { default: e.target.value || null })}
                          />
                          <input
                            className="input col-comment-input"
                            aria-label={t('schema.table.columnCommentAria', { name: c.name || t('schema.table.fbColumn') })}
                            placeholder={t('schema.table.columnCommentPlaceholder')}
                            value={c.comment}
                            maxLength={FE_LIMITS.COLUMN_COMMENT}
                            onChange={(e) => updateColumn(c.id, { comment: e.target.value })}
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            className="btn-icon"
                            aria-label={t('schema.table.deleteColAria', { name: c.name || t('schema.table.fbUnnamed') })}
                            onClick={() => removeColumn(c.id)}
                          >
                            <Trash size={13} aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      {table.columns.length === 0 && <p className="field-helper">{t('schema.table.noColumnsYetEdit')}</p>}
                    </div>
                    <p className="field-helper" style={{ marginTop: 6 }}>
                      {t('schema.table.updatedEditInfo', { time: formatRelative(table.updatedAt) })}
                    </p>
                  </>
                ) : table.columns.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('schema.table.noColumnsView')}</div>
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
              </div>

              {/* Indexes — chips read-only + hapus per entri (kelola via toggle U/I per kolom) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Table size={12} aria-hidden="true" /> {t('schema.table.indexesLabel')}
                </span>
                {table.indexes.length > 0 ? (
                  <ul className="erd-panel-indexes" style={{ flex: 1, minWidth: 0 }}>
                    {table.indexes.map((idx) => (
                      <li
                        key={idx}
                        className="erd-panel-index font-mono"
                        title={idx}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idx}</span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => update({ indexes: table.indexes.filter((x) => x !== idx) })}
                            aria-label={t('schema.table.removeIndexAria', { index: idx })}
                            title={t('schema.table.removeIndexAria', { index: idx })}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }}
                          >
                            <X size={11} aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                )}
              </div>
            </div>

            <h4 className="detail-subtitle">{t('schema.table.activity')}</h4>
            <ActivityList projectId={projectId} entity="tables" entityId={table.id} />
            <p className="field-helper">{t('schema.table.updated', { time: formatRelative(table.updatedAt) })}</p>
          </>
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
