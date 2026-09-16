import { useEffect, useRef, useState } from 'react';
import { ArrowsOutSimple, CaretDown, Plus, Trash, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, relationLabel, shortId } from '../../lib/utils';
import type { Column, OnDelete, Relation, RelationCardinality, Table } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { FE_LIMITS } from '../../lib/limits';
import { isUniqueIndex, toggleUnique } from './column-helpers';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SearchableSelect } from '../../components/SearchableSelect';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { SchemaIssuesStrip } from './SchemaIssuesStrip';
import type { SchemaIssue } from './schema-lint';

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
}

type PanelTab = 'tables' | 'relations';

/**
 * Ronde 5: tab Tables|Relations dengan detail inline expandable.
 * Klik canvas (table/relation prop) auto-buka tab + expand yang sesuai
 * (tanpa mencuri fokus keyboard). Issues selalu paling bawah di semua tab.
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
}: ERDCanvasPanelProps) {
  const { t } = useTranslation('project');
  const { state, dispatch } = useProject();
  const [expandedColumnId, setExpandedColumnId] = useState<string | null>(null);
  const [confirmDeleteTableId, setConfirmDeleteTableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>('tables');
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);
  const [expandedRelationId, setExpandedRelationId] = useState<string | null>(null);
  const tabTablesRef = useRef<HTMLButtonElement>(null);
  const tabRelationsRef = useRef<HTMLButtonElement>(null);
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
  }, [table?.id]);

  useEffect(() => {
    if (relation?.id) {
      setActiveTab('relations');
      setExpandedRelationId(relation.id);
    } else {
      setExpandedRelationId(null);
    }
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

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: PanelTab = activeTab === 'tables' ? 'relations' : 'tables';
    setActiveTab(next);
    (next === 'tables' ? tabTablesRef : tabRelationsRef).current?.focus();
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

  const tabBar = (
    <div
      className="sub-tabs erd-panel-tabs"
      role="tablist"
      aria-label={`${t('schema.panel.tablesTab')} / ${t('schema.panel.relationsTab')}`}
      onKeyDown={handleTabKeyDown}
    >
      <button
        ref={tabTablesRef}
        type="button"
        role="tab"
        id="erd-panel-tab-tables"
        aria-selected={activeTab === 'tables'}
        aria-controls="erd-panel-tabpanel-tables"
        tabIndex={activeTab === 'tables' ? 0 : -1}
        className={`sub-tab ${activeTab === 'tables' ? 'sub-tab-active' : ''}`}
        onClick={() => setActiveTab('tables')}
      >
        {t('schema.panel.tablesTab')}
      </button>
      <button
        ref={tabRelationsRef}
        type="button"
        role="tab"
        id="erd-panel-tab-relations"
        aria-selected={activeTab === 'relations'}
        aria-controls="erd-panel-tabpanel-relations"
        tabIndex={activeTab === 'relations' ? 0 : -1}
        className={`sub-tab ${activeTab === 'relations' ? 'sub-tab-active' : ''}`}
        onClick={() => setActiveTab('relations')}
      >
        {t('schema.panel.relationsTab')}
      </button>
    </div>
  );

  const renderTableDetail = (tbl: Table) => {
    const canEdit = !readOnly;
    const updateTable = (patch: Partial<Pick<Table, 'name' | 'comment' | 'columns' | 'indexes'>>) => {
      dispatch({ type: 'table/update', id: tbl.id, patch });
    };
    const updateColumn = (columnId: string, patch: Partial<Omit<Column, 'id'>>) => {
      updateTable({ columns: tbl.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)) });
    };
    const addColumn = () => {
      updateTable({
        columns: [
          ...tbl.columns,
          { id: newId(), name: '', type: '', nullable: true, primaryKey: false, comment: '' },
        ],
      });
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
        </div>

        <div className="erd-panel-section">
          <div className="erd-panel-row">
            <h3 className="erd-panel-subtitle">
              {t('schema.panel.columnsLabel')} <span className="erd-panel-count">· {tbl.columns.length}</span>
            </h3>
            {canEdit && (
              <Button variant="ghost" size="sm" leftIcon={<Plus size={14} aria-hidden="true" />} onClick={addColumn}>
                {t('schema.panel.addColumn')}
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
                      </button>
                      {canEdit && (
                        <label
                          className="erd-panel-unique"
                          title={`${t('schema.panel.uniqueLabel')} — ${colDisplay}`}
                        >
                          <input
                            type="checkbox"
                            checked={unique}
                            disabled={col.name.trim() === ''}
                            aria-label={`${t('schema.panel.uniqueLabel')} — ${colDisplay}`}
                            onChange={() => updateTable({ indexes: toggleUnique(tbl.indexes, col.name) })}
                          />
                          <span aria-hidden="true">{t('schema.panel.uniqueLabel')}</span>
                        </label>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          className="erd-panel-x"
                          aria-label={t('schema.panel.deleteColumnAria', { name: colDisplay })}
                          title={t('schema.panel.deleteColumnAria', { name: colDisplay })}
                          onClick={() => removeColumn(col.id)}
                        >
                          <X size={12} aria-hidden="true" />
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
                          <span
                            className="erd-panel-read font-mono"
                            role="text"
                            aria-labelledby={`erd-panel-col-type-label-${col.id}`}
                          >
                            {col.type.trim() !== '' ? col.type : '—'}
                          </span>
                          <p className="field-helper">{t('schema.panel.typeReadonlyHint')}</p>
                        </div>
                        <div className="erd-panel-checks">
                          <label className="erd-panel-check">
                            <input
                              type="checkbox"
                              checked={col.nullable}
                              disabled={!canEdit}
                              onChange={(e) => updateColumn(col.id, { nullable: e.target.checked })}
                            />
                            {t('schema.panel.nullableLabel')}
                          </label>
                          <label className="erd-panel-check">
                            <input
                              type="checkbox"
                              checked={col.primaryKey}
                              disabled={!canEdit}
                              onChange={(e) => updateColumn(col.id, { primaryKey: e.target.checked })}
                            />
                            {t('schema.panel.pkLabel')}
                          </label>
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
          <div className="erd-panel-row">
            <h3 className="erd-panel-subtitle">{t('schema.panel.indexesLabel')}</h3>
            {canEdit && onOpenTable && (
              <Button variant="ghost" size="sm" onClick={() => onOpenTable(tbl.id)}>
                {t('schema.panel.editIndexes')}
              </Button>
            )}
          </div>
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
              leftIcon={<ArrowsOutSimple size={14} aria-hidden="true" />}
              onClick={() => onOpenTable(tbl.id)}
            >
              {t('schema.panel.openFullEditor')}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              onClick={() => setConfirmDeleteTableId(tbl.id)}
            >
              {t('schema.panel.deleteTable')}
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
            leftIcon={<Trash size={14} aria-hidden="true" />}
            onClick={() => onDeleteRelation(rel)}
          >
            {t('schema.panel.deleteRelation')}
          </Button>
        </div>
      )}
    </>
  );

  const tablesTabPanel = (
    <div
      id="erd-panel-tabpanel-tables"
      role="tabpanel"
      aria-labelledby="erd-panel-tab-tables"
      hidden={activeTab !== 'tables'}
      className="erd-panel-tabpanel"
    >
      {activeTab === 'tables' &&
        (tables.length === 0 ? (
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
        ))}
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
      {activeTab === 'relations' &&
        (relations.length === 0 ? (
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
        ))}
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
      {tabBar}
      {tablesTabPanel}
      {relationsTabPanel}
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
