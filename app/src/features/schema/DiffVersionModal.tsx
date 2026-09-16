import { useMemo, useState } from 'react';
import { Minus, PencilSimple, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { Relation, SchemaSnapshot, SchemaVersion } from '../../lib/types';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { columnLabel, diffSnapshots } from './schema-diff';
import { relationLabel } from '../../lib/utils';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';

interface DiffVersionModalProps {
  open: boolean;
  versions: SchemaVersion[];
  onClose: () => void;
}

export function DiffVersionModal({ open, versions, onClose }: DiffVersionModalProps) {
  const { t } = useTranslation('project');
  const snapshots = versions.filter((v) => v.snapshot);
  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)),
    [snapshots],
  );
  const versionLabel = (v: SchemaVersion): string =>
    t('schema.diffModal.versionLabel', { version: v.version, notes: v.notes || t('schema.noNotes') });
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  usePresenceStatus('Viewing schema diff', open);

  const from = sorted.find((v) => v.id === fromId) ?? sorted[1] ?? sorted[0];
  const to = sorted.find((v) => v.id === toId) ?? sorted[0];
  const diff = useMemo(
    () => diffSnapshots(from?.snapshot ?? undefined, to?.snapshot ?? undefined),
    [from, to],
  );
  const empty = !from || !to || from.id === to.id;
  const humanRelation = (r: Relation, snap: SchemaSnapshot | null | undefined): string =>
    t('schema.diffModal.itemRelationHuman', {
      label: relationDisplayLabel(r, snap),
      cardinality: r.cardinality,
      onDelete: r.onDelete,
    });

  return (
    <Modal open={open} title={t('schema.diffModal.title')} onClose={onClose} width="lg">
      <div className="diff-selects">
        <div className="field">
          <SearchableSelect
            id="diff-from"
            label={t('schema.diffModal.fromLabel')}
            allowEmpty={false}
            placeholder={t('schema.diffModal.selectPlaceholder')}
            value={from?.id ?? null}
            options={sorted.map((v) => ({ value: v.id, label: versionLabel(v) }))}
            onChange={(v) => setFromId(v ?? '')}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="diff-to"
            label={t('schema.diffModal.toLabel')}
            allowEmpty={false}
            placeholder={t('schema.diffModal.selectPlaceholder')}
            value={to?.id ?? null}
            options={sorted.map((v) => ({ value: v.id, label: versionLabel(v) }))}
            onChange={(v) => setToId(v ?? '')}
          />
        </div>
      </div>

      <div className="modal-copy" role="status">
        {empty ? t('schema.diffModal.pickTwo') : t('schema.diffModal.showingChanges', { from: from.version, to: to.version })}
      </div>

      {!empty && (
        <div className="diff-list">
          {diff.tablesAdded.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.tablesAdded', { count: diff.tablesAdded.length })}
              tone="added"
              items={diff.tablesAdded.map((tb) => t('schema.diffModal.itemWithColumns', { name: tb.name, count: tb.columns.length }))}
            />
          )}
          {diff.tablesRemoved.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.tablesRemoved', { count: diff.tablesRemoved.length })}
              tone="removed"
              items={diff.tablesRemoved.map((tb) => tb.name)}
            />
          )}
          {diff.columnsAdded.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.columnsAdded', { count: diff.columnsAdded.length })}
              tone="added"
              items={diff.columnsAdded.map((c) => `${c.tableName}.${columnLabel(c.column)}`)}
            />
          )}
          {diff.columnsRemoved.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.columnsRemoved', { count: diff.columnsRemoved.length })}
              tone="removed"
              items={diff.columnsRemoved.map((c) => `${c.tableName}.${columnLabel(c.column)}`)}
            />
          )}
          {diff.relationsAdded.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.relationsAdded', { count: diff.relationsAdded.length })}
              tone="added"
              items={diff.relationsAdded.map((r) => humanRelation(r, to?.snapshot))}
            />
          )}
          {diff.relationsRemoved.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.relationsRemoved', { count: diff.relationsRemoved.length })}
              tone="removed"
              items={diff.relationsRemoved.map((r) => humanRelation(r, from?.snapshot))}
            />
          )}
          {diff.tablesModified.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.tablesModified', { count: diff.tablesModified.length })}
              tone="modified"
              items={diff.tablesModified.map((m) => ({ label: m.table.name, details: m.changes }))}
            />
          )}
          {diff.columnsModified.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.columnsModified', { count: diff.columnsModified.length })}
              tone="modified"
              items={diff.columnsModified.map((m) => ({
                label: `${m.tableName}.${columnLabel(m.column)}`,
                details: m.changes,
              }))}
            />
          )}
          {diff.relationsChanged.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.relationsChanged', { count: diff.relationsChanged.length })}
              tone="modified"
              items={diff.relationsChanged.map((m) => ({
                label: humanRelation(m.relation, to?.snapshot),
                details: m.changes,
              }))}
            />
          )}
          {diff.tablesAdded.length === 0 &&
            diff.tablesRemoved.length === 0 &&
            diff.columnsAdded.length === 0 &&
            diff.columnsRemoved.length === 0 &&
            diff.relationsAdded.length === 0 &&
            diff.relationsRemoved.length === 0 &&
            diff.tablesModified.length === 0 &&
            diff.columnsModified.length === 0 &&
            diff.relationsChanged.length === 0 && (
              <p className="diff-empty">{t('schema.diffModal.noDifferences')}</p>
            )}
        </div>
      )}
    </Modal>
  );
}

