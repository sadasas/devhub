import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeft, CaretLeft, CaretRight, Eye, FloppyDisk, GitDiff, Graph, LinkSimple, List, Plus, Trash, Warning } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, relationLabel as formatRelation, shortId } from '../../lib/utils';
import type { Relation, SchemaVersion, Table } from '../../lib/types';
import { applySort, type SortSpec } from '../../lib/sort';
import { useProject } from '../../state/project-context';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useSortParam } from '../../hooks/useSortParam';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { ERD } from './ERD';
import { NewRelationModal } from './NewRelationModal';
import { NewTableModal } from './NewTableModal';
import { SaveVersionModal } from './SaveVersionModal';
import { DiffVersionModal } from './DiffVersionModal';
import { TableModal } from './TableModal';
import { InlineError } from '../../components/InlineError';

type SchemaView = 'tables' | 'erd';

const TABLE_SORT_SPECS: SortSpec<Table>[] = [
  { key: 'name', label: 'schema.sort.name', get: (t) => t.name },
  { key: 'createdAt', label: 'schema.sort.createdAt', get: (t) => t.createdAt },
];

const VERSION_SORT_SPECS: SortSpec<SchemaVersion>[] = [
  { key: 'appliedAt', label: 'schema.sort.applied', get: (v) => v.appliedAt },
];

