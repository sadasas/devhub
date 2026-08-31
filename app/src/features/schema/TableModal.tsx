import { useEffect, useState } from 'react';
import { ArrowsOutSimple, Clock, FileText, Plus, Table, Trash, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelative, newId } from '../../lib/utils';
import type { Column } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { FE_LIMITS } from '../../lib/limits';
import { ActivityList } from '../../components/ActivityList';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';

type ActiveField = 'name' | 'comment' | 'indexes' | null;

interface TableModalProps {
  tableId: string | null;
  onClose: () => void;
}

export function TableModal({ tableId, onClose }: TableModalProps) {
  const { t } = useTranslation(['project', 'tracker']);
  const { state, dispatch, canEdit, projectId } = useProject();
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<ActiveField>(null);

  useEffect(() => {
    setActiveField(null);
    setConfirmOpen(false);
    setFullscreenField(null);
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

  const titleEmpty = table.name.trim() === '';

  return (
    <>
      <Modal
        open={tableId !== null}
        title={t('schema.table.viewTitle')}
        onClose={fullscreenField ? () => setFullscreenField(null) : onClose}
        width="lg"
        footer={
          canEdit ? (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('schema.table.delete')}
            </Button>
          ) : undefined
        }
      >
        <div className="form-stack">
          <>
            {/* Title inline — seperti IssueModal */}
            {activeField === 'name' && canEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <input
                  className="input"
                  value={table.name}
                  autoFocus
                  maxLength={300}
                  required
                  onChange={(e) => update({ name: e.target.value })}
                  onBlur={() => setActiveField(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setActiveField(null);
                    if (e.key === 'Escape') setActiveField(null);
                  }}
                  aria-label={t('schema.table.nameLabel')}
                  placeholder={t('schema.newTableModal.namePlaceholder')}
                />
                <span style={{ fontSize: 11, color: table.name.length > 270 ? 'var(--status-danger)' : table.name.length > 240 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', alignSelf: 'flex-end' }}>{table.name.length.toLocaleString()} / {(300).toLocaleString()}</span>
              </div>
            ) : (
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
            )}
            {titleEmpty && activeField !== 'name' && <InlineError>{t('tracker:issues.modal.titleRequired')}</InlineError>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
              {/* Created time — seperti Issue/Task */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Clock size={12} aria-hidden="true" /> {t('tracker:issues.modal.createdTimeLabel')}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {formatDate(table.createdAt)} {new Date(table.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Comment — card bg-inset seperti Issue description */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} aria-hidden="true" /> {t('schema.table.commentLabel')}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
                    title={t('tracker:issues.modal.fullscreenAriaDescription')}
                    onClick={() => setFullscreenField('comment')}
                  >
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </div>
                {activeField === 'comment' && canEdit ? (
                  <>
                    <textarea
                      className="textarea"
                      value={table.comment}
                      autoFocus
                      rows={3}
                      placeholder={t('schema.newTableModal.commentPlaceholder')}
                      onChange={(e) => update({ comment: e.target.value })}
                      onBlur={() => setActiveField(null)}
                      aria-label={t('schema.table.commentLabel')}
                      maxLength={10000}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: table.comment.length > 9000 ? 'var(--status-danger)' : table.comment.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {table.comment.length.toLocaleString()} / {(10000).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => canEdit && setActiveField('comment')}
                    role={canEdit ? 'button' : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setActiveField('comment');
                      }
                    }}
                    style={{
                      cursor: canEdit ? 'text' : undefined,
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: table.comment.trim() ? 'var(--text-secondary)' : 'var(--text-muted)',
                      minHeight: 40,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {table.comment.trim() ? table.comment : t('schema.noComment')}
                  </div>
                )}
              </div>

              {/* Columns — card bg-inset, selalu editable jika canEdit */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Table size={12} aria-hidden="true" /> {t('schema.table.columnsLabel')} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>· {table.columns.length}</span>
                  </span>
                  {canEdit && (
                    <Button variant="ghost" size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={addColumn}>
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
                            maxLength={FE_LIMITS.COLUMN_NAME}
                            required
                            onChange={(e) => updateColumn(c.id, { name: e.target.value })}
                          />
                          <input
                            className="input"
                            aria-label={t('schema.table.typeAria', { name: c.name || t('schema.table.fbColumn') })}
                            placeholder={t('schema.table.typePlaceholder')}
                            value={c.type}
                            maxLength={FE_LIMITS.COLUMN_TYPE}
                            required
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
                            maxLength={FE_LIMITS.COLUMN_DEFAULT}
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

              {/* Indexes — row 110px label, inline edit seperti Task labels */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Table size={12} aria-hidden="true" /> {t('schema.table.indexesLabel')}
                </span>
                {activeField === 'indexes' && canEdit ? (
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        className="input"
                        autoFocus
                        placeholder={t('schema.table.indexesPlaceholder')}
                        value={table.indexes.join(', ')}
                        maxLength={2500}
                        onChange={(e) => update({ indexes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                        onBlur={() => setActiveField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') setActiveField(null);
                        }}
                        aria-label={t('schema.table.indexesLabel')}
                      />
                      <p className="field-helper">{t('schema.table.indexesHelper')}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveField(null)}>
                      {t('schema.table.done')}
                    </Button>
                  </div>
                ) : table.indexes.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => canEdit && setActiveField('indexes')}
                    style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', padding: 0 }}
                    aria-label={canEdit ? t('tracker:issues.modal.clickToEdit') : undefined}
                  >
                    {table.indexes.map((idx) => (
                      <span key={idx} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {idx}
                      </span>
                    ))}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => canEdit && setActiveField('indexes')}
                    style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', color: 'var(--text-muted)', fontSize: 13 }}
                  >
                    —
                  </button>
                )}
              </div>
            </div>

            <h4 className="detail-subtitle">{t('schema.table.activity')}</h4>
            <ActivityList projectId={projectId} entity="tables" entityId={table.id} />
            <p className="field-helper">{t('schema.table.updated', { time: formatRelative(table.updatedAt) })}</p>
          </>
        </div>
      </Modal>
      {fullscreenField === 'comment' && (
        <Modal open title={t('tracker:issues.modal.fullscreenTitle', { label: t('schema.table.commentLabel') })} onClose={() => setFullscreenField(null)} width="lg" className="modal-fullscreen">
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={table.comment}
                  autoFocus={canEdit}
                  readOnly={!canEdit}
                  placeholder={t('schema.newTableModal.commentPlaceholder')}
                  onChange={(e) => canEdit && update({ comment: e.target.value })}
                  aria-label={t('schema.table.commentLabel')}
                  maxLength={10000}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {table.comment.trim() ? table.comment : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{canEdit ? t('tracker:issues.modal.fullscreenHelper') : t('tracker:issues.modal.fullscreenHelperReadOnly')}</p>
              <span style={{ fontSize: 11, color: table.comment.length > 9000 ? 'var(--status-danger)' : table.comment.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {table.comment.length.toLocaleString()} / {(10000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
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
