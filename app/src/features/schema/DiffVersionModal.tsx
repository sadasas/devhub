import { useMemo, useState } from 'react';
import { Minus, Plus } from '@phosphor-icons/react';
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

const versionLabel = (v: SchemaVersion): string => `${v.version} — ${v.notes || 'No notes.'}`;

export function DiffVersionModal({ open, versions, onClose }: DiffVersionModalProps) {
  const snapshots = versions.filter((v) => v.snapshot);
  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)),
    [snapshots],
  );
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
    <Modal open={open} title="Diff schema versions" onClose={onClose} width="lg">
      <div className="diff-selects">
        <div className="field">
          <SearchableSelect
            id="diff-from"
            label="From (older)"
            allowEmpty={false}
            placeholder="Select version"
            value={from?.id ?? null}
            options={sorted.map((v) => ({ value: v.id, label: versionLabel(v) }))}
            onChange={(v) => setFromId(v ?? '')}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="diff-to"
            label="To (newer)"
            allowEmpty={false}
            placeholder="Select version"
            value={to?.id ?? null}
            options={sorted.map((v) => ({ value: v.id, label: versionLabel(v) }))}
            onChange={(v) => setToId(v ?? '')}
          />
        </div>
      </div>

      <div className="modal-copy" role="status">
        {empty ? 'Pick two different versions to compare.' : `Showing changes from ${from.version} to ${to.version}.`}
      </div>

      {!empty && (
        <div className="diff-list">
          {diff.tablesAdded.length > 0 && (
            <DiffSection
              title={`Tables added (${diff.tablesAdded.length})`}
              tone="added"
              items={diff.tablesAdded.map((t) => `${t.name} (${t.columns.length} columns)`)}
            />
          )}
          {diff.tablesRemoved.length > 0 && (
            <DiffSection
              title={`Tables removed (${diff.tablesRemoved.length})`}
              tone="removed"
              items={diff.tablesRemoved.map((t) => t.name)}
            />
          )}
          {diff.columnsAdded.length > 0 && (
            <DiffSection
              title={`Columns added (${diff.columnsAdded.length})`}
              tone="added"
              items={diff.columnsAdded.map((c) => `${c.tableName}.${columnLabel(c.column)}`)}
            />
          )}
          {diff.columnsRemoved.length > 0 && (
            <DiffSection
              title={`Columns removed (${diff.columnsRemoved.length})`}
              tone="removed"
              items={diff.columnsRemoved.map((c) => `${c.tableName}.${columnLabel(c.column)}`)}
            />
          )}
          {diff.relationsAdded.length > 0 && (
            <DiffSection
              title={`Relations added (${diff.relationsAdded.length})`}
              tone="added"
              items={diff.relationsAdded.map((r) => `${r.cardinality} relation ${r.id.slice(0, 8)}`)}
            />
          )}
          {diff.relationsRemoved.length > 0 && (
            <DiffSection
              title={`Relations removed (${diff.relationsRemoved.length})`}
              tone="removed"
              items={diff.relationsRemoved.map((r) => `${r.cardinality} relation ${r.id.slice(0, 8)}`)}
            />
          )}
          {diff.tablesAdded.length === 0 &&
            diff.tablesRemoved.length === 0 &&
            diff.columnsAdded.length === 0 &&
            diff.columnsRemoved.length === 0 &&
            diff.relationsAdded.length === 0 &&
            diff.relationsRemoved.length === 0 && (
              <p className="diff-empty">No differences between these versions.</p>
            )}
        </div>
      )}

      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
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