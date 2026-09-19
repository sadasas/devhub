import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Plus, Table, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { MarkdownField } from '../../components/MarkdownField';
import { FE_LIMITS } from '../../lib/limits';
import { canAutoincrement, isPlainIndex, isUniqueIndex, togglePlainIndex, toggleUnique } from './column-helpers';
import { ColumnTypeCombobox } from './ColumnTypeCombobox';
import { ColumnFlagsToggle } from './ColumnFlagsToggle';
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
  const { dispatch } = useProject();
  usePresenceStatus(t('schema.newTableModal.presenceCreating'), open);
  const autoFocusName = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [indexes, setIndexes] = useState<string[]>([]);
  const [columns, setColumns] = useState<Column[]>(() => [
    { id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null },
  ]);

  useEffect(() => {
    if (open) {
      setName('');
      setComment('');
      setColor(null);
      setIndexes([]);
      setColumns([{ id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null }]);
    }
  }, [open]);

  const updateColumn = (columnId: string, patch: Partial<Omit<Column, 'id'>>) => {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, ...patch } : c)));
  };

  // Indexes dikelola via toggle per-kolom (U/I) — tanpa input manual.
  const indexesList = indexes;
  const toggleUniqueFor = (colName: string) => {
    setIndexes((prev) => toggleUnique(prev, colName));
  };
  const togglePlainIndexFor = (colName: string) => {
    setIndexes((prev) => togglePlainIndex(prev, colName));
  };

  const addColumn = () => {
    const id = newId();
    setColumns((prev) => [...prev, { id, name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null }]);
    // Fokus input nama kolom baru setelah baris ter-render.
    window.setTimeout(() => {
      try {
        document.getElementById(`new-col-name-${id}`)?.focus();
      } catch {
        /* jsdom / no-op */
      }
    }, 0);
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
        // Type kosong tidak valid di server (min(1)) — default TEXT,
        // sama seperti fallback exporter (ddl-export) agar selalu tersimpan.
        type: c.type.trim() !== '' ? c.type.trim() : 'TEXT',
        comment: c.comment.trim(),
        default: c.default?.trim() ? c.default.trim() : null,
      }));
    const id = newId();
    dispatch({
      type: 'table/add',
      table: {
        id,
        createdAt: ts,
        updatedAt: ts,
        name: trimmedName,
        comment: comment.trim(),
        color,
        columns: cleanedColumns,
        indexes,
      },
    });
    // U2: placement persist via antrean (dispatch saja — single pipeline
    // version-chained seperti whiteboard, tanpa PATCH samping).
    if (initialPosition !== undefined && initialPosition !== null && Number.isFinite(initialPosition.x) && Number.isFinite(initialPosition.y)) {
      const pos = {
        x: Math.round(initialPosition.x * 10) / 10,
        y: Math.round(initialPosition.y * 10) / 10,
      };
      dispatch({ type: 'erdLayout/set', tableId: id, pos });
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
          <Button variant="ghost" size="md" onClick={onClose}>
            {t('schema.newTableModal.cancel')}
          </Button>
          <Button type="submit" size="md" form="new-table-form" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} disabled={!name.trim()}>
            {t('schema.newTableModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-table-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('schema.newTableModal.nameLabel')}
          required
          autoFocus={autoFocusName}
          placeholder={t('schema.newTableModal.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={FE_LIMITS.TABLE_NAME}
          showCount
        />
        <div className="new-table-extra-fields">
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
                <span className="col-edit-caption-flags">{t('schema.table.detailCaptionFlags')}</span>
                <span>{t('schema.table.captionDefault')}</span>
                <span>{t('schema.table.captionComment')}</span>
                <span />
              </div>
              {columns.map((c) => (
                <div className="col-edit-row" key={c.id}>
                  <input
                    className="input"
                    id={`new-col-name-${c.id}`}
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
                  <ColumnFlagsToggle
                    value={{
                      nullable: c.nullable,
                      primaryKey: c.primaryKey,
                      unique: isUniqueIndex(indexesList, c.name),
                      autoincrement: c.autoincrement ?? false,
                      indexed: isPlainIndex(indexesList, c.name),
                    }}
                    onChange={(next) => {
                      const wasUnique = isUniqueIndex(indexesList, c.name);
                      if (next.unique !== wasUnique) toggleUniqueFor(c.name);
                      const wasIndexed = isPlainIndex(indexesList, c.name);
                      if ((next.indexed ?? false) !== wasIndexed) togglePlainIndexFor(c.name);
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
                    variant="ghost"
                    size="sm"
                    className="btn-icon"
                    aria-label={t('schema.table.deleteColAria', { name: c.name || t('schema.table.fbUnnamed') })}
                    onClick={() => removeColumn(c.id)}
                  >
                    <Trash size={13} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" leftIcon={<Plus size={14} aria-hidden="true" />} onClick={addColumn}>
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
            <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
              {indexes.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {indexes.map((idx) => (
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
              ) : (
                <p className="field-helper" style={{ margin: 0 }}>{t('schema.table.indexesToggleHint')}</p>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
