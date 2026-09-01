import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { OnDelete, RelationCardinality } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Plus } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';
import { SearchableSelect } from '../../components/SearchableSelect';

interface NewRelationModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewRelationModal({ open, onClose }: NewRelationModalProps) {
  const { t } = useTranslation('project');
  const { state, dispatch } = useProject();
  usePresenceStatus('Creating relation', open);
  const [fromTableId, setFromTableId] = useState('');
  const [fromColumnId, setFromColumnId] = useState('');
  const [toTableId, setToTableId] = useState('');
  const [toColumnId, setToColumnId] = useState('');
  const [cardinality, setCardinality] = useState<RelationCardinality>('1:N');
  const [onDelete, setOnDelete] = useState<OnDelete>('cascade');

  const fromTable = state?.tables.find((t) => t.id === fromTableId);
  const toTable = state?.tables.find((t) => t.id === toTableId);
  const invalid = !fromTableId || !fromColumnId || !toTableId || !toColumnId || fromTableId === toTableId;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!state || invalid) return;
    const ts = nowIso();
    dispatch({
      type: 'relation/add',
      relation: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        fromTableId,
        fromColumnId,
        toTableId,
        toColumnId,
        cardinality,
        onDelete,
      },
    });
    setFromTableId('');
    setFromColumnId('');
    setToTableId('');
    setToColumnId('');
    setCardinality('1:N');
    setOnDelete('cascade');
    onClose();
  }

  const fromColumns = fromTable?.columns ?? [];
  const toColumns = toTable?.columns ?? [];

  return (
    <Modal
      open={open}
      title={t('schema.relationModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('schema.relationModal.cancel')}
          </Button>
          <Button type="submit" form="new-relation-form" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} disabled={invalid}>
            {t('schema.relationModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-relation-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <SearchableSelect
            id="rel-from-table"
            label={t('schema.relationModal.fromTableLabel')}
            value={fromTableId || null}
            options={(state?.tables ?? []).map((table) => ({ value: table.id, label: table.name }))}
            emptyLabel={t('schema.relationModal.selectTable')}
            onChange={(v) => {
              setFromTableId(v ?? '');
              setFromColumnId('');
            }}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="rel-from-column"
            label={t('schema.relationModal.fromColumnLabel')}
            value={fromColumnId || null}
            options={fromColumns.map((c) => ({ value: c.id, label: c.name || t('schema.table.fbUnnamed') }))}
            emptyLabel={t('schema.relationModal.selectColumn')}
            onChange={(v) => setFromColumnId(v ?? '')}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="rel-to-table"
            label={t('schema.relationModal.toTableLabel')}
            value={toTableId || null}
            options={(state?.tables ?? []).map((table) => ({ value: table.id, label: table.name }))}
            emptyLabel={t('schema.relationModal.selectTable')}
            onChange={(v) => {
              setToTableId(v ?? '');
              setToColumnId('');
            }}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="rel-to-column"
            label={t('schema.relationModal.toColumnLabel')}
            value={toColumnId || null}
            options={toColumns.map((c) => ({ value: c.id, label: c.name || t('schema.table.fbUnnamed') }))}
            emptyLabel={t('schema.relationModal.selectColumn')}
            onChange={(v) => setToColumnId(v ?? '')}
          />
        </div>
        {fromTableId === toTableId && fromTableId !== '' && (
          <InlineError>{t('schema.relationModal.differentTablesError')}</InlineError>
        )}
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="rel-cardinality">
              {t('schema.relationModal.cardinalityLabel')}
            </label>
            <select
              id="rel-cardinality"
              className="select"
              value={cardinality}
              onChange={(e) => setCardinality(e.target.value as RelationCardinality)}
            >
              <option value="1:1">1:1</option>
              <option value="1:N">1:N</option>
              <option value="N:M">N:M</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rel-on-delete">
              {t('schema.relationModal.onDeleteLabel')}
            </label>
            <select
              id="rel-on-delete"
              className="select"
              value={onDelete}
              onChange={(e) => setOnDelete(e.target.value as OnDelete)}
            >
              <option value="cascade">{t('schema.relationModal.optCascade')}</option>
              <option value="setNull">{t('schema.relationModal.optSetNull')}</option>
              <option value="restrict">{t('schema.relationModal.optRestrict')}</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
