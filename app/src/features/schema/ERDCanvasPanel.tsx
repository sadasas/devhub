import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowsOutSimple, CaretDown, Copy, DownloadSimple, Eye, FloppyDisk, GitDiff, Plus, Trash, Warning } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, newId, relationLabel, shortId } from '../../lib/utils';
import type { Column, ErdGroup, OnDelete, Relation, RelationCardinality, SchemaVersion, Table } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { FE_LIMITS } from '../../lib/limits';
import { canAutoincrement, isPlainIndex, isUniqueIndex, togglePlainIndex, toggleUnique } from './column-helpers';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SearchableSelect } from '../../components/SearchableSelect';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { ColumnTypeCombobox } from './ColumnTypeCombobox';
import { ColumnFlagsToggle } from './ColumnFlagsToggle';
import { EmptyState } from '../../components/EmptyState';
import { SchemaIssuesStrip } from './SchemaIssuesStrip';
import type { SchemaIssue } from './schema-lint';
import { TableColorPicker } from './TableColorPicker';
import { toDBML } from './dbml-export';
import { safeFileName, triggerDownload } from '../whiteboard/export';

export type ErdPanelTab = 'tables' | 'relations' | 'versions' | 'dbml' | 'areas';

export interface ERDCanvasPanelProps {
  /** Display table (live or snapshot). Null = no table selection. */
  table: Table | null;
  /** Display relation (live or snapshot). Null = no relation selection. */
  relation: Relation | null;
  /** Display tables for human-readable relation labels. */
  tables: Table[];
  /** True in snapshot viewing or viewer role — display only, no edits. */
  readOnly: boolean;
  /** Clear the panel selection (table + relation). Esc + close button funnel here. */
  onClose: () => void;
  /** Open the full table editor (SchemaPage setTableId). Omitted = hide edit entry-points (snapshot). */
  onOpenTable?: (tableId: string) => void;
  /** Open the existing relation delete confirmation (SchemaPage setConfirmRel). */
  onDeleteRelation: (relation: Relation) => void;
  /** U5: display issues (live or snapshot) — always rendered as bottom-most section. */
  issues: SchemaIssue[];
  /** U5: display relations for human-readable issue labels. */
  relations: Relation[];
  /** U5: snapshot viewing — hides Open actions in the issues list (Locate pans only). */
  isViewing: boolean;
  /** U5: Locate handler shared with the regular strip (ERD pan + 2s highlight). */
  onLocateIssue: (tableId: string) => void;
  /** U5: Open-table handler for issue rows (same as SchemaPage handleOpenTable). */
  onOpenIssueTable: (tableId: string) => void;
  /** U5: controlled open state shared with the toolbar pill badge. */
  issuesOpen: boolean;
  /** U5: toggle shared with the toolbar pill badge (badge reused, no duplicated logic). */
  onToggleIssues: () => void;
  /** Ronde 4 ITEM 6: Tables-tab selection — lift table selection + pan. */
  onSelectTable?: (id: string | null) => void;
  /** Ronde 4 ITEM 6: Tables-tab selection — lift relation selection + pan. */
  onSelectRelation?: (id: string | null) => void;
  /** U4: controlled rail tab (SchemaPage owns). Omitted = internal tables|relations fallback (legacy tests). */
  activeTab?: ErdPanelTab;
  /** U4: rail tab change (controlled). */
  onTabChange?: (tab: ErdPanelTab) => void;
  /** Tambah tabel/relasi/area dari header tab (mobile sheet; undefined = sembunyi). */
  onAddTable?: () => void;
  onAddRelation?: () => void;
  onAddArea?: () => void;
  /** Focus-request ke editor area baru dari toolbar (pola locateRequest: nonce naik). */
  groupFocusRequest?: { groupId: string; nonce: number } | null;
  /** U4: versions for the Versions tab (live state.schemaVersions, snapshot-safe display). */
  versions?: SchemaVersion[];
  /** U4: ?v= selection (SchemaPage selectedVersionId). */
  selectedVersionId?: string | null;
  /** U4: ?v= toggle (SchemaPage toggleVersion — snapshot-safe). */
  onToggleVersion?: (v: SchemaVersion) => void;
  /** U4: open SaveVersionModal (gated by canEditVersions). */
  onSaveVersion?: () => void;
  /** U4: open DiffVersionModal (>=2 snapshots). */
  onDiffVersions?: () => void;
  /** U4: gate Save entry-point (canEdit && !isViewing). */
  canEditVersions?: boolean;
  /** Unread version ids for the New pill (SchemaPage unreadIds). */
  unreadVersionIds?: ReadonlySet<string>;
  /** Versions load error -> EmptyState error variant. */
  versionsError?: string | null;
  /** DBML download filename base (SchemaPage projectName + versionLabel). */
  dbmlFileBase?: string;
}

/**
 * Ronde 5: tab Tables|Relations dengan detail inline expandable + U4 Versions + DBML.
 * Klik canvas (table/relation prop) auto-buka tab + expand yang sesuai
 * (tanpa mencuri fokus keyboard). Issues selalu paling bawah di semua tab.
 * U4: bila activeTab/onTabChange diberikan (rail terkontrol), panel memakai
 * controlled tab; bila tidak, fallback internal tables|relations (kompatibel lama).
 */
