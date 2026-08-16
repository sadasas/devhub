import { useState } from 'react';
import type { FormEvent } from 'react';
import { newId, nowIso } from '../../lib/utils';
import type { OnDelete, RelationCardinality } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';
import { SearchableSelect } from '../../components/SearchableSelect';

interface NewRelationModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewRelationModal({ open, onClose }: NewRelationModalProps) {
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
      title="New relation"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-relation-form" disabled={invalid}>
            Add relation
          </Button>
        </>
      }
    >
      <form id="new-relation-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <SearchableSelect
            id="rel-from-table"
            label="From table"
            value={fromTableId || null}
            options={(state?.tables ?? []).map((t) => ({ value: t.id, label: t.name }))}
            emptyLabel="Select table"
            onChange={(v) => {
              setFromTableId(v ?? '');
              setFromColumnId('');
            }}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="rel-from-column"
            label="From column"
            value={fromColumnId || null}
            options={fromColumns.map((c) => ({ value: c.id, label: c.name || 'unnamed' }))}
            emptyLabel="Select column"
            onChange={(v) => setFromColumnId(v ?? '')}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="rel-to-table"
            label="To table"
            value={toTableId || null}
            options={(state?.tables ?? []).map((t) => ({ value: t.id, label: t.name }))}
            emptyLabel="Select table"
            onChange={(v) => {
              setToTableId(v ?? '');
              setToColumnId('');
            }}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="rel-to-column"
            label="To column"
            value={toColumnId || null}
            options={toColumns.map((c) => ({ value: c.id, label: c.name || 'unnamed' }))}
            emptyLabel="Select column"
            onChange={(v) => setToColumnId(v ?? '')}
          />
        </div>
        {fromTableId === toTableId && fromTableId !== '' && (
          <InlineError>From and to tables must be different.</InlineError>
        )}
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="rel-cardinality">
              Cardinality
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
              On delete
            </label>
            <select
              id="rel-on-delete"
              className="select"
              value={onDelete}
              onChange={(e) => setOnDelete(e.target.value as OnDelete)}
            >
              <option value="cascade">Cascade</option>
              <option value="setNull">Set null</option>
              <option value="restrict">Restrict</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
