import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Plus, Table, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import { api } from '../../lib/api';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { MarkdownField } from '../../components/MarkdownField';
import { FE_LIMITS } from '../../lib/limits';
import { isUniqueIndex, toggleUnique } from './column-helpers';
import { ColumnTypeCombobox } from './ColumnTypeCombobox';
import type { Column } from '../../lib/types';

interface NewTableModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * U2: world-coords placement for the new node (viewport center from the
   * canvas [+ Table] pill, or the dblclick point). Omitted → grid fallback.
   */
  initialPosition?: { x: number; y: number } | null;
  /** U2: fired after a successful create so the caller can highlight + announce. */
  onCreated?: (tableId: string, tableName: string) => void;
}

export function NewTableModal({ open, onClose, initialPosition = null, onCreated }: NewTableModalProps) {
  const { t } = useTranslation('project');
  const { state, dispatch, projectId } = useProject();
  usePresenceStatus(t('schema.newTableModal.presenceCreating'), open);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [indexesInput, setIndexesInput] = useState('');
  const [columns, setColumns] = useState<Column[]>(() => [
    { id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null },
  ]);

  useEffect(() => {
    if (open) {
      setName('');
      setComment('');
      setIndexesInput('');
      setColumns([{ id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null }]);
    }
  }, [open]);

  const updateColumn = (columnId: string, patch: Partial<Omit<Column, 'id'>>) => {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, ...patch } : c)));
  };

  // U7: indexesInput adalah string koma — toggle unique operasi pada array hasil split lalu join kembali.
  const indexesList = indexesInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const toggleUniqueFor = (colName: string) => {
    setIndexesInput(toggleUnique(indexesList, colName).join(', '));
  };

  const addColumn = () => {
    setColumns((prev) => [...prev, { id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null }]);
  };

  const removeColumn = (columnId: string) => {
    setColumns((prev) => {
      const next = prev.filter((c) => c.id !== columnId);
      return next.length === 0 ? [{ id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null }] : next;
    });
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    const trimmedName = name.trim();
    const cleanedColumns = columns
      .filter((c) => c.name.trim() !== '')
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        type: c.type.trim(),
        comment: c.comment.trim(),
        default: c.default?.trim() ? c.default.trim() : null,
      }));
    const indexes = indexesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const id = newId();
    dispatch({
      type: 'table/add',
      table: {
        id,
        createdAt: ts,
        updatedAt: ts,
        name: trimmedName,
        comment: comment.trim(),
        columns: cleanedColumns,
        indexes,
      },
    });
    // U2: persist placement like handleMoveTable (dispatch is local-only for
    // erdLayout — the bulk PATCH is what reaches the server).
    if (initialPosition !== undefined && initialPosition !== null && Number.isFinite(initialPosition.x) && Number.isFinite(initialPosition.y)) {
      const pos = {
        x: Math.round(initialPosition.x * 10) / 10,
        y: Math.round(initialPosition.y * 10) / 10,
      };
      dispatch({ type: 'erdLayout/set', tableId: id, pos });
      const next = { ...(state?.erdLayout ?? {}), [id]: { ...pos } };
      api.patchErdLayout(projectId, next).catch(() => {});
    }
    onCreated?.(id, trimmedName);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('schema.newTableModal.title')}
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('schema.newTableModal.cancel')}
          </Button>
          <Button type="submit" form="new-table-form" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} disabled={!name.trim()}>
            {t('schema.newTableModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-table-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('schema.newTableModal.nameLabel')}
          required
          autoFocus
          placeholder={t('schema.newTableModal.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={FE_LIMITS.TABLE_NAME}
          showCount
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <MarkdownField
            label={t('schema.newTableModal.commentLabel')}
            icon={FileText}
            value={comment}
            onChange={setComment}
            placeholder={t('schema.newTableModal.commentPlaceholder')}
            maxLength={10000}
            rows={2}
          />

          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Table size={12} aria-hidden="true" /> {t('schema.table.columnsLabel')}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>
                · {columns.filter((c) => c.name.trim()).length} {t('schema.table.columnsLabel').toLowerCase()}
              </span>
            </div>
            <div className="col-edit-grid">
              <div className="col-edit-caption" aria-hidden="true">
                <span>{t('schema.table.captionName')}</span>
                <span>{t('schema.table.captionType')}</span>
                <span className="col-edit-check">{t('schema.table.captionNull')}</span>
                <span className="col-edit-check">{t('schema.table.captionPk')}</span>
                <span>{t('schema.table.captionDefault')}</span>
                <span>{t('schema.table.captionComment')}</span>
                <span className="col-edit-check">{t('schema.table.captionUnique')}</span>
                <span />
              </div>
              {columns.map((c) => (
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
                  <ColumnTypeCombobox
                    id={`new-col-type-${c.id}`}
                    value={c.type}
                    onChange={(next) => updateColumn(c.id, { type: next })}
                    ariaLabel={t('schema.table.typeAria', { name: c.name || t('schema.table.fbColumn') })}
                    customAriaLabel={t('schema.table.typeCustomAria', { name: c.name || t('schema.table.fbColumn') })}
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
                  <input
                    className="input col-comment-input"
                    aria-label={t('schema.table.columnCommentAria', { name: c.name || t('schema.table.fbColumn') })}
                    placeholder={t('schema.table.columnCommentPlaceholder')}
                    value={c.comment}
                    maxLength={FE_LIMITS.COLUMN_COMMENT}
                    onChange={(e) => updateColumn(c.id, { comment: e.target.value })}
                  />
                  <label
                    className="col-edit-check"
                    title={c.name.trim() === '' ? t('schema.table.uniqueDisabledTitle') : t('schema.table.uniqueTitle')}
                  >
                    <input
                      type="checkbox"
                      checked={isUniqueIndex(indexesList, c.name)}
                      disabled={c.name.trim() === ''}
                      aria-label={t('schema.table.uniqueAria', { name: c.name || t('schema.table.fbUnnamed') })}
                      onChange={() => toggleUniqueFor(c.name)}
                    />
                  </label>
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
            </div>
            <Button variant="ghost" size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={addColumn}>
              {t('schema.table.addColumn')}
            </Button>
            <p className="field-helper" style={{ marginTop: 8 }}>
              {t('schema.table.noColumnsYetEdit')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                paddingTop: 8,
              }}
            >
              <Table size={12} aria-hidden="true" /> {t('schema.table.indexesLabel')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                className="input"
                placeholder={t('schema.table.indexesPlaceholder')}
                value={indexesInput}
                maxLength={2500}
                onChange={(e) => setIndexesInput(e.target.value)}
                aria-label={t('schema.table.indexesLabel')}
              />
              <p className="field-helper">{t('schema.table.indexesHelper')}</p>
            </div>
          </div>
          {indexesInput.split(',').map((s) => s.trim()).filter(Boolean).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 122 }}>
              {indexesInput
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'var(--bg-inset)',
                      border: '1px solid var(--border-hairline)',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {idx}
                  </span>
                ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
