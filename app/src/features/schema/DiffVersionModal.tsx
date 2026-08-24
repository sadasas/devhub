import { useMemo, useState } from 'react';
import { Minus, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { SchemaVersion } from '../../lib/types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { columnLabel, diffSnapshots } from './schema-diff';
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

  return (
    <Modal open={open} title={t('schema.diffModal.title')} onClose={onClose} width="lg" footer={<Button variant="ghost" onClick={onClose}>{t('schema.diffModal.close')}</Button>}>
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
              items={diff.relationsAdded.map((r) => t('schema.diffModal.itemRelation', { cardinality: r.cardinality, id: r.id.slice(0, 8) }))}
            />
          )}
          {diff.relationsRemoved.length > 0 && (
            <DiffSection
              title={t('schema.diffModal.relationsRemoved', { count: diff.relationsRemoved.length })}
              tone="removed"
              items={diff.relationsRemoved.map((r) => t('schema.diffModal.itemRelation', { cardinality: r.cardinality, id: r.id.slice(0, 8) }))}
            />
          )}
          {diff.tablesAdded.length === 0 &&
            diff.tablesRemoved.length === 0 &&
            diff.columnsAdded.length === 0 &&
            diff.columnsRemoved.length === 0 &&
            diff.relationsAdded.length === 0 &&
            diff.relationsRemoved.length === 0 && (
              <p className="diff-empty">{t('schema.diffModal.noDifferences')}</p>
            )}
        </div>
      )}
    </Modal>
  );
}

function DiffSection({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'added' | 'removed';
  items: string[];
}) {
  return (
    <section className="diff-section">
      <h4 className="diff-section-title">
        <span className={`diff-tone diff-tone-${tone}`} aria-hidden="true">
          {tone === 'added' ? <Plus size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
        </span>
        {title}
      </h4>
      <ul className="diff-section-list">
        {items.map((item) => (
          <li key={item} className={`diff-row diff-row-${tone}`}>
            <span className={`diff-tone diff-tone-${tone}`} aria-hidden="true">
              {tone === 'added' ? <Plus size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
            </span>
            <span className="font-mono">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}