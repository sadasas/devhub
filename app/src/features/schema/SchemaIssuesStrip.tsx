import { CaretDown, CaretUp, Warning } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { relationLabel, shortId } from '../../lib/utils';
import type { Relation, Table } from '../../lib/types';
import type { SchemaIssue } from './schema-lint';

/** Issue codes that point at a concrete table/column view (F2-3: second "Open table" action). */
const OPENABLE_CODES: ReadonlySet<SchemaIssue['code']> = new Set(['pk-null', 'index-typo', 'type-mismatch']);

/**
 * Human label for an issue, resolved against display (snapshot-safe) tables.
 * - relation issues -> `fromTable.fromColumn → toTable.toColumn` via relationLabel
 * - column issues   -> `table.column`
 * - table issues    -> `table`
 * Falls back to shortId when the target was deleted.
 */
export function getSchemaIssueLabel(issue: SchemaIssue, tables: Table[], relations: Relation[]): string {
  const rel = issue.relationId ? relations.find((r) => r.id === issue.relationId) : undefined;
  if (rel) {
    const ft = tables.find((t) => t.id === rel.fromTableId);
    const tt = tables.find((t) => t.id === rel.toTableId);
    const fc = ft?.columns.find((c) => c.id === rel.fromColumnId);
    const tc = tt?.columns.find((c) => c.id === rel.toColumnId);
    return relationLabel(
      ft?.name ?? shortId(rel.fromTableId),
      fc?.name ?? shortId(rel.fromColumnId),
      tt?.name ?? shortId(rel.toTableId),
      tc?.name ?? shortId(rel.toColumnId),
    );
  }
  const tbl = tables.find((t) => t.id === issue.tableId);
  if (!tbl) {
    return issue.tableId ? `#${shortId(issue.tableId)}` : '?';
  }
  if (issue.columnId) {
    const col = tbl.columns.find((c) => c.id === issue.columnId);
    if (col) return `${tbl.name}.${col.name}`;
    return `${tbl.name}.#${shortId(issue.columnId)}`;
  }
  return tbl.name;
}

export function isOpenableIssue(issue: SchemaIssue): boolean {
  return OPENABLE_CODES.has(issue.code);
}

interface SchemaIssuesStripProps {
  issues: SchemaIssue[];
  tables: Table[];
  relations: Relation[];
  /** Snapshot read-only mode: hide Open/edit actions, Locate pans only. */
  isViewing: boolean;
  onLocate: (tableId: string) => void;
  onOpenTable: (tableId: string) => void;
  /**
   * U5: id prefix to avoid duplicate id/aria when the same component is used
   * in two places (regular ERD tab + canvas props panel). Default preserves
   * the legacy `schema-issues-*` ids so the regular tab is pixel-identical.
   */
  idPrefix?: string;
  /**
   * U5: collapsible panel-section mode (canvas props panel, bottom-most).
   * false = legacy strip (regular ERD tab, unchanged visuals).
   */
  collapsible?: boolean;
  /** U5: controlled open state for collapsible mode. Default true. */
  open?: boolean;
  /** U5: toggle handler for collapsible mode (panel header + toolbar pill share it). */
  onToggle?: () => void;
}

