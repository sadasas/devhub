import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Plus, Table, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import type { Column } from '../../lib/types';

interface NewTableModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTableModal({ open, onClose }: NewTableModalProps) {
  const { t } = useTranslation('project');
  const { dispatch } = useProject();
  usePresenceStatus(t('schema.newTableModal.presenceCreating'), open);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [indexesInput, setIndexesInput] = useState('');
  const [columns, setColumns] = useState<Column[]>(() => [
    { id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null },
  ]);

  useEffect(() => {
    if (open) {
      // reset draft saat modal dibuka — konsisten dengan NewIssueModal
      setName('');
      setComment('');
      setIndexesInput('');
      setColumns([{ id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '', default: null }]);
    }
  }, [open]);

  const updateColumn = (columnId: string, patch: Partial<Omit<Column, 'id'>>) => {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, ...patch } : c)));
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
    dispatch({
      type: 'table/add',
      table: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        comment: comment.trim(),
        columns: cleanedColumns,
        indexes,
      },
    });
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
          <Button type="submit" form="new-table-form" disabled={!name.trim()}>
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
          maxLength={128}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          {/* Comment — card bg-inset seperti IssueModal description */}
          <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} aria-hidden="true" /> {t('schema.newTableModal.commentLabel')}
            </div>
            <textarea
              className="textarea"
              rows={2}
              placeholder={t('schema.newTableModal.commentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={10000}
              aria-label={t('schema.newTableModal.commentLabel')}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: comment.length > 9000 ? 'var(--status-danger)' : comment.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {comment.length.toLocaleString()} / {(10000).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Columns — card bg-inset dengan grid editor */}
          <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Table size={12} aria-hidden="true" /> {t('schema.table.columnsLabel')}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>· {columns.filter((c) => c.name.trim()).length} {t('schema.table.columnsLabel').toLowerCase()}</span>
            </div>
            <div className="col-edit-grid">
              <div className="col-edit-caption" aria-hidden="true">
                <span>{t('schema.table.captionName')}</span>
                <span>{t('schema.table.captionType')}</span>
                <span className="col-edit-check">{t('schema.table.captionNull')}</span>
                <span className="col-edit-check">{t('schema.table.captionPk')}</span>
                <span>{t('schema.table.captionDefault')}</span>
                <span />
              </div>
              {columns.map((c) => (
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
            </div>
            <Button variant="ghost" size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={addColumn}>
              {t('schema.table.addColumn')}
            </Button>
            <p className="field-helper" style={{ marginTop: 8 }}>
              {t('schema.table.noColumnsYetEdit')}
            </p>
          </div>

          {/* Indexes — inline row 110px label seperti Task/Issue meta row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
            <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, paddingTop: 8 }}>
              <Table size={12} aria-hidden="true" /> {t('schema.table.indexesLabel')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                className="input"
                placeholder={t('schema.table.indexesPlaceholder')}
                value={indexesInput}
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
                  <span key={idx} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
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
