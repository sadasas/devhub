import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FloppyDisk, GitDiff, Graph, LinkSimple, List, Plus, Trash } from '@phosphor-icons/react';
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

  const tabTablesRef = useRef<HTMLButtonElement>(null);
  const tabErdRef = useRef<HTMLButtonElement>(null);

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
      <div className="data-list">
        <Skeleton className="data-row" style={{ height: 44 }} />
        <Skeleton className="data-row" style={{ height: 44 }} />
        <Skeleton className="data-row" style={{ height: 44 }} />
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

  if (!state) return null;

  const relationLabel = (rel: Relation) => {
    const ft = state.tables.find((t) => t.id === rel.fromTableId);
    const tt = state.tables.find((t) => t.id === rel.toTableId);
    return formatRelation(
      ft?.name,
      ft?.columns.find((c) => c.id === rel.fromColumnId)?.name,
      tt?.name,
      tt?.columns.find((c) => c.id === rel.toColumnId)?.name,
    );
  };

  return (
    <div className="page">
      <div className="data-list-header">
        <span className="data-list-count">
          {t('schema.page.count', {
            tables: state.tables.length,
            relations: state.relations.length,
            versions: state.schemaVersions.length,
          })}
        </span>
        <div className="data-list-actions">
          <SortControl
            options={TABLE_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LinkSimple size={13} aria-hidden="true" />}
              onClick={() => setNewRelationOpen(true)}
            >
              {t('schema.page.newRelation')}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={() => setNewTableOpen(true)}>
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

      <div className="schema-layout">
        <div className="schema-main">
          {view === 'tables' ? (
            <div id="panel-tables" role="tabpanel" aria-labelledby="tab-tables" tabIndex={0}>
              {state.tables.length === 0 ? (
                <EmptyState
                  icon={<Graph size={22} />}
                  title={t('schema.empty.tablesTitle')}
                  description={t('schema.empty.tablesDesc')}
                  action={canEdit ? <Button size="sm" onClick={() => setNewTableOpen(true)}>{t('schema.page.newTable')}</Button> : undefined}
                />
              ) : (
                <div className="data-list">
                  {applySort(state.tables, tableSortSpec, effectiveSort.dir).map((t2) => (
                    <div key={t2.id} className="data-row">
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div id="panel-erd" role="tabpanel" aria-labelledby="tab-erd" tabIndex={0}>
              <div className="erd-wrap">
                <ERD
                  state={state}
                  onDeleteRelation={setConfirmRel}
                  onNewTable={canEdit ? () => setNewTableOpen(true) : () => {}}
                />
                {state.relations.length > 0 && (
                  <div className="data-list relation-list">
                    <span className="data-list-count">{t('schema.relationsHeading')}</span>
                    {state.relations.map((r) => (
                      <div className="data-row" key={r.id}>
                        <div className="data-row-main">
                          <div className="data-row-title">
                            <span className="row-title-text font-mono">{relationLabel(r)}</span>
                          </div>
                          <div className="data-row-meta">
                            <span>{r.cardinality}</span>
                            <span>{t('schema.page.onDelete', { value: r.onDelete })}</span>
                            <span>#{shortId(r.id)}</span>
                            {unreadIds?.has(r.id) && (
                              <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="data-row-side">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="btn-icon"
                              aria-label={t('schema.page.deleteRelationAria', { label: relationLabel(r) })}
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
              </div>
            </div>
          )}
        </div>

        <aside className="schema-side" aria-label={t('schema.versionsHeading')}>
          <div className="versions-section">
            <div className="data-list-header">
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
              <div>
                {applySort(state.schemaVersions, versionSortSpec, versionSortValue?.dir ?? 'asc').map(
                  (v) => (
                    <div className="version-row" key={v.id}>
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
                    </div>
                  ))}
              </div>
            )}
          </div>
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
          {t('schema.deleteRelationModal.body', { relation: confirmRel ? relationLabel(confirmRel) : '' })}
        </p>
      </Modal>
    </div>
  );
}