export function ERDCanvasPanel({
  table,
  relation,
  tables,
  readOnly,
  onClose,
  onOpenTable,
  onDeleteRelation,
  issues,
  relations,
  isViewing,
  onLocateIssue,
  onOpenIssueTable,
  issuesOpen,
  onToggleIssues,
  onSelectTable,
  onSelectRelation,
  activeTab: controlledTab,
  onTabChange,
  onAddTable,
  onAddRelation,
  onAddArea,
  groupFocusRequest = null,
  versions = [],
  selectedVersionId = null,
  onToggleVersion,
  onSaveVersion,
  onDiffVersions,
  canEditVersions = false,
  unreadVersionIds,
  versionsError = null,
  dbmlFileBase = 'schema',
}: ERDCanvasPanelProps) {
  const { t } = useTranslation('project');
  const { state, dispatch } = useProject();
  const [expandedColumnId, setExpandedColumnId] = useState<string | null>(null);
  const [confirmDeleteTableId, setConfirmDeleteTableId] = useState<string | null>(null);
  const [internalTab, setInternalTab] = useState<ErdPanelTab>('tables');
  const activeTab: ErdPanelTab = controlledTab ?? internalTab;
  const setActiveTab = (next: ErdPanelTab) => {
    if (controlledTab !== undefined && onTabChange) onTabChange(next);
    else setInternalTab(next);
  };
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);
  const [expandedRelationId, setExpandedRelationId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  // Focus-request editor area baru dari toolbar: buka tab + expand grupnya.
  useEffect(() => {
    if (!groupFocusRequest) return;
    setActiveTab('areas');
    setExpandedGroupId(groupFocusRequest.groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFocusRequest]);
  // Areas live dari state (snapshot versions hanya menyimpan tables+relations,
  // jadi seksi disembunyikan saat isViewing agar tidak bocor).
  const groups: ErdGroup[] = useMemo(() => state?.erdGroups ?? [], [state]);
  const [dbmlCopyStatus, setDbmlCopyStatus] = useState('');
  const tableItemRefs = useRef(new Map<string, HTMLLIElement | null>());
  const relationItemRefs = useRef(new Map<string, HTMLLIElement | null>());
  // U5: zero issues stays mounted auto-collapsed with "No issues" — honest in
  // the props panel vs disappearing. Local empty-state toggle (toolbar pill is
  // hidden when N=0); non-empty reuses the shared issuesOpen + toolbar badge.
  const isEmptyIssues = issues.length === 0;
  const [emptyIssuesOpen, setEmptyIssuesOpen] = useState(false);
  useEffect(() => {
    if (isEmptyIssues) setEmptyIssuesOpen(false);
  }, [isEmptyIssues]);
  const panelIssuesOpen = isEmptyIssues ? emptyIssuesOpen : issuesOpen;
  const handleToggleIssues = isEmptyIssues ? () => setEmptyIssuesOpen((v) => !v) : onToggleIssues;
  const issuesSection = (
    <SchemaIssuesStrip
      collapsible
      idPrefix="erd-panel-issues"
      issues={issues}
      tables={tables}
      relations={relations}
      isViewing={isViewing}
      onLocate={onLocateIssue}
      onOpenTable={onOpenIssueTable}
      open={panelIssuesOpen}
      onToggle={handleToggleIssues}
    />
  );

  // Ronde 5 ITEM 2: klik canvas → fokus tab + auto-buka inline.
  useEffect(() => {
    if (table?.id) {
      setActiveTab('tables');
      setExpandedTableId(table.id);
    } else {
      setExpandedTableId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.id]);

  useEffect(() => {
    if (relation?.id) {
      setActiveTab('relations');
      setExpandedRelationId(relation.id);
    } else {
      setExpandedRelationId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relation?.id]);

  // Reset per-table UI saat expanded pindah (pengganti efek table→null lama).
  useEffect(() => {
    setExpandedColumnId(null);
    setConfirmDeleteTableId(null);
  }, [expandedTableId]);

  // Item aktif scroll ke terlihat tanpa mencuri fokus keyboard.
  useEffect(() => {
    if (!expandedTableId || activeTab !== 'tables') return;
    const el = tableItemRefs.current.get(expandedTableId);
    try {
      el?.scrollIntoView?.({ block: 'nearest' });
    } catch {
      /* jsdom / no-op */
    }
  }, [expandedTableId, activeTab]);

  useEffect(() => {
    if (!expandedRelationId || activeTab !== 'relations') return;
    const el = relationItemRefs.current.get(expandedRelationId);
    try {
      el?.scrollIntoView?.({ block: 'nearest' });
    } catch {
      /* jsdom / no-op */
    }
  }, [expandedRelationId, activeTab]);

  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // Modals handle their own Esc — bail out so the delete confirm stays open.
    if (document.querySelector('.modal-backdrop')) return;
    e.stopPropagation();
    e.preventDefault();
    onClose();
  };

  const handleSelectTableItem = (tableId: string) => {
    if (expandedTableId === tableId) {
      onSelectTable?.(null);
      return;
    }
    onSelectTable?.(tableId);
    onSelectRelation?.(null);
    onLocateIssue(tableId);
  };

  const handleSelectRelationItem = (rel: Relation) => {
    if (expandedRelationId === rel.id) {
      onSelectRelation?.(null);
      return;
    }
    onSelectRelation?.(rel.id);
    onSelectTable?.(null);
    onLocateIssue(rel.fromTableId);
  };

  const renderTableDetail = (tbl: Table) => {
    const canEdit = !readOnly;
    const updateTable = (patch: Partial<Pick<Table, 'name' | 'comment' | 'color' | 'columns' | 'indexes'>>) => {
      dispatch({ type: 'table/update', id: tbl.id, patch });
    };
    const updateColumn = (columnId: string, patch: Partial<Omit<Column, 'id'>>) => {
      updateTable({ columns: tbl.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)) });
    };
    const addColumn = () => {
      const id = newId();
      updateTable({
        columns: [
          ...tbl.columns,
          { id, name: '', type: '', nullable: true, primaryKey: false, comment: '' },
        ],
      });
      // Kolom baru langsung terbuka + fokus input nama agar bisa langsung diketik.
      setExpandedColumnId(id);
      window.setTimeout(() => {
        try {
          document.getElementById(`erd-panel-col-name-${id}`)?.focus();
        } catch {
          /* jsdom / no-op */
        }
      }, 0);
    };
    const removeColumn = (columnId: string) => {
      updateTable({ columns: tbl.columns.filter((c) => c.id !== columnId) });
      // Cascade like TableModal — a column drop removes its relations.
      (state?.relations ?? [])
        .filter((r) => r.fromColumnId === columnId || r.toColumnId === columnId)
        .forEach((r) => dispatch({ type: 'relation/remove', id: r.id }));
      if (expandedColumnId === columnId) setExpandedColumnId(null);
    };
    const handleDeleteTable = () => {
      dispatch({ type: 'table/remove', id: tbl.id });
      setConfirmDeleteTableId(null);
      onClose();
    };

    return (
      <>
        <div className="erd-panel-head">
          <h2 className="erd-panel-title" title={tbl.name}>
            {t('schema.panel.tableTitle', {
              name: tbl.name.trim() !== '' ? tbl.name : t('schema.table.unnamedTable'),
            })}
          </h2>
        </div>

        <div className="erd-panel-section">
          <div className="field">
            <label className="field-label" htmlFor="erd-panel-table-name">
              {t('schema.panel.nameLabel')}
            </label>
            {canEdit ? (
              <input
                id="erd-panel-table-name"
                className="input"
                value={tbl.name}
                maxLength={FE_LIMITS.TABLE_NAME}
                placeholder={t('schema.newTableModal.namePlaceholder')}
                onChange={(e) => updateTable({ name: e.target.value })}
              />
            ) : (
              <span className="erd-panel-read">{tbl.name || t('schema.table.unnamedTable')}</span>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="erd-panel-table-comment">
              {t('schema.panel.commentLabel')}
            </label>
            {canEdit ? (
              <textarea
                id="erd-panel-table-comment"
                className="textarea"
                value={tbl.comment}
                rows={2}
                maxLength={FE_LIMITS.TABLE_COMMENT}
                placeholder={t('schema.newTableModal.commentPlaceholder')}
                onChange={(e) => updateTable({ comment: e.target.value })}
              />
            ) : (
              <span className="erd-panel-read">{tbl.comment.trim() !== '' ? tbl.comment : t('schema.noComment')}</span>
            )}
          </div>
          {/* U6: header color picker — panel inline, gate canEdit, readOnly display-only via disabled */}
          <TableColorPicker
            id={`erd-panel-color-${tbl.id}`}
            value={(tbl as Table).color ?? null}
            onChange={(next) => updateTable({ color: next })}
            disabled={!canEdit}
          />
        </div>

        <div className="erd-panel-section">
          <div className="erd-panel-row">
            <h3 className="erd-panel-subtitle">
              {t('schema.panel.columnsLabel')} <span className="erd-panel-count">· {tbl.columns.length}</span>
            </h3>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="erd-panel-icon-btn"
                leftIcon={<Plus size={14} aria-hidden="true" />}
                onClick={addColumn}
                aria-label={t('schema.panel.addColumn')}
                title={t('schema.panel.addColumn')}
              >
                <span className="sr-only">{t('schema.panel.addColumn')}</span>
              </Button>
            )}
          </div>
          {tbl.columns.length === 0 ? (
            <p className="field-helper">{t('schema.table.noColumnsYetEdit')}</p>
          ) : (
            <ul className="erd-panel-cols">
              {tbl.columns.map((col) => {
                const expanded = expandedColumnId === col.id;
                const unique = isUniqueIndex(tbl.indexes, col.name);
                const colDisplay = col.name.trim() !== '' ? col.name : t('schema.table.unnamedColumn');
                return (
                  <li key={col.id} className="erd-panel-col">
                    <div className="erd-panel-col-head">
                      <button
                        type="button"
                        className="erd-panel-col-toggle"
                        aria-expanded={expanded}
                        aria-label={t(expanded ? 'schema.panel.collapseColumnAria' : 'schema.panel.expandColumnAria', {
                          name: colDisplay,
                        })}
                        onClick={() => setExpandedColumnId(expanded ? null : col.id)}
                      >
                        <span className="erd-panel-col-name font-mono" title={col.name}>
                          {col.name.trim() !== '' ? col.name : t('schema.table.unnamedColumn')}
                        </span>
                        <span className="erd-panel-col-type font-mono" title={col.type}>
                          {col.type.trim() !== '' ? col.type : '—'}
                        </span>
                        {col.primaryKey && <Badge tone="accent">PK</Badge>}
                        {col.nullable && <Badge>NULL</Badge>}
                        {unique && <Badge>U</Badge>}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="erd-panel-x"
                          aria-label={t('schema.panel.deleteColumnAria', { name: colDisplay })}
                          title={t('schema.panel.deleteColumnAria', { name: colDisplay })}
                          onClick={() => removeColumn(col.id)}
                        >
                          <Trash size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {expanded && (
                      <div className="erd-panel-col-editor">
                        <div className="field">
                          <label className="field-label" htmlFor={`erd-panel-col-name-${col.id}`}>
                            {t('schema.panel.nameLabel')}
                          </label>
                          {canEdit ? (
                            <input
                              id={`erd-panel-col-name-${col.id}`}
                              className="input"
                              value={col.name}
                              maxLength={FE_LIMITS.COLUMN_NAME}
                              placeholder={t('schema.table.namePlaceholder')}
                              onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                            />
                          ) : (
                            <span className="erd-panel-read font-mono">{col.name || '—'}</span>
                          )}
                        </div>
                        <div className="field">
                          <span className="field-label" id={`erd-panel-col-type-label-${col.id}`}>
                            {t('schema.panel.typeLabel')}
                          </span>
                          {canEdit ? (
                            <ColumnTypeCombobox
                              id={`erd-panel-col-type-${col.id}`}
                              value={col.type}
                              onChange={(next) => updateColumn(col.id, { type: next })}
                              ariaLabel={t('schema.table.typeAria', {
                                name: col.name.trim() !== '' ? col.name : t('schema.table.fbColumn'),
                              })}
                              customAriaLabel={t('schema.table.typeCustomAria', {
                                name: col.name.trim() !== '' ? col.name : t('schema.table.fbColumn'),
                              })}
                            />
                          ) : (
                            <span
                              className="erd-panel-read font-mono"
                              role="text"
                              aria-labelledby={`erd-panel-col-type-label-${col.id}`}
                            >
                              {col.type.trim() !== '' ? col.type : '—'}
                            </span>
                          )}
                        </div>
                        <div className="erd-panel-checks">
                          <ColumnFlagsToggle
                            value={{
                              nullable: col.nullable,
                              primaryKey: col.primaryKey,
                              unique,
                              autoincrement: col.autoincrement ?? false,
                              indexed: isPlainIndex(tbl.indexes, col.name),
                            }}
                            onChange={(next) => {
                              if (next.unique !== unique) {
                                updateTable({ indexes: toggleUnique(tbl.indexes, col.name) });
                              }
                              const wasIndexed = isPlainIndex(tbl.indexes, col.name);
                              if ((next.indexed ?? false) !== wasIndexed) {
                                updateTable({ indexes: togglePlainIndex(tbl.indexes, col.name) });
                              }
                              const patch: Partial<Pick<Column, 'nullable' | 'primaryKey' | 'autoincrement'>> = {};
                              if (next.nullable !== col.nullable || next.primaryKey !== col.primaryKey) {
                                patch.nullable = next.nullable;
                                patch.primaryKey = next.primaryKey;
                              }
                              if ((next.autoincrement ?? false) !== (col.autoincrement ?? false)) {
                                patch.autoincrement = next.autoincrement ?? false;
                              }
                              if (Object.keys(patch).length > 0) updateColumn(col.id, patch);
                            }}
                            disabled={!canEdit}
                            uniqueDisabled={col.name.trim() === ''}
                            uniqueDisabledTitle={t('schema.table.uniqueDisabledTitle')}
                            autoDisabled={!canAutoincrement(col.type)}
                            autoDisabledTitle={t('schema.table.autoDisabledTitle')}
                            indexedDisabled={col.name.trim() === ''}
                            indexedDisabledTitle={t('schema.table.indexedDisabledTitle')}
                            nullableLabel={`${t('schema.panel.nullableLabel')} — ${colDisplay}`}
                            primaryLabel={`${t('schema.panel.pkLabel')} — ${colDisplay}`}
                            uniqueLabel={`${t('schema.panel.uniqueLabel')} — ${colDisplay}`}
                            autoLabel={`${t('schema.table.autoAria', {
                              name: col.name.trim() !== '' ? col.name : t('schema.table.fbUnnamed'),
                            })}`}
                            indexedLabel={`${t('schema.table.indexedAria', {
                              name: col.name.trim() !== '' ? col.name : t('schema.table.fbUnnamed'),
                            })}`}
                          />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor={`erd-panel-col-default-${col.id}`}>
                            {t('schema.panel.defaultLabel')}
                          </label>
                          {canEdit ? (
                            <input
                              id={`erd-panel-col-default-${col.id}`}
                              className="input font-mono"
                              value={col.default ?? ''}
                              maxLength={FE_LIMITS.COLUMN_DEFAULT}
                              placeholder={t('schema.table.defaultPlaceholder')}
                              onChange={(e) => updateColumn(col.id, { default: e.target.value || null })}
                            />
                          ) : (
                            <span className="erd-panel-read font-mono">{col.default ?? '—'}</span>
                          )}
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor={`erd-panel-col-comment-${col.id}`}>
                            {t('schema.panel.commentLabel')}
                          </label>
                          {canEdit ? (
                            <input
                              id={`erd-panel-col-comment-${col.id}`}
                              className="input"
                              value={col.comment}
                              maxLength={FE_LIMITS.COLUMN_COMMENT}
                              onChange={(e) => updateColumn(col.id, { comment: e.target.value })}
                            />
                          ) : (
                            <span className="erd-panel-read">{col.comment.trim() !== '' ? col.comment : '—'}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="erd-panel-section">
          <h3 className="erd-panel-subtitle">{t('schema.panel.indexesLabel')}</h3>
          {tbl.indexes.length === 0 ? (
            <p className="field-helper">{t('schema.panel.noIndexes')}</p>
          ) : (
            <ul className="erd-panel-indexes">
              {tbl.indexes.map((idx) => (
                <li key={idx} className="erd-panel-index font-mono" title={idx}>
                  {idx}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="erd-panel-actions">
          {onOpenTable && (
            <Button
              variant="secondary"
              size="sm"
              className="erd-panel-icon-btn"
              leftIcon={<ArrowsOutSimple size={14} aria-hidden="true" />}
              onClick={() => onOpenTable(tbl.id)}
              aria-label={t('schema.panel.openFullEditor')}
              title={t('schema.panel.openFullEditor')}
            >
              <span className="sr-only">{t('schema.panel.openFullEditor')}</span>
            </Button>
          )}
          {canEdit && (
            <Button
              variant="danger"
              size="sm"
              className="erd-panel-icon-btn"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              onClick={() => setConfirmDeleteTableId(tbl.id)}
              aria-label={t('schema.panel.deleteTable')}
              title={t('schema.panel.deleteTable')}
            >
              <span className="sr-only">{t('schema.panel.deleteTable')}</span>
            </Button>
          )}
        </div>

        <ConfirmDeleteDialog
          open={confirmDeleteTableId === tbl.id}
          title={t('schema.table.deleteConfirmTitle')}
          description={t('schema.table.deleteConfirmBody')}
          onClose={() => setConfirmDeleteTableId(null)}
          onConfirm={handleDeleteTable}
        />
      </>
    );
  };

  const renderRelationDetail = (rel: Relation) => (
    <>
      <div className="erd-panel-head">
        <h2 className="erd-panel-title">{t('schema.panel.relationTitle')}</h2>
      </div>
      <p className="erd-panel-rel-label font-mono" title={relationLabelFor(rel, tables)}>
        {relationLabelFor(rel, tables)}
      </p>
      <div className="erd-panel-section">
        <div className="field">
          {readOnly ? (
            <>
              <label className="field-label" htmlFor="erd-panel-cardinality">
                {t('schema.panel.cardinalityLabel')}
              </label>
              <span className="erd-panel-read font-mono">{rel.cardinality}</span>
            </>
          ) : (
            <SearchableSelect
              id="erd-panel-cardinality"
              label={t('schema.panel.cardinalityLabel')}
              value={rel.cardinality}
              allowEmpty={false}
              searchable={false}
              options={(['1:1', '1:N', 'N:M'] as RelationCardinality[]).map((c) => ({ value: c, label: c }))}
              onChange={(v) => {
                if (v) dispatch({ type: 'relation/update', id: rel.id, patch: { cardinality: v as RelationCardinality } });
              }}
            />
          )}
        </div>
        <div className="field">
          {readOnly ? (
            <>
              <label className="field-label" htmlFor="erd-panel-on-delete">
                {t('schema.panel.onDeleteLabel')}
              </label>
              <span className="erd-panel-read font-mono">{rel.onDelete}</span>
            </>
          ) : (
            <SearchableSelect
              id="erd-panel-on-delete"
              label={t('schema.panel.onDeleteLabel')}
              value={rel.onDelete}
              allowEmpty={false}
              searchable={false}
              options={[
                { value: 'cascade', label: t('schema.relationModal.optCascade') },
                { value: 'setNull', label: t('schema.relationModal.optSetNull') },
                { value: 'restrict', label: t('schema.relationModal.optRestrict') },
              ]}
              onChange={(v) => {
                if (v) dispatch({ type: 'relation/update', id: rel.id, patch: { onDelete: v as OnDelete } });
              }}
            />
          )}
        </div>
      </div>
      {!readOnly && (
        <div className="erd-panel-actions">
          <Button
            variant="danger"
            size="sm"
            className="erd-panel-icon-btn"
            leftIcon={<Trash size={14} aria-hidden="true" />}
            onClick={() => onDeleteRelation(rel)}
            aria-label={t('schema.panel.deleteRelation')}
            title={t('schema.panel.deleteRelation')}
          >
            <span className="sr-only">{t('schema.panel.deleteRelation')}</span>
          </Button>
        </div>
      )}
    </>
  );

  const canEditAreas = !readOnly;

  const toggleGroupMember = (g: ErdGroup, tableId: string) => {
    const has = g.tableIds.includes(tableId);
    dispatch({
      type: 'area/update',
      id: g.id,
      patch: { tableIds: has ? g.tableIds.filter((t) => t !== tableId) : [...g.tableIds, tableId] },
    });
  };

  const renderGroupEditor = (g: ErdGroup) => (
    <>
      <div className="erd-panel-section">
        <div className="field">
          <label className="field-label" htmlFor={`erd-panel-group-name-${g.id}`}>
            {t('schema.panel.nameLabel')}
          </label>
          {canEditAreas ? (
            <input
              id={`erd-panel-group-name-${g.id}`}
              className="input"
              value={g.name}
              maxLength={FE_LIMITS.ERDGROUP_NAME}
              onChange={(e) => dispatch({ type: 'area/update', id: g.id, patch: { name: e.target.value } })}
            />
          ) : (
            <span className="erd-panel-read">{g.name}</span>
          )}
        </div>
        <TableColorPicker
          id={`erd-panel-group-color-${g.id}`}
          value={g.color ?? null}
          onChange={(next) => dispatch({ type: 'area/update', id: g.id, patch: { color: next } })}
          disabled={!canEditAreas}
          label={t('schema.areas.colorLabel')}
        />
      </div>
      <div className="erd-panel-section">
        <h3 className="erd-panel-subtitle">{t('schema.areas.membersLabel')}</h3>
        {(() => {
          const memberIds = new Set(g.tableIds);
          const members = tables.filter((tbl) => memberIds.has(tbl.id));
          const available = tables.filter((tbl) => !memberIds.has(tbl.id));
          return (
            <>
              {members.length > 0 && (
                <ul className="erd-panel-indexes">
                  {members.map((tbl) => {
                    const label = tbl.name.trim() !== '' ? tbl.name : t('schema.table.unnamedTable');
                    return (
                      <li key={tbl.id} className="erd-panel-index font-mono" title={tbl.name}>
                        <span className="erd-panel-index-text">{label}</span>
                        {canEditAreas && (
                          <button
                            type="button"
                            className="erd-panel-chip-x"
                            aria-label={t('schema.areas.removeMember', { name: label })}
                            title={t('schema.areas.removeMember', { name: label })}
                            onClick={() => toggleGroupMember(g, tbl.id)}
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canEditAreas && available.length > 0 && (
                <SearchableSelect
                  id={`erd-panel-group-add-${g.id}`}
                  value={null}
                  options={available.map((tbl) => ({
                    value: tbl.id,
                    label: tbl.name.trim() !== '' ? tbl.name : t('schema.table.unnamedTable'),
                  }))}
                  placeholder={t('schema.areas.addTable')}
                  triggerEmptyLabel={t('schema.areas.addTable')}
                  onChange={(v) => {
                    if (v) toggleGroupMember(g, v);
                  }}
                />
              )}
              {members.length === 0 && (!canEditAreas || available.length === 0) && (
                <p className="field-helper">{t('schema.areas.noTables')}</p>
              )}
            </>
          );
        })()}
      </div>
      {canEditAreas && (
        <div className="erd-panel-actions">
          <Button
            variant="danger"
            size="sm"
            className="erd-panel-icon-btn"
            leftIcon={<Trash size={14} aria-hidden="true" />}
            onClick={() => {
              dispatch({ type: 'area/remove', id: g.id });
              if (expandedGroupId === g.id) setExpandedGroupId(null);
            }}
            aria-label={t('schema.areas.delete')}
            title={t('schema.areas.delete')}
          >
            <span className="sr-only">{t('schema.areas.delete')}</span>
          </Button>
        </div>
      )}
    </>
  );

  const areasSection = (
    <div className="erd-panel-section">
      <div className="erd-panel-row">
        <h3 className="erd-panel-subtitle">
          {t('schema.areas.title')} <span className="erd-panel-count">· {groups.length}</span>
        </h3>
        {!readOnly && onAddArea && (
          <span className="erd-panel-actions" style={{ marginTop: 0, paddingTop: 0 }}>
            <Button
              variant="ghost"
              size="sm"
              className="erd-panel-icon-btn"
              leftIcon={<Plus size={14} aria-hidden="true" />}
              onClick={onAddArea}
              aria-label={t('schema.areas.new')}
              title={t('schema.areas.new')}
            >
              <span className="sr-only">{t('schema.areas.new')}</span>
            </Button>
          </span>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="field-helper">{t('schema.areas.empty')}</p>
      ) : (
        <ul className="erd-panel-tables-list">
          {groups.map((g) => {
            const expanded = expandedGroupId === g.id;
            const gName = g.name.trim() !== '' ? g.name : t('schema.areas.untitled');
            return (
              <li key={g.id}>
                <button
                  type="button"
                  className="erd-panel-tables-item"
                  aria-expanded={expanded}
                  aria-controls={`erd-panel-group-detail-${g.id}`}
                  onClick={() => setExpandedGroupId(expanded ? null : g.id)}
                >
                  <span
                    className="erd-panel-color-dot"
                    style={g.color ? { backgroundColor: g.color } : undefined}
                    aria-hidden="true"
                  />
                  <span className="erd-panel-tables-name font-mono" title={g.name}>
                    {gName}
                  </span>
                  <span className="erd-panel-count">{t('schema.areas.membersCount', { count: g.tableIds.length })}</span>
                  {g.w != null && g.h != null && (
                    <span className="erd-panel-count font-mono" title={`${Math.round(g.w)}×${Math.round(g.h)}`}>
                      · {Math.round(g.w)}×{Math.round(g.h)}
                    </span>
                  )}
                  <CaretDown
                    size={13}
                    aria-hidden="true"
                    className={`erd-panel-chevron${expanded ? ' erd-panel-chevron-open' : ''}`}
                  />
                </button>
                {expanded && (
                  <div id={`erd-panel-group-detail-${g.id}`} className="erd-panel-detail">
                    {renderGroupEditor(g)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const tablesTabPanel = (
    <div
      id="erd-panel-tabpanel-tables"
      role="tabpanel"
      aria-labelledby="erd-panel-tab-tables"
      hidden={activeTab !== 'tables'}
      className="erd-panel-tabpanel"
    >
      {activeTab === 'tables' && (
        <>
          <div className="erd-panel-row">
            <h3 className="erd-panel-subtitle">
              {t('schema.panel.tablesSection')} <span className="erd-panel-count">· {tables.length}</span>
            </h3>
            {!readOnly && onAddTable && (
              <span className="erd-panel-actions" style={{ marginTop: 0, paddingTop: 0 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="erd-panel-icon-btn"
                  leftIcon={<Plus size={14} aria-hidden="true" />}
                  onClick={onAddTable}
                  aria-label={t('schema.page.newTable')}
                  title={t('schema.page.newTable')}
                >
                  <span className="sr-only">{t('schema.page.newTable')}</span>
                </Button>
              </span>
            )}
          </div>
          {tables.length === 0 ? (
          <p className="field-helper">{t('schema.panel.noTables')}</p>
        ) : (
          <ul className="erd-panel-tables-list">
            {tables.map((tbl) => {
              const expanded = expandedTableId === tbl.id;
              return (
                <li
                  key={tbl.id}
                  ref={(el) => {
                    if (el) tableItemRefs.current.set(tbl.id, el);
                    else tableItemRefs.current.delete(tbl.id);
                  }}
                >
                  <button
                    type="button"
                    className="erd-panel-tables-item"
                    aria-expanded={expanded}
                    aria-controls={`erd-panel-table-detail-${tbl.id}`}
                    aria-current={expanded ? ('true' as const) : undefined}
                    onClick={() => handleSelectTableItem(tbl.id)}
                  >
                    <span className="erd-panel-tables-name font-mono" title={tbl.name}>
                      {tbl.name.trim() !== '' ? tbl.name : t('schema.table.unnamedTable')}
                    </span>
                    <span className="erd-panel-count">
                      {t('schema.panel.columnsCount', { count: tbl.columns.length })}
                    </span>
                    <CaretDown
                      size={13}
                      aria-hidden="true"
                      className={`erd-panel-chevron${expanded ? ' erd-panel-chevron-open' : ''}`}
                    />
                  </button>
                  {expanded && (
                    <div id={`erd-panel-table-detail-${tbl.id}`} className="erd-panel-detail">
                      {renderTableDetail(tbl)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          )}
        </>
      )}
    </div>
  );

  const relationsTabPanel = (
    <div
      id="erd-panel-tabpanel-relations"
      role="tabpanel"
      aria-labelledby="erd-panel-tab-relations"
      hidden={activeTab !== 'relations'}
      className="erd-panel-tabpanel"
    >
      {activeTab === 'relations' && (
        <>
          <div className="erd-panel-row">
            <h3 className="erd-panel-subtitle">
              {t('schema.panel.relationsSection')} <span className="erd-panel-count">· {relations.length}</span>
            </h3>
            {!readOnly && onAddRelation && (
              <span className="erd-panel-actions" style={{ marginTop: 0, paddingTop: 0 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="erd-panel-icon-btn"
                  leftIcon={<Plus size={14} aria-hidden="true" />}
                  onClick={onAddRelation}
                  aria-label={t('schema.page.newRelation')}
                  title={t('schema.page.newRelation')}
                >
                  <span className="sr-only">{t('schema.page.newRelation')}</span>
                </Button>
              </span>
            )}
          </div>
          {relations.length === 0 ? (
          <p className="field-helper">{t('schema.panel.noRelations')}</p>
        ) : (
          <ul className="erd-panel-tables-list">
            {relations.map((rel) => {
              const expanded = expandedRelationId === rel.id;
              return (
                <li
                  key={rel.id}
                  ref={(el) => {
                    if (el) relationItemRefs.current.set(rel.id, el);
                    else relationItemRefs.current.delete(rel.id);
                  }}
                >
                  <button
                    type="button"
                    className="erd-panel-tables-item"
                    aria-expanded={expanded}
                    aria-controls={`erd-panel-relation-detail-${rel.id}`}
                    aria-current={expanded ? ('true' as const) : undefined}
                    onClick={() => handleSelectRelationItem(rel)}
                  >
                    <span
                      className="erd-panel-tables-name font-mono"
                      title={relationLabelFor(rel, tables)}
                    >
                      {relationLabelFor(rel, tables)}
                    </span>
                    <span className="erd-panel-count font-mono">{rel.cardinality}</span>
                    <CaretDown
                      size={13}
                      aria-hidden="true"
                      className={`erd-panel-chevron${expanded ? ' erd-panel-chevron-open' : ''}`}
                    />
                  </button>
                  {expanded && (
                    <div id={`erd-panel-relation-detail-${rel.id}`} className="erd-panel-detail">
                      {renderRelationDetail(rel)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          )}
        </>
      )}
    </div>
  );

  const areasTabPanel = (
    <div
      id="erd-panel-tabpanel-areas"
      role="tabpanel"
      aria-labelledby="erd-panel-tab-areas"
      hidden={activeTab !== 'areas'}
      className="erd-panel-tabpanel"
    >
      {activeTab === 'areas' &&
        (isViewing ? (
          <p className="field-helper">{t('schema.areas.snapshotHidden')}</p>
        ) : (
          areasSection
        ))}
    </div>
  );

  // U4: Versions tab — pindah dari sidebar SchemaPage (reuse row UI + Save/Diff/?v= via props).
  const versionsWithSnap = versions.filter((v) => v.snapshot);
  const versionsTabPanel = (
    <div
      id="erd-panel-tabpanel-versions"
      role="tabpanel"
      aria-labelledby="erd-panel-tab-versions"
      hidden={activeTab !== 'versions'}
      className="erd-panel-tabpanel"
    >
      {activeTab === 'versions' && (
        <>
          <div className="erd-panel-row">
            <h3 className="erd-panel-subtitle">
              {t('schema.versionsHeading')} <span className="erd-panel-count">· {versions.length}</span>
            </h3>
            <span className="erd-panel-actions" style={{ marginTop: 0, paddingTop: 0 }}>
              {versionsWithSnap.length >= 2 && onDiffVersions && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="erd-panel-icon-btn"
                  leftIcon={<GitDiff size={14} aria-hidden="true" />}
                  onClick={onDiffVersions}
                  aria-label={t('schema.diffVersions')}
                  title={t('schema.diffVersions')}
                >
                  <span className="sr-only">{t('schema.diffVersions')}</span>
                </Button>
              )}
              {canEditVersions && onSaveVersion && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="erd-panel-icon-btn"
                  leftIcon={<FloppyDisk size={14} aria-hidden="true" />}
                  onClick={onSaveVersion}
                  aria-label={t('schema.saveVersion')}
                  title={t('schema.saveVersion')}
                >
                  <span className="sr-only">{t('schema.saveVersion')}</span>
                </Button>
              )}
            </span>
          </div>
          {versionsError ? (
            <EmptyState
              icon={<Warning size={22} />}
              title={versionsError}
              description={t('schema.viewBanner.noSnapshotDesc')}
            />
          ) : versions.length === 0 ? (
            <EmptyState
              icon={<FloppyDisk size={22} />}
              title={t('schema.empty.versionsTitle')}
              description={t('schema.empty.versionsDesc')}
              action={
                canEditVersions && onSaveVersion ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<FloppyDisk size={14} aria-hidden="true" />}
                    onClick={onSaveVersion}
                  >
                    {t('schema.saveVersion')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="versions-list erd-panel-versions-list">
              {[...versions]
                .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
                .map((v) => {
                  const isActive = v.id === selectedVersionId;
                  const hasSnap = !!v.snapshot;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`version-row ${isActive ? 'version-row-active' : ''} ${!hasSnap ? 'version-row-no-snapshot' : ''}`}
                      onClick={() => onToggleVersion?.(v)}
                      aria-pressed={isActive}
                      aria-current={isActive ? ('true' as const) : undefined}
                      aria-label={t('schema.viewRow.aria', { version: v.version })}
                      title={hasSnap ? t('schema.viewRow.aria', { version: v.version }) : t('schema.viewRow.noSnapshotTooltip')}
                    >
                      <Badge tone="accent">{v.version}</Badge>
                      {unreadVersionIds?.has(v.id) && (
                        <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">
                          New
                        </span>
                      )}
                      <div className="version-main">
                        <div className="version-notes">{v.notes || t('schema.noNotes')}</div>
                        <div className="version-date">{t('schema.appliedAt', { date: formatDate(v.appliedAt) })}</div>
                      </div>
                      <span className="version-row-eye" aria-hidden="true">
                        {isActive ? <Eye size={14} weight="fill" /> : <Eye size={14} />}
                      </span>
                      {!hasSnap && (
                        <span className="version-row-warn" aria-hidden="true">
                          <Warning size={12} />
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );

  // U4: DBML viewer — <pre> + Copy + Download via toDBML (snapshot-safe: terima array argumen).
  const dbmlText = useMemo(() => {
    try {
      return toDBML(tables, relations);
    } catch {
      return '';
    }
  }, [tables, relations]);
  const handleCopyDbml = async () => {
    const body = dbmlText.trim() !== '' ? dbmlText : `-- ${dbmlFileBase} — no tables to export\n`;
    try {
      await navigator.clipboard.writeText(body);
      setDbmlCopyStatus(t('schema.dbml.copied'));
    } catch {
      setDbmlCopyStatus(t('schema.dbml.copyFailed'));
    }
  };
  const handleDownloadDbml = () => {
    try {
      const body = dbmlText.trim() !== '' ? dbmlText : `// ${dbmlFileBase} — no tables to export\n`;
      const blob = new Blob([body], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${safeFileName(dbmlFileBase)}.dbml`);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      /* pure never-throw: abaikan */
    }
  };
  const dbmlTabPanel = (
    <div
      id="erd-panel-tabpanel-dbml"
      role="tabpanel"
      aria-labelledby="erd-panel-tab-dbml"
      hidden={activeTab !== 'dbml'}
      className="erd-panel-tabpanel"
    >
      {activeTab === 'dbml' && (
        <>
          <div className="erd-panel-row">
            <h3 className="erd-panel-subtitle">{t('schema.dbml.title')}</h3>
            <span className="erd-panel-actions" style={{ marginTop: 0, paddingTop: 0 }}>
              <Button
                variant="ghost"
                size="sm"
                className="erd-panel-icon-btn"
                leftIcon={<Copy size={14} aria-hidden="true" />}
                onClick={handleCopyDbml}
                aria-label={t('schema.dbml.copy')}
                title={t('schema.dbml.copy')}
              >
                <span className="sr-only">{t('schema.dbml.copy')}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="erd-panel-icon-btn"
                leftIcon={<DownloadSimple size={14} aria-hidden="true" />}
                onClick={handleDownloadDbml}
                aria-label={t('schema.dbml.download')}
                title={t('schema.dbml.download')}
              >
                <span className="sr-only">{t('schema.dbml.download')}</span>
              </Button>
            </span>
          </div>
          <div role="status" aria-live="polite" className="sr-only">
            {dbmlCopyStatus}
          </div>
          <pre className="erd-dbml-pre font-mono" tabIndex={0} aria-label={t('schema.dbml.previewAria')}>
            {dbmlText.trim() !== '' ? dbmlText : t('schema.dbml.empty')}
          </pre>
        </>
      )}
    </div>
  );

  return (
    <aside
      className="erd-canvas-panel"
      role="complementary"
      aria-label={t('schema.panel.aria')}
      data-panel={activeTab}
      onKeyDown={handlePanelKeyDown}
    >
      {tablesTabPanel}
      {relationsTabPanel}
      {areasTabPanel}
      {versionsTabPanel}
      {dbmlTabPanel}
      {issuesSection}
    </aside>
  );
}

function relationLabelFor(rel: Relation, tables: Table[]): string {
  const ft = tables.find((t) => t.id === rel.fromTableId);
  const tt = tables.find((t) => t.id === rel.toTableId);
  const fc = ft?.columns.find((c) => c.id === rel.fromColumnId);
  const tc = tt?.columns.find((c) => c.id === rel.toColumnId);
  return relationLabel(
    ft?.name ?? shortId(rel.fromTableId),
    fc?.name || shortId(rel.fromColumnId),
    tt?.name ?? shortId(rel.toTableId),
    tc?.name || shortId(rel.toColumnId),
  );
}