type DiffItem = string | { label: string; details?: string[] };

type DiffTone = 'added' | 'removed' | 'modified';

function DiffSection({
  title,
  tone,
  items,
}: {
  title: string;
  tone: DiffTone;
  items: DiffItem[];
}) {
  const ToneIcon = tone === 'added' ? Plus : tone === 'removed' ? Minus : PencilSimple;
  return (
    <section className="diff-section">
      <h4 className="diff-section-title">
        <span className={`diff-tone diff-tone-${tone}`} aria-hidden="true">
          <ToneIcon size={12} weight="bold" />
        </span>
        {title}
      </h4>
      <ul className="diff-section-list">
        {items.map((entry, idx) => {
          const label = typeof entry === 'string' ? entry : entry.label;
          const details = typeof entry === 'string' ? undefined : entry.details;
          if (!details || details.length === 0) {
            return (
              <li key={`${label}::${idx}`} className={`diff-row diff-row-${tone}`}>
                <span className={`diff-tone diff-tone-${tone}`} aria-hidden="true">
                  <ToneIcon size={12} weight="bold" />
                </span>
                <span className="font-mono">{label}</span>
              </li>
            );
          }
          return (
            <li key={`${label}::${idx}`} className={`diff-row diff-row-${tone} diff-row-stacked`}>
              <span className="diff-row-head">
                <span className={`diff-tone diff-tone-${tone}`} aria-hidden="true">
                  <ToneIcon size={12} weight="bold" />
                </span>
                <span className="font-mono">{label}</span>
              </span>
              <ul className="diff-changes">
                {details.map((change) => (
                  <li key={change} className="font-mono diff-change">
                    {change}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Resolve a human-readable `table.column → table.column` label for a relation
 * from the compared snapshot (never live state). Falls back to the
 * 8-char id prefix only when the table/column is missing in that snapshot
 * (e.g. dropped on that side of the comparison).
 */
function relationDisplayLabel(r: Relation, snap: SchemaSnapshot | null | undefined): string {
  const tables = snap?.tables ?? [];
  const fromTable = tables.find((tb) => tb.id === r.fromTableId);
  const toTable = tables.find((tb) => tb.id === r.toTableId);
  const fromColumn = fromTable?.columns?.find((c) => c.id === r.fromColumnId);
  const toColumn = toTable?.columns?.find((c) => c.id === r.toColumnId);
  return relationLabel(
    fromTable?.name ?? r.fromTableId.slice(0, 8),
    fromColumn?.name ?? r.fromColumnId.slice(0, 8),
    toTable?.name ?? r.toTableId.slice(0, 8),
    toColumn?.name ?? r.toColumnId.slice(0, 8),
  );
}