export function SchemaIssuesStrip({
  issues,
  tables,
  relations,
  isViewing,
  onLocate,
  onOpenTable,
  idPrefix,
  collapsible = false,
  open = true,
  onToggle,
}: SchemaIssuesStripProps) {
  const { t } = useTranslation('project');
  const base = idPrefix ?? 'schema-issues';
  const stripId = `${base}-strip`;
  const titleId = `${base}-title`;
  const bodyId = `${base}-list`;

  const rows = issues.map((issue, idx) => {
    const label = getSchemaIssueLabel(issue, tables, relations);
    const canLocate = tables.some((tb) => tb.id === issue.tableId);
    const canOpen = !isViewing && isOpenableIssue(issue) && canLocate;
    const key = `${issue.code}|${issue.tableId}|${issue.columnId ?? ''}|${issue.relationId ?? ''}|${idx}`;
    return (
      <li key={key} className="schema-issues-row">
        <Warning
          size={14}
          aria-hidden="true"
          className="schema-issues-icon"
          style={{ color: 'var(--status-warn)', flexShrink: 0 }}
        />
        <span className="schema-issues-msg">
          <span className="font-mono">{label}</span>
          <span aria-hidden="true"> — </span>
          <span>{issue.message}</span>
        </span>
        <span className="schema-issues-actions">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canLocate}
            onClick={() => onLocate(issue.tableId)}
            aria-label={t('schema.issues.locateAria', { label })}
            title={t('schema.issues.locateAria', { label })}
          >
            {t('schema.issues.locate')}
          </Button>
          {canOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenTable(issue.tableId)}
              aria-label={t('schema.issues.openTableAria', { label })}
              title={t('schema.issues.openTableAria', { label })}
            >
              {t('schema.issues.openTable')}
            </Button>
          )}
        </span>
      </li>
    );
  });

  // U5: panel-section mode — header ⚠ Issues (N) + [⌃]/[⌄] toggle; expanded =
  // the exact same list above (Locate/Open reuse 100%); collapsed = header
  // only (count stays visible via the toolbar pill). Zero issues stays mounted
  // auto-collapsed with "No issues" — honest in the props panel vs disappearing.
  if (collapsible) {
    const expanded = !!open;
    return (
      <section className="schema-issues-strip erd-panel-issues" id={stripId} aria-labelledby={titleId}>
        <button
          type="button"
          className="schema-issues-head erd-panel-issues-head schema-issues-head-button"
          id={titleId}
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={t(expanded ? 'schema.issues.collapseAria' : 'schema.issues.expandAria', {
            count: issues.length,
          })}
          onClick={onToggle}
        >
          <Warning size={14} aria-hidden="true" style={{ color: 'var(--status-warn)', flexShrink: 0 }} />
          <span aria-live="polite" aria-atomic="true">{t('schema.issues.title', { count: issues.length })}</span>
          {expanded ? (
            <CaretUp size={14} weight="bold" aria-hidden="true" />
          ) : (
            <CaretDown size={14} weight="bold" aria-hidden="true" />
          )}
        </button>
        {expanded && (
          <div id={bodyId} role="region" aria-labelledby={titleId}>
            {issues.length === 0 ? (
              <p className="field-helper erd-panel-issues-empty">{t('schema.issues.noIssues')}</p>
            ) : (
              <ul className="schema-issues-list" aria-labelledby={titleId}>
                {rows}
              </ul>
            )}
          </div>
        )}
      </section>
    );
  }

  if (onToggle) {
    const expanded = !!open;
    return (
      <div className="schema-issues-strip" id={stripId}>
        <button
          type="button"
          className="schema-issues-head schema-issues-head-button"
          id={titleId}
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={t(expanded ? 'schema.issues.collapseAria' : 'schema.issues.expandAria', { count: issues.length })}
          onClick={onToggle}
        >
          <Warning size={14} aria-hidden="true" style={{ color: 'var(--status-warn)', flexShrink: 0 }} />
          <span aria-live="polite" aria-atomic="true">{t('schema.issues.title', { count: issues.length })}</span>
          {expanded ? (
            <CaretUp size={14} weight="bold" aria-hidden="true" />
          ) : (
            <CaretDown size={14} weight="bold" aria-hidden="true" />
          )}
        </button>
        {expanded && (
          <div id={bodyId} role="region" aria-labelledby={titleId}>
            <ul className="schema-issues-list" aria-labelledby={titleId}>
              {rows}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="schema-issues-strip" id={stripId}>
      <div
        className="schema-issues-head"
        id={titleId}
        aria-live="polite"
        aria-atomic="true"
      >
        <Warning size={14} aria-hidden="true" style={{ color: 'var(--status-warn)', flexShrink: 0 }} />
        <span>{t('schema.issues.title', { count: issues.length })}</span>
      </div>
      <ul className="schema-issues-list" aria-labelledby={titleId}>
        {rows}
      </ul>
    </div>
  );
}
