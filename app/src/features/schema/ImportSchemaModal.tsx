/* DevHub schema import modal (F3-5, client-side only, zero-dep).
   Reuses the F3-3/F3-4 parsers — never touches parser/lint/diff/export code.

   Flow:
   - Paste text | Upload file (.sql/.dbml/.json, read locally via hidden input)
     + format selector Auto / Postgres DDL / DrawDB JSON / DBML.
     Auto tries JSON→DrawDB when the text parses as a diagram, DBML when it
     looks like DBML, else DDL. Parsers never throw — never a crash.
   - Live preview WITHOUT dispatch: effective "+N tables, +M columns,
     +K relations, S skipped" summary, New (green) vs Skipped-duplicate
     (yellow, case-insensitive table.name match) buckets, per-line warnings
     with Copy errors. Merge never overwrites existing columns: duplicate
     tables are skipped, and relations touching a skipped duplicate are
     skipped too (parser ids always reference the import copy, never the
     existing table — ids from the parser are kept as-is, never regenerated).
   - Radio Merge (default) vs Replace. Replace opens a separate
     ConfirmDeleteDialog (cascade copy) before anything is dispatched.
   - Optional auto-snapshot (ON by default, version auto `vX`, notes default
     "Before import") reusing the SaveVersionModal dispatch shape.
   - Confirm dispatches table/add + relation/add batches; the existing
     SaveBanner toast ("All changes saved") and activity log follow
     automatically via the mutation pipeline. */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Check, Copy, UploadSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { newId, nowIso } from '../../lib/utils';
import type { Relation, Table } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { fromDDL } from './ddl-import';
import { fromDBML } from './dbml-import';
import { fromDrawDB } from './drawdb-compat';

export type ImportFormat = 'auto' | 'ddl' | 'drawdb' | 'dbml';
export type ImportMode = 'merge' | 'replace';

export interface ImportWarning {
  /** 1-indexed source line when known (DDL); null for DrawDB-level warnings. */
  line: number | null;
  message: string;
}

export type ParsedImport =
  | { kind: 'empty' }
  | { kind: 'ok'; tables: Table[]; relations: Relation[]; warnings: ImportWarning[] };

const TEXTAREA_ID = 'import-schema-textarea';
const FORMAT_OPTIONS: ImportFormat[] = ['auto', 'ddl', 'drawdb', 'dbml'];
const EMPTY_TABLES: Table[] = [];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Heuristic DBML detector: `Table name {`, `Ref:`, or `Enum name {` at line
    start. DDL (`CREATE TABLE name (`) never matches — the brace must follow
    the bare table/enum name, and refs use the `Ref:` prefix form. */
export function looksLikeDBML(text: string): boolean {
  return (
    /(^|\n)\s*Table\s+["'`[]?\w+["'`\]]?\s*\{/.test(text) ||
    /(^|\n)\s*Ref\s*:/.test(text) ||
    /(^|\n)\s*Enum\s+["'`[]?\w+["'`\]]?\s*\{/.test(text)
  );
}

function isDrawDBLike(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return Array.isArray(v['tables']) || Array.isArray(v['relationships']) || Array.isArray(v['refs']);
}

function toWarnings(lines: Array<{ line: number; message: string }>): ImportWarning[] {
  return lines.map((w) => ({ line: w.line, message: w.message }));
}

/** Pure routing between the F3-3/F3-4/F3-6 parsers. Never throws (parsers don't). */
export function parseImportInput(raw: string, format: ImportFormat): ParsedImport {
  if (raw.trim() === '') return { kind: 'empty' };
  if (format === 'dbml') {
    const out = fromDBML(raw);
    return { kind: 'ok', tables: out.tables, relations: out.relations, warnings: toWarnings(out.warnings) };
  }
  if (format === 'drawdb') {
    const out = fromDrawDB(raw);
    return {
      kind: 'ok',
      tables: out.tables,
      relations: out.relations,
      warnings: out.warnings.map((message) => ({ line: null, message })),
    };
  }
  if (format === 'ddl') {
    const out = fromDDL(raw);
    return { kind: 'ok', tables: out.tables, relations: out.relations, warnings: toWarnings(out.warnings) };
  }
  // Auto: JSON that parses AND looks like a DrawDB diagram wins; DBML-looking
  // text goes to the DBML parser; everything else is tried as DDL.
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const asJson: unknown = JSON.parse(raw);
      if (isDrawDBLike(asJson)) {
        const out = fromDrawDB(asJson);
        return {
          kind: 'ok',
          tables: out.tables,
          relations: out.relations,
          warnings: out.warnings.map((message) => ({ line: null, message })),
        };
      }
    } catch {
      /* not JSON — fall through to DDL */
    }
  }
  if (looksLikeDBML(raw)) {
    const out = fromDBML(raw);
    return { kind: 'ok', tables: out.tables, relations: out.relations, warnings: toWarnings(out.warnings) };
  }
  const out = fromDDL(raw);
  return { kind: 'ok', tables: out.tables, relations: out.relations, warnings: toWarnings(out.warnings) };
}

interface ImportSchemaModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportSchemaModal({ open, onClose }: ImportSchemaModalProps) {
  const { t } = useTranslation('project');
  const { state, dispatch } = useProject();
  usePresenceStatus(t('schema.import.presence'), open);
  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [format, setFormat] = useState<ImportFormat>('auto');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [saveSnapshot, setSaveSnapshot] = useState(true);
  // null = untouched → render the auto default (auto `vX` + default notes).
  const [snapVersion, setSnapVersion] = useState<string | null>(null);
  const [snapNotes, setSnapNotes] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewId = useId();
  const { copied, copy } = useCopyFeedback();

  // Reset transient state whenever the modal opens; keyboard-first focus lands
  // on the source textarea (only constant sets — no reactive reads here).
  useEffect(() => {
    if (!open) return;
    setTab('paste');
    setFormat('auto');
    setText('');
    setFileName(null);
    setFileError(null);
    setMode('merge');
    setSaveSnapshot(true);
    setSnapVersion(null);
    setSnapNotes(null);
    setReplaceOpen(false);
    document.getElementById(TEXTAREA_ID)?.focus();
  }, [open ]);

  const existingTables = state?.tables ?? EMPTY_TABLES;
  const versionValue = snapVersion ?? `v${(state?.schemaVersions.length ?? 0) + 1}`;
  const notesValue = snapNotes ?? t('schema.import.snapshotNotesDefault');

  // Client-side preview only — no dispatch happens until confirm.
  const parsed = useMemo(() => parseImportInput(text, format), [text, format]);

  const preview = useMemo(() => {
    const imported: Table[] = parsed.kind === 'ok' ? parsed.tables : [];
    const relations: Relation[] = parsed.kind === 'ok' ? parsed.relations : [];
    const warnings: ImportWarning[] = parsed.kind === 'ok' ? parsed.warnings : [];
    const existingLower = new Set(existingTables.map((tbl) => tbl.name.toLowerCase()));
    const fresh = imported.filter((tbl) => !existingLower.has(tbl.name.toLowerCase()));
    const skippedTables = imported.filter((tbl) => existingLower.has(tbl.name.toLowerCase()));
    const freshIds = new Set(fresh.map((tbl) => tbl.id));
    const importableRelations =
      mode === 'replace'
        ? relations
        : relations.filter((rel) => freshIds.has(rel.fromTableId) && freshIds.has(rel.toTableId));
    const skippedRelations =
      mode === 'replace'
        ? []
        : relations.filter((rel) => !(freshIds.has(rel.fromTableId) && freshIds.has(rel.toTableId)));
    const tablesToImport = mode === 'replace' ? imported : fresh;
    const displayNew = mode === 'replace' ? imported : fresh;
    const displaySkipped = mode === 'replace' ? [] : skippedTables;
    return {
      imported,
      warnings,
      displayNew,
      displaySkipped,
      importableRelations,
      skippedRelations,
      tablesToImport,
      columnsToImport: tablesToImport.reduce((acc, tbl) => acc + tbl.columns.length, 0),
      skippedCount: displaySkipped.length + skippedRelations.length,
    };
  }, [parsed, existingTables, mode]);

  const summary = t('schema.import.summary', {
    tables: preview.tablesToImport.length,
    columns: preview.columnsToImport,
    relations: preview.importableRelations.length,
    skipped: preview.skippedCount,
  });

  const warningsText = preview.warnings
    .map((w) =>
      w.line !== null ? t('schema.import.warningLine', { line: w.line, message: w.message }) : w.message,
    )
    .join('\n');

  const snapshotInvalid = saveSnapshot && versionValue.trim() === '';
  const confirmDisabled =
    !state || parsed.kind !== 'ok' || preview.tablesToImport.length === 0 || snapshotInvalid;

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    setFileError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
    } catch {
      setFileError(t('schema.import.fileReadError'));
    }
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setTab((prev) => (prev === 'paste' ? 'upload' : 'paste'));
  }

  function doImport(): void {
    if (!state || parsed.kind !== 'ok') return;
    if (preview.tablesToImport.length === 0 || snapshotInvalid) return;
    const ts = nowIso();
    if (saveSnapshot) {
      // Same shape as SaveVersionModal: snapshot captures the PRE-import state.
      dispatch({
        type: 'schemaVersion/add',
        version: {
          id: newId(),
          createdAt: ts,
          updatedAt: ts,
          version: versionValue.trim(),
          appliedAt: ts,
          notes: notesValue.trim(),
          snapshot: { tables: state.tables, relations: state.relations },
          milestoneId: null,
        },
      });
    }
    if (mode === 'replace') {
      // table/remove cascades relations in the reducer, so removing every
      // existing table clears relations too.
      for (const tbl of state.tables) dispatch({ type: 'table/remove', id: tbl.id });
    }
    // Parser-fresh ids are kept as-is — never regenerated — so DDL/DrawDB
    // relations keep pointing at their imported tables.
    for (const tbl of preview.tablesToImport) dispatch({ type: 'table/add', table: tbl });
    for (const rel of preview.importableRelations) dispatch({ type: 'relation/add', relation: rel });
    setReplaceOpen(false);
    onClose();
  }

  function onConfirmMain(): void {
    if (confirmDisabled) return;
    if (mode === 'replace') setReplaceOpen(true);
    else doImport();
  }

  const formatLabel: Record<ImportFormat, string> = {
    auto: t('schema.import.formatAuto'),
    ddl: t('schema.import.formatDdl'),
    drawdb: t('schema.import.formatDrawdb'),
    dbml: t('schema.import.formatDbml'),
  };

  return (
    <>
      <Modal
        open={open}
        title={t('schema.import.title')}
        onClose={replaceOpen ? undefined : onClose}
        width="lg"
        ariaDescribedBy={previewId}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={onClose}>
              {t('schema.import.cancel')}
            </Button>
            {mode === 'replace' ? (
              <Button variant="danger" size="md" onClick={onConfirmMain} disabled={confirmDisabled}>
                {t('schema.import.continue')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                leftIcon={<UploadSimple size={14} aria-hidden="true" />}
                onClick={onConfirmMain}
                disabled={confirmDisabled}
              >
                {t('schema.import.confirm')}
              </Button>
            )}
          </>
        }
      >
        <div className="form-stack">
          <div className="sub-tabs" role="tablist" aria-label={t('schema.import.title')} onKeyDown={onTabKeyDown}>
            <button
              type="button"
              role="tab"
              id="tab-import-paste"
              aria-selected={tab === 'paste'}
              aria-controls="panel-import-paste"
              tabIndex={tab === 'paste' ? 0 : -1}
              className={`sub-tab ${tab === 'paste' ? 'sub-tab-active' : ''}`}
              onClick={() => setTab('paste')}
            >
              {t('schema.import.pasteTab')}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-import-upload"
              aria-selected={tab === 'upload'}
              aria-controls="panel-import-upload"
              tabIndex={tab === 'upload' ? 0 : -1}
              className={`sub-tab ${tab === 'upload' ? 'sub-tab-active' : ''}`}
              onClick={() => setTab('upload')}
            >
              {t('schema.import.uploadTab')}
            </button>
          </div>

          <div id="panel-import-paste" role="tabpanel" aria-labelledby="tab-import-paste" hidden={tab !== 'paste'}>
            <Textarea
              label={t('schema.import.pasteLabel')}
              id={TEXTAREA_ID}
              rows={10}
              className="font-mono"
              placeholder={t('schema.import.pastePlaceholder')}
              helper={t('schema.import.pasteHint')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div id="panel-import-upload" role="tabpanel" aria-labelledby="tab-import-upload" hidden={tab !== 'upload'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<UploadSimple size={14} aria-hidden="true" />}
                onClick={() => fileInputRef.current?.click()}
              >
                {fileName ? t('schema.import.uploadChange') : t('schema.import.uploadButton')}
              </Button>
              {fileName && (
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {fileName}
                </span>
              )}
            </div>
            <p className="field-helper">{t('schema.import.uploadHint')}</p>
            {fileError && <InlineError>{fileError}</InlineError>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql,.dbml,.json"
              hidden
              onChange={(e) => void onFileChange(e)}
            />
          </div>

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label">{t('schema.import.formatLabel')}</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FORMAT_OPTIONS.map((f) => (
                <label
                  key={f}
                  style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}
                >
                  <input type="radio" name="import-format" checked={format === f} onChange={() => setFormat(f)} />
                  {formatLabel[f]}
                </label>
              ))}
            </div>
            <p className="field-helper" style={{ marginBottom: 0 }}>
              {t('schema.import.formatAutoHint')}
            </p>
          </fieldset>

          <p id={previewId} className="data-list-count" style={{ margin: 0 }}>
            {summary}
          </p>

          {parsed.kind === 'empty' && <p className="field-helper" style={{ margin: 0 }}>{t('schema.import.emptyHint')}</p>}

          {parsed.kind === 'ok' && preview.imported.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <Badge tone="success">{t('schema.import.newBucket', { count: preview.displayNew.length })}</Badge>
                <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {preview.displayNew.map((tbl) => (
                    <li key={tbl.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14 }}>
                      <span className="font-mono">{tbl.name}</span>
                      <span className="field-helper" style={{ margin: 0 }}>
                        · {t('schema.columnCount', { count: tbl.columns.length })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {preview.displaySkipped.length > 0 && (
                <div>
                  <Badge tone="warn">{t('schema.import.skippedBucket', { count: preview.displaySkipped.length })}</Badge>
                  <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {preview.displaySkipped.map((tbl) => (
                      <li key={tbl.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14 }}>
                        <span className="font-mono">{tbl.name}</span>
                        <span className="field-helper" style={{ margin: 0 }}>
                          · {t('schema.columnCount', { count: tbl.columns.length })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {mode === 'merge' && preview.skippedRelations.length > 0 && (
                <p className="field-helper" style={{ margin: 0 }}>
                  {t('schema.import.skippedRelationsNote', { count: preview.skippedRelations.length })}
                </p>
              )}
            </div>
          )}

          {parsed.kind === 'ok' && preview.warnings.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span className="field-label" style={{ margin: 0 }}>
                  {t('schema.import.warningsTitle', { count: preview.warnings.length })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={
                    copied ? (
                      <Check size={13} weight="bold" aria-hidden="true" />
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )
                  }
                  onClick={() => void copy(warningsText)}
                >
                  {copied ? t('schema.import.copied') : t('schema.import.copyErrors')}
                </Button>
              </div>
              <ul
                role="alert"
                style={{
                  listStyle: 'none',
                  margin: '8px 0 0',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  maxHeight: 160,
                  overflow: 'auto',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 8,
                }}
              >
                {preview.warnings.map((w, i) => (
                  <li key={i} className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {w.line !== null
                      ? t('schema.import.warningLine', { line: w.line, message: w.message })
                      : w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label">{t('schema.import.modeLabel')}</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>{t('schema.import.modeMerge')}</strong>
                  <span className="field-helper" style={{ display: 'block', margin: 0 }}>
                    {t('schema.import.modeMergeDesc')}
                  </span>
                </span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>{t('schema.import.modeReplace')}</strong>
                  <span className="field-helper" style={{ display: 'block', margin: 0 }}>
                    {t('schema.import.modeReplaceDesc')}
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={saveSnapshot}
                onChange={(e) => setSaveSnapshot(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>{t('schema.import.snapshotLabel')}</span>
            </label>
            {saveSnapshot && (
              <div className="form-stack">
                <Input
                  label={t('schema.import.versionLabel')}
                  required
                  value={versionValue}
                  onChange={(e) => setSnapVersion(e.target.value)}
                  error={snapshotInvalid ? t('schema.import.versionRequired') : undefined}
                />
                <Textarea
                  label={t('schema.import.notesLabel')}
                  rows={2}
                  value={notesValue}
                  onChange={(e) => setSnapNotes(e.target.value)}
                />
              </div>
            )}
          </div>

          {parsed.kind === 'ok' && preview.tablesToImport.length === 0 && (
            <InlineError>{t('schema.import.emptyError')}</InlineError>
          )}
        </div>
      </Modal>

      <ConfirmDeleteDialog
        open={replaceOpen}
        title={t('schema.import.replaceTitle', {
          existing: state?.tables.length ?? 0,
          count: preview.tablesToImport.length,
        })}
        description={t('schema.import.replaceBody', {
          existing: state?.tables.length ?? 0,
          count: preview.tablesToImport.length,
          relations: preview.importableRelations.length,
        })}
        confirmLabel={t('schema.import.replaceConfirm')}
        onConfirm={doImport}
        onClose={() => setReplaceOpen(false)}
      />
    </>
  );
}