export function SchemaPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { t } = useTranslation('project');
  const { state, loading, error, dispatch, canEdit } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('schemaView');
  const view: SchemaView = viewParam === 'erd' ? 'erd' : 'tables';
  const setView = useCallback(
    (next: SchemaView) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('schemaView', next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const { value: versionSortValue, setSort: setVersionSort } = useSortParam('sortv');
  const tableSortSpec = TABLE_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const versionSortSpec = VERSION_SORT_SPECS.find((s) => s.key === versionSortValue?.key) ?? null;
  const [newTableOpen, setNewTableOpen] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);
  useEntityDeepLink('tables', setTableId);
  const [newRelationOpen, setNewRelationOpen] = useState(false);
  const [confirmRel, setConfirmRel] = useState<Relation | null>(null);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [versionsCollapsed, setVersionsCollapsed] = useState(false);

  const tabTablesRef = useRef<HTMLButtonElement>(null);
  const tabErdRef = useRef<HTMLButtonElement>(null);

  // Opsi B: snapshot viewing via ?v=<uuid>
  const selectedVersionId = searchParams.get('v');
  const selectedVersion = useMemo(
    () => (state ? (state.schemaVersions.find((v) => v.id === selectedVersionId) ?? null) : null),
    [state, selectedVersionId],
  );
  const isViewing = !!selectedVersion;
  const hasSnapshot = !!selectedVersion?.snapshot;
  const displayTables = useMemo(() => {
    if (!state) return [];
    if (!isViewing) return state.tables;
    if (!hasSnapshot) return [];
    return selectedVersion!.snapshot!.tables;
  }, [state, isViewing, hasSnapshot, selectedVersion]);
  const displayRelations = useMemo(() => {
    if (!state) return [];
    if (!isViewing) return state.relations;
    if (!hasSnapshot) return [];
    return selectedVersion!.snapshot!.relations;
  }, [state, isViewing, hasSnapshot, selectedVersion]);
  const displayStateForERD = useMemo(() => {
    if (!state) return null;
    if (!isViewing) return state;
    return { ...state, tables: displayTables, relations: displayRelations };
  }, [state, isViewing, displayTables, displayRelations]);
  const canEditEffective = canEdit && !isViewing;

  const toggleVersion = useCallback(
    (v: SchemaVersion) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (p.get('v') === v.id) p.delete('v');
          else p.set('v', v.id);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const exitViewing = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('v');
        return p;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // focus is handled via autoFocus on Back button for SR announcement

  useEffect(() => {
    if (!isViewing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (diffOpen) return; // let modal handle its own escape
        exitViewing();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isViewing, diffOpen, exitViewing]);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = view === 'tables' ? 'erd' : 'tables';
        setView(next);
        (next === 'tables' ? tabTablesRef : tabErdRef).current?.focus();
      }
    },
    [view, setView],
  );

  if (loading) {
    return (
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading schema">
        <span className="sr-only">Loading schema…</span>
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ height: 56, gap: 12 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <Skeleton style={{ width: `${50 + i * 5}%`, height: 14 }} />
                <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 64, height: 11, borderRadius: 999 }} />
                  <Skeleton style={{ width: 48, height: 11 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <InlineError>
        {error}
      </InlineError>
    );
  }

  if (!state || !displayStateForERD) return null;

  const relationLabel = (rel: Relation, tables: Table[] = displayTables) => {
    const ft = tables.find((t) => t.id === rel.fromTableId);
    const tt = tables.find((t) => t.id === rel.toTableId);
    return formatRelation(
      ft?.name,
      ft?.columns.find((c) => c.id === rel.fromColumnId)?.name,
      tt?.name,
      tt?.columns.find((c) => c.id === rel.toColumnId)?.name,
    );
  };

  const relationLabelCurrent = (rel: Relation) => relationLabel(rel, state.tables);
  const relationLabelDisplay = (rel: Relation) => relationLabel(rel, displayTables);

  const columnsCount = displayTables.reduce((acc, t) => acc + t.columns.length, 0);

  return (
    <div className="">
      <div className="data-list-header">
        <span className="data-list-count">
          {isViewing && selectedVersion ? (
            hasSnapshot ? (
              t('schema.viewBanner.count', {
                version: selectedVersion.version,
                tables: displayTables.length,
                relations: displayRelations.length,
                date: formatDate(selectedVersion.appliedAt),
              })
            ) : (
              t('schema.viewBanner.count', {
                version: selectedVersion.version,
                tables: 0,
                relations: 0,
                date: formatDate(selectedVersion.appliedAt),
              })
            )
          ) : (
            t('schema.page.count', {
              tables: state.tables.length,
              relations: state.relations.length,
              versions: state.schemaVersions.length,
            })
          )}
        </span>
        <div className="data-list-actions">
          <SortControl
            options={TABLE_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEditEffective && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LinkSimple size={13} aria-hidden="true" />}
              onClick={() => setNewRelationOpen(true)}
            >
              {t('schema.page.newRelation')}
            </Button>
          )}
          {canEditEffective && (
            <Button size="sm" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} onClick={() => setNewTableOpen(true)}>
              {t('schema.page.newTable')}
            </Button>
          )}
        </div>
      </div>

      <div className="sub-tabs" role="tablist" aria-label={t('schema.page.viewAria')}>
        <button
          ref={tabTablesRef}
          type="button"
          className={`sub-tab ${view === 'tables' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('tables')}
          onKeyDown={handleTabKeyDown}
          role="tab"
          id="tab-tables"
          aria-selected={view === 'tables'}
          aria-controls="panel-tables"
          tabIndex={view === 'tables' ? 0 : -1}
        >
          <List size={13} aria-hidden="true" />
          {t('schema.page.tablesTab')}
        </button>
        <button
          ref={tabErdRef}
          type="button"
          className={`sub-tab ${view === 'erd' ? 'sub-tab-active' : ''}`}
          onClick={() => setView('erd')}
          onKeyDown={handleTabKeyDown}
          role="tab"
          id="tab-erd"
          aria-selected={view === 'erd'}
          aria-controls="panel-erd"
          tabIndex={view === 'erd' ? 0 : -1}
        >
          <Graph size={13} aria-hidden="true" />
          {t('schema.page.erdTab')}
        </button>
      </div>

      {isViewing && selectedVersion && (
        <div
          className="snapshot-banner"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="snapshot-banner-left">
            <Eye size={14} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="snapshot-banner-label">{t('schema.viewBanner.viewing')}</span>
            <Badge tone="accent">{selectedVersion.version}</Badge>
            <span className="snapshot-banner-meta">
              {t('schema.appliedAt', { date: formatDate(selectedVersion.appliedAt) })}
              {selectedVersion.notes ? ` · ${selectedVersion.notes}` : ` · ${t('schema.noNotes')}`}
              {hasSnapshot && ` · ${displayTables.length} tables · ${displayRelations.length} relations · ${columnsCount} columns`}
            </span>
            {!hasSnapshot && (
              <span className="snapshot-banner-warn" title={t('schema.viewRow.noSnapshotTooltip')}>
                <Warning size={13} aria-hidden="true" /> {t('schema.viewBanner.noSnapshotTitle')}
              </span>
            )}
          </div>
          <div className="snapshot-banner-actions">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft size={13} aria-hidden="true" />}
              onClick={exitViewing}
              aria-label={t('schema.viewBanner.backToCurrent')}
              autoFocus={isViewing}
            >
              {t('schema.viewBanner.backToCurrent')}
            </Button>
            {hasSnapshot && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<GitDiff size={13} aria-hidden="true" />}
                onClick={() => setDiffOpen(true)}
              >
                {t('schema.viewBanner.diffWithCurrent')}
              </Button>
            )}
          </div>
          <div className="snapshot-banner-notice">{t('schema.viewBanner.readOnlyNotice')}</div>
        </div>
      )}

      <div className={`schema-layout ${versionsCollapsed ? 'schema-layout-collapsed' : ''} `}>
        <div className="schema-main">
          {view === 'tables' ? (
            <div id="panel-tables" role="tabpanel" aria-labelledby="tab-tables" tabIndex={0}>
              {isViewing && !hasSnapshot ? (
                <EmptyState
                  icon={<FloppyDisk size={22} />}
                  title={t('schema.viewBanner.noSnapshotTitle')}
                  description={t('schema.viewBanner.noSnapshotDesc')}
                  action={<Button size="sm" variant="secondary" leftIcon={<ArrowLeft size={13} aria-hidden="true" />} onClick={exitViewing}>{t('schema.viewBanner.backToCurrent')}</Button>}
                />
              ) : displayTables.length === 0 ? (
                <EmptyState
                  icon={<Graph size={22} />}
                  title={isViewing ? t('schema.viewBanner.noTablesInSnapshot') : t('schema.empty.tablesTitle')}
                  description={isViewing ? t('schema.viewBanner.noTablesDesc') : t('schema.empty.tablesDesc')}
                  action={
                    !isViewing && canEditEffective ? (
                      <Button size="sm" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} onClick={() => setNewTableOpen(true)}>
                        {t('schema.page.newTable', { defaultValue: 'Create table' })}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="data-list">
                  {applySort(displayTables, tableSortSpec, effectiveSort.dir).map((t2) => (
                    <div key={t2.id} className={`data-row ${isViewing ? 'snapshot-row' : ''}`}>
                      {isViewing ? (
                        <div className="data-row-main snapshot-row-main" aria-label={t2.name}>
                          <div className="data-row-title">
                            <span className="row-title-text">{t2.name}</span>
                            <span className="snapshot-row-id">#{shortId(t2.id)}</span>
                          </div>
                          <div className="data-row-sub">{t2.comment || t('schema.noComment')}</div>
                          <div className="data-row-meta">
                            <span>
                              {t('schema.columnCount', { count: t2.columns.length })}
                            </span>
                            <span>
                              {t('schema.indexCount', { count: t2.indexes.length })}
                            </span>
                          </div>
                          {t2.columns.length > 0 && (
                            <div className="snapshot-cols" role="list" aria-label={`${t2.name} columns`}>
                              <div className="snapshot-cols-head">
                                <span>{t('schema.table.captionName')}</span>
                                <span>{t('schema.table.captionType')}</span>
                                <span>{t('schema.table.detailCaptionFlags')}</span>
                                <span>{t('schema.table.captionDefault')}</span>
                              </div>
                              {t2.columns.map((c) => (
                                <div key={c.id} className="snapshot-col" role="listitem">
                                  <span className="snapshot-col-name font-mono" title={c.name}>
                                    {c.name}
                                    {c.primaryKey && <span className="snapshot-pk" title={t('schema.table.primaryKeyTitle')}> PK</span>}
                                  </span>
                                  <span className="snapshot-col-type font-mono">{c.type || '—'}</span>
                                  <span className="snapshot-col-flags font-mono">
                                    {c.nullable ? '' : 'NOT NULL'}
                                    {c.primaryKey && c.nullable ? ' · PK' : ''}
                                  </span>
                                  <span className="snapshot-col-default font-mono">{c.default ?? '—'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {t2.indexes.length > 0 && (
                            <div className="snapshot-indexes">
                              <span className="snapshot-indexes-label">{t('schema.table.indexesLabel')}:</span>{' '}
                              <span className="font-mono">{t2.indexes.join(', ')}</span>
                            </div>
                          )}
                          {t2.columns.length === 0 && (
                            <div className="field-helper" style={{ marginTop: 6, fontStyle: 'italic' }}>
                              {t('schema.table.noColumnsView')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="data-row-main"
                          onClick={() => setTableId(t2.id)}
                          aria-label={t('schema.page.editTableAria', { name: t2.name })}
                        >
                          <div className="data-row-title">
                            <span className="row-title-text">{t2.name}</span>
                          </div>
                          <div className="data-row-sub">{t2.comment || t('schema.noComment')}</div>
                          <div className="data-row-meta">
                            <span>
                              {t('schema.columnCount', { count: t2.columns.length })}
                            </span>
                            <span>
                              {t('schema.indexCount', { count: t2.indexes.length })}
                            </span>
                            <span>#{shortId(t2.id)}</span>
                            {unreadIds?.has(t2.id) && (
                              <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">
                                New
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div id="panel-erd" role="tabpanel" aria-labelledby="tab-erd" tabIndex={0}>
              <div className="erd-wrap">
                <ERD
                  state={displayStateForERD}
                  readOnly={isViewing}
                  onDeleteRelation={canEditEffective ? setConfirmRel : () => { }}
                  onNewTable={canEditEffective ? () => setNewTableOpen(true) : () => { }}
                />
                {displayRelations.length > 0 && (
                  <div className="data-list relation-list">
                    <span className="data-list-count">{t('schema.relationsHeading')}</span>
                    {displayRelations.map((r) => (
                      <div className="data-row" key={r.id}>
                        <div className="data-row-main">
                          <div className="data-row-title">
                            <span className="row-title-text font-mono">{isViewing ? relationLabelDisplay(r) : relationLabelCurrent(r)}</span>
                          </div>
                          <div className="data-row-meta">
                            <span>{r.cardinality}</span>
                            <span>{t('schema.page.onDelete', { value: r.onDelete })}</span>
                            <span>#{shortId(r.id)}</span>
                            {!isViewing && unreadIds?.has(r.id) && (
                              <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="data-row-side">
                          {canEditEffective && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="btn-icon"
                              aria-label={t('schema.page.deleteRelationAria', { label: isViewing ? relationLabelDisplay(r) : relationLabelCurrent(r) })}
                              onClick={() => setConfirmRel(r)}
                            >
                              <Trash size={13} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isViewing && displayRelations.length === 0 && hasSnapshot && displayTables.length > 0 && (
                  <div className="field-helper" style={{ marginTop: 8, textAlign: 'center' }}>
                    {t('schema.relationsHeading')} — 0
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className={`schema-side ${versionsCollapsed ? 'schema-side-collapsed' : ''} `} aria-label={t('schema.versionsHeading')}>
          {versionsCollapsed ? (
            <button type="button" className="schema-side-collapsed-btn" onClick={() => setVersionsCollapsed(false)} aria-label="Expand versions" title="Expand versions">
              <CaretLeft size={14} aria-hidden="true" />
              <span className="schema-side-collapsed-label">{t('schema.versionsHeading')}</span>
              <Badge tone="accent">{state.schemaVersions.length}</Badge>
            </button>
          ) : (
            <div className="versions-section">
              <div className="data-list-header">
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                  aria-label={versionsCollapsed ? 'Expand versions' : 'Minimize versions'}
                  aria-expanded={!versionsCollapsed}
                  aria-controls="versions-list"
                  onClick={() => setVersionsCollapsed((v) => !v)}
                  title={versionsCollapsed ? 'Expand' : 'Minimize'}
                >
                  <CaretRight size={13} aria-hidden="true" />
                </Button>
                <span className="data-list-count">{t('schema.versionsHeading')}</span>
                <SortControl
                  options={VERSION_SORT_SPECS.map((s) => ({ value: s.key, label: t(s.label) }))}
                  value={versionSortValue}
                  onChange={setVersionSort}
                />
                {state.schemaVersions.filter((v) => v.snapshot).length >= 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<GitDiff size={13} aria-hidden="true" />}
                    onClick={() => setDiffOpen(true)}
                  >
                    {t('schema.diffVersions')}
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FloppyDisk size={13} aria-hidden="true" />}
                    onClick={() => setSaveVersionOpen(true)}
                  >
                    {t('schema.saveVersion')}
                  </Button>
                )}
              </div>
              {state.schemaVersions.length === 0 ? (
                <EmptyState
                  icon={<FloppyDisk size={22} />}
                  title={t('schema.empty.versionsTitle')}
                  description={t('schema.empty.versionsDesc')}
                  action={canEdit ? <Button size="sm" variant="ghost" leftIcon={<FloppyDisk size={13} aria-hidden="true" />} onClick={() => setSaveVersionOpen(true)}>{t('schema.saveVersion')}</Button> : undefined}
                />
              ) : (
                <div id="versions-list" className="versions-list">
                  {applySort(state.schemaVersions, versionSortSpec, versionSortValue?.dir ?? 'asc').map(
                    (v) => {
                      const isActive = v.id === selectedVersionId;
                      const hasSnap = !!v.snapshot;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={`version-row ${isActive ? 'version-row-active' : ''} ${!hasSnap ? 'version-row-no-snapshot' : ''}`}
                          onClick={() => toggleVersion(v)}
                          aria-pressed={isActive}
                          aria-current={isActive ? 'true' : undefined}
                          aria-label={t('schema.viewRow.aria', { version: v.version })}
                          title={hasSnap ? t('schema.viewRow.aria', { version: v.version }) : t('schema.viewRow.noSnapshotTooltip')}
                        >
                          <Badge tone="accent">{v.version}</Badge>
                          {unreadIds?.has(v.id) && (
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
            </div>
          )}
        </aside>
      </div>

      <NewTableModal open={newTableOpen} onClose={() => setNewTableOpen(false)} />
      <TableModal tableId={tableId} onClose={() => setTableId(null)} />
      <NewRelationModal open={newRelationOpen} onClose={() => setNewRelationOpen(false)} />
      <SaveVersionModal open={saveVersionOpen} onClose={() => setSaveVersionOpen(false)} />
      <DiffVersionModal open={diffOpen} versions={state.schemaVersions} onClose={() => setDiffOpen(false)} />
      <Modal
        open={confirmRel !== null}
        title={t('schema.deleteRelationModal.title')}
        onClose={() => setConfirmRel(null)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRel(null)}>
              {t('schema.deleteRelationModal.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmRel) dispatch({ type: 'relation/remove', id: confirmRel.id });
                setConfirmRel(null);
              }}
            >
              {t('schema.deleteRelationModal.confirm')}
            </Button>
          </>
        }
      >
        <p className="modal-copy">
          {t('schema.deleteRelationModal.body', { relation: confirmRel ? relationLabelCurrent(confirmRel) : '' })}
        </p>
      </Modal>
    </div>
  );
}
