import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';
import type { ChangeEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  CaretRight,
  Check,
  Copy,
  DotsThree,
  DownloadSimple,
  Folder,
  FolderPlus,
  ListBullets,
  PencilSimple,
  Plugs,
  Plus,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useNewParam } from '../../hooks/useNewParam';
import { useSortParam } from '../../hooks/useSortParam';
import { applySort, type SortSpec } from '../../lib/sort';
import { formatDate, matchesApiEndpoint, newId, normalizeApiKey } from '../../lib/utils';
import { BODY_METHODS, fromOpenApi, toOpenApi } from '../../lib/openapi';
import type { ApiCollection, ApiEndpoint, ApiMethod, ApiParam, State } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { ActivityList } from '../../components/ActivityList';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { DataErrorState } from '../../components/DataErrorState';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { ApiSortControl } from '../../components/ApiSortControl';
import { Textarea } from '../../components/Textarea';
import { FE_LIMITS } from '../../lib/limits';
import { ApiDocsView } from './ApiDocsView';
import { ApiExportMenu } from './ApiExportMenu';
import { ApiMethodChip } from './ApiMethodChip';
import { CollectionModal } from './CollectionModal';
import { EndpointDocs } from './EndpointDocs';
import { EndpointModal } from './EndpointModal';
import { buildApiPdfTitle, printApiNode } from './printApi';

type ApiTab = 'headers' | 'params' | 'body' | 'responses';
type ApiMode = 'workspace' | 'docs';
type ApiSelection = { type: 'collection'; id: string } | { type: 'endpoint'; id: string } | null;
type DeleteTarget = { kind: 'collection'; id: string; name: string } | { kind: 'endpoint'; id: string; name: string } | null;

const API_COLLECTION_SORT_SPECS: SortSpec<ApiCollection>[] = [
  { key: 'name', label: 'api.sort.name', get: (c) => c.name },
  { key: 'createdAt', label: 'api.sort.created', get: (c) => c.createdAt },
];

const API_ENDPOINT_SORT_SPECS: SortSpec<ApiEndpoint>[] = [
  { key: 'name', label: 'api.sort.name', get: (e) => e.name },
  {
    key: 'method',
    label: 'api.sort.method',
    get: (e) => e.method,
    order: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
  { key: 'createdAt', label: 'api.sort.created', get: (e) => e.createdAt },
  { key: 'path', label: 'api.sort.path', get: (e) => e.path },
];

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 360;
const SIDEBAR_KEY = 'api-sidebar-width';
const OPENAPI_MAX_BYTES = 5 * 1024 * 1024;
const OPENAPI_MAX_LABEL = '5 MB';

function parseDefaultWidth(): number {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SIDEBAR_KEY);
  } catch {
    raw = null;
  }
  const n = raw ? Number(raw) : 264;
  if (!Number.isFinite(n)) return 264;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

function safeFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `devhub-${slug || 'api'}-openapi.yaml`;
}

function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

/** Header ringkas ≤640px (count hilang, sort+togle icon-only, aksi via drawer/overflow). */
function useIsApiNarrow(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (): void => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}

function ApiOverflowMenu({ canEdit, onImport, onExportOpenApi, onExportPdf, onNewCollection }: {
  canEdit: boolean;
  onImport: () => void;
  onExportOpenApi: () => void;
  onExportPdf: () => void;
  onNewCollection: () => void;
}) {
  const { t } = useTranslation('extras');
  const [open, setOpen] = useState(false);
  const choose = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="sort-control">
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('api.toolbar.moreActions')}
        title={t('api.toolbar.moreActions')}
        onClick={() => setOpen(true)}
      >
        <DotsThree size={16} weight="bold" aria-hidden="true" />
      </button>
      <BottomSheet open={open} title={t('api.toolbar.moreActions')} onClose={() => setOpen(false)} hideHeader>
        {canEdit && (
          <button type="button" className="sort-menu-row" onClick={choose(onImport)}>
            <UploadSimple size={13} aria-hidden="true" />
            {t('api.toolbar.import')}
          </button>
        )}
        <button type="button" className="sort-menu-row" onClick={choose(onExportOpenApi)}>
          <DownloadSimple size={13} aria-hidden="true" />
          {t('api.toolbar.export')}
        </button>
        <button
          type="button"
          className="sort-menu-row"
          title={t('api.toolbar.exportPdfHint')}
          onClick={choose(onExportPdf)}
        >
          <DownloadSimple size={13} aria-hidden="true" />
          {t('api.toolbar.exportPdf')}
        </button>
        {canEdit && (
          <button type="button" className="sort-menu-row" onClick={choose(onNewCollection)}>
            <FolderPlus size={13} aria-hidden="true" />
            {t('api.toolbar.newCollection')}
          </button>
        )}
      </BottomSheet>
    </div>
  );
}

interface ApiPageProps {
  projectName: string;
  projectDescription: string;
  unreadIds?: ReadonlySet<string>;
}

export function ApiPage({ projectName, projectDescription, unreadIds }: ApiPageProps) {
  const { t } = useTranslation('extras');
  const { state, error, loadError, canEdit, dispatch, projectId, retryLoad } = useProject();
  const [sidebarWidth, setSidebarWidth] = useState(parseDefaultWidth);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<ApiSelection>(null);
  const [tab, setTab] = useState<ApiTab>('headers');
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get('apiView');
  const mode: ApiMode =
    modeParam === 'docs' ? 'docs' : modeParam === 'workspace' ? 'workspace' : canEdit ? 'workspace' : 'docs';
  const setMode = useCallback(
    (next: ApiMode) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('apiView', next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const tabWorkspaceRef = useRef<HTMLButtonElement>(null);
  const tabDocsRef = useRef<HTMLButtonElement>(null);
  const handleModeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next: ApiMode = mode === 'workspace' ? 'docs' : 'workspace';
      setMode(next);
      (next === 'workspace' ? tabWorkspaceRef : tabDocsRef).current?.focus();
    },
    [mode, setMode],
  );
  const [showCollection, setShowCollection] = useState(false);
  const [showEndpoint, setShowEndpoint] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isNarrow = useIsApiNarrow();
  const [collError, setCollError] = useState<string | null>(null);
  const [epError, setEpError] = useState<string | null>(null);
  const editSnapshot = useRef<State | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { copied, copy } = useCopyFeedback();

  const collections = state?.apiCollections ?? [];
  const endpoints = state?.apiEndpoints ?? [];

  const selectedEp = selection?.type === 'endpoint' ? endpoints.find((e) => e.id === selection.id) : undefined;
  const selectedColl = selection?.type === 'collection' ? collections.find((c) => c.id === selection.id) : undefined;

  useEffect(() => {
    if (selection?.type === 'endpoint') setTab('headers');
    setEditing(false);
    editSnapshot.current = null;
    setCollError(null);
    setEpError(null);
  }, [selection]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [selection]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEntityDeepLink('apiEndpoints', (id) => setSelection({ type: 'endpoint', id }));
  useEntityDeepLink('apiCollections', (id) => setSelection({ type: 'collection', id }));
  useNewParam(() => setShowCollection(true), '1', canEdit);
  useNewParam(() => setShowEndpoint(true), 'endpoint', canEdit);
  const { value: collectionSort, setSort: setCollectionSort } = useSortParam();
  const { value: endpointSort, setSort: setEndpointSort } = useSortParam('sortE');
  const effectiveCollectionSort = collectionSort ?? { key: 'createdAt', dir: 'desc' as const };
  const effectiveEndpointSort = endpointSort ?? { key: 'createdAt', dir: 'desc' as const };
  const collectionSortSpec =
    API_COLLECTION_SORT_SPECS.find((s) => s.key === effectiveCollectionSort.key) ?? null;
  const endpointSortSpec =
    API_ENDPOINT_SORT_SPECS.find((s) => s.key === effectiveEndpointSort.key) ?? null;

  if (error) {
    return <DataErrorState error={loadError ?? error} onRetry={retryLoad} />;
  }

  if (!state) return null;

  const query = search.trim().toLowerCase();

  const visibleCollections = applySort(
    query
      ? collections.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            endpoints.some((e) => e.collectionId === c.id && matchesApiEndpoint(e, query)),
        )
      : collections,
    collectionSortSpec,
    effectiveCollectionSort.dir,
  );
  const ungrouped = endpoints.filter((e) => !e.collectionId);
  const visibleUngrouped = applySort(
    ungrouped.filter((e) => matchesApiEndpoint(e, query)),
    endpointSortSpec,
    effectiveEndpointSort.dir,
  );
  const ungroupedOpen = query ? true : !collapsed['__ungrouped__'];
  const matchCount = query
    ? endpoints.filter((e) => matchesApiEndpoint(e, query)).length +
      collections.filter((c) => c.name.toLowerCase().includes(query)).length
    : 0;

  function endpointCount(collectionId: string | null): number {
    return endpoints.filter((e) => e.collectionId === collectionId).length;
  }

  function startEditing() {
    if (!canEdit || !state) return;
    editSnapshot.current = structuredClone(state);
    setEditing(true);
  }

  function cancelEditing() {
    if (editSnapshot.current) {
      dispatch({ type: 'replace', state: editSnapshot.current });
      editSnapshot.current = null;
    }
    setEditing(false);
  }

  function finishEditing() {
    editSnapshot.current = null;
    setEditing(false);
  }

  function setSidebarWidthClamped(w: number) {
    const clamped = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w)));
    setSidebarWidth(clamped);
    try {
      localStorage.setItem(SIDEBAR_KEY, String(clamped));
    } catch {
      /* private mode: keep the width in memory only */
    }
  }

  function onResizeStart(e: ReactMouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      setSidebarWidthClamped(ev.clientX);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  async function importOpenApiFile(file: File) {
    if (!canEdit) return;
    setImportError(null);
    setImportNotice(null);
    if (file.size > OPENAPI_MAX_BYTES) {
      setImportError(t('api.import.tooLarge', { file: file.name, max: OPENAPI_MAX_LABEL }));
      return;
    }
    try {
      const text = await file.text();
      const imported = fromOpenApi(text);
      const seenKeys = new Set(endpoints.map((ep) => normalizeApiKey(ep.method, ep.path)));
      const idMap = new Map<string, string>();
      for (const c of imported.collections) {
        const existing = collections.find((x) => x.name.toLowerCase() === c.name.toLowerCase());
        const id = existing ? existing.id : newId();
        idMap.set(c.id, id);
        if (!existing) {
          dispatch({ type: 'apiCollection/add', collection: { ...c, id } });
        }
      }
      let addedEndpoints = 0;
      let skippedEndpoints = 0;
      for (const ep of imported.endpoints) {
        const key = normalizeApiKey(ep.method, ep.path);
        if (seenKeys.has(key)) {
          skippedEndpoints += 1;
          continue;
        }
        seenKeys.add(key);
        addedEndpoints += 1;
        dispatch({
          type: 'apiEndpoint/add',
          endpoint: {
            ...ep,
            id: newId(),
            collectionId: ep.collectionId ? (idMap.get(ep.collectionId) ?? null) : null,
          },
        });
      }
      if (imported.collections.length === 0 && imported.endpoints.length === 0) {
        setImportError(t('api.import.emptyFile', { file: file.name }));
      } else {
        setImportNotice(
          t('api.import.summary', {
            added: addedEndpoints,
            skipped: skippedEndpoints,
            collections: imported.collections.length,
          }),
        );
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : t('api.import.failed');
      setImportError(t('api.import.failedWithFile', { file: file.name, reason }));
    }
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await importOpenApiFile(file);
  }

  function onExport() {
    if (!state) return;
    const yaml = toOpenApi(state, { name: projectName, description: projectDescription });
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName(projectName);
    a.click();
    URL.revokeObjectURL(url);
  }

  function onExportPdf() {
    if (!state) return;
    printApiNode(
      <>
        <ApiDocsView
          projectName={projectName}
          projectDescription={projectDescription}
          collections={state.apiCollections}
          endpoints={state.apiEndpoints}
          milestones={state.milestones}
          canEdit={false}
          onNewEndpoint={() => undefined}
          onImport={() => undefined}
        />
        <div className="api-print-footer" aria-hidden="true">
          {t('api.docs.printFooter', { date: formatDate(new Date().toISOString()) })}
        </div>
      </>,
      buildApiPdfTitle(projectName),
    );
  }

  function onDeleteTarget() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'collection') {
      dispatch({ type: 'apiCollection/remove', id: deleteTarget.id });
      if (selection?.type === 'collection' && selection.id === deleteTarget.id) setSelection(null);
    } else {
      dispatch({ type: 'apiEndpoint/remove', id: deleteTarget.id });
      if (selection?.type === 'endpoint' && selection.id === deleteTarget.id) setSelection(null);
    }
    setDeleteTarget(null);
  }

  function updateEp(patch: Partial<ApiEndpoint>) {
    if (!selectedEp) return;
    dispatch({ type: 'apiEndpoint/update', id: selectedEp.id, patch });
  }

  function updateMethodPath(patch: { method?: ApiMethod; path?: string }) {
    if (!selectedEp) return;
    const method = patch.method ?? selectedEp.method;
    const path = patch.path ?? selectedEp.path;
    if (
      path.trim() !== '' &&
      endpoints.some(
        (e) => e.id !== selectedEp.id && normalizeApiKey(e.method, e.path) === normalizeApiKey(method, path),
      )
    ) {
      setEpError(t('api.duplicateEndpoint'));
      return;
    }
    if (epError) setEpError(null);
    updateEp(patch);
  }

  function updateHeader(i: number, patch: Partial<ApiEndpoint['headers'][number]>) {
    if (!selectedEp) return;
    updateEp({ headers: selectedEp.headers.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  }

  function updateParam(i: number, patch: Partial<ApiParam>) {
    if (!selectedEp) return;
    updateEp({ params: selectedEp.params.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  }

  function updateResponse(i: number, patch: Partial<ApiEndpoint['responses'][number]>) {
    if (!selectedEp) return;
    updateEp({
      responses: selectedEp.responses.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    });
  }

  function onCreatedCollection(id: string) {
    setShowCollection(false);
    setSelection({ type: 'collection', id });
  }

  function onCreatedEndpoint(id: string) {
    setShowEndpoint(false);
    setSelection({ type: 'endpoint', id });
    setMode(canEdit ? 'workspace' : 'docs');
  }

  const sortPair = mode === 'workspace' ? (
    <div className="api-sort-pair">
      <ApiSortControl
        collections={{
          label: t('api.sort.collections'),
          options: API_COLLECTION_SORT_SPECS.map((s) => ({ value: s.key, label: t(s.label) })),
          value: collectionSort,
          onChange: setCollectionSort,
        }}
        endpoints={{
          label: t('api.sort.endpoints'),
          options: API_ENDPOINT_SORT_SPECS.map((s) => ({ value: s.key, label: t(s.label) })),
          value: endpointSort,
          onChange: setEndpointSort,
        }}
      />
    </div>
  ) : null;

  const toolbarButtons = (
    <div className="api-toolbar-actions">
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<UploadSimple size={14} aria-hidden="true" />}
          onClick={() => fileInputRef.current?.click()}
        >
          {t('api.toolbar.import')}
        </Button>
      )}
      <ApiExportMenu onExportOpenApi={onExport} onExportPdf={onExportPdf} />
      {canEdit && (
        <>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<FolderPlus size={14} aria-hidden="true" />}
            onClick={() => setShowCollection(true)}
          >
            {t('api.toolbar.newCollection')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
            onClick={() => setShowEndpoint(true)}
          >
            {t('api.toolbar.newEndpoint')}
          </Button>
        </>
      )}
    </div>
  );

  const emptyWorkbench = canEdit ? (
    <div className="api-main-empty">
      <EmptyState
        icon={<Plugs size={22} />}
        title={t('api.empty.title')}
        description={t('api.empty.editorDesc')}
        action={
          <div className="api-empty-actions">
            <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setShowEndpoint(true)}>
              {t('api.toolbar.newEndpoint')}
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<FolderPlus size={14} aria-hidden="true" />} onClick={() => setShowCollection(true)}>
              {t('api.toolbar.newCollection')}
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<UploadSimple size={14} aria-hidden="true" />} onClick={() => fileInputRef.current?.click()}>
              {t('api.toolbar.import')}
            </Button>
          </div>
        }
      />
    </div>
  ) : (
    <div className="api-main-empty">
      <EmptyState
        icon={<Plugs size={22} />}
        title={t('api.empty.title')}
        description={t('api.empty.viewerDesc')}
      />
    </div>
  );

  return (
    <div className={`api-page${isNarrow && drawerOpen ? ' sidebar-open' : ''}`}>
      <div className="data-list-header">
        {!isNarrow ? (
          <span className="data-list-count">
            {t('api.count.collections', { count: collections.length })} · {t('api.count.endpoints', { count: endpoints.length })}
          </span>
        ) : (
          <span className="sr-only" role="status">
            {t('api.count.collections', { count: collections.length })} · {t('api.count.endpoints', { count: endpoints.length })}
          </span>
        )}
        <div className="data-list-actions">
          {!isNarrow && sortPair}
          {isNarrow ? (
            <div className="api-toolbar-actions">
              {mode === 'workspace' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                  aria-label={t('api.drawer.title')}
                  title={t('api.drawer.title')}
                  onClick={() => setDrawerOpen(true)}
                >
                  <ListBullets size={16} aria-hidden="true" />
                </Button>
              )}
              <ApiOverflowMenu
                canEdit={canEdit}
                onImport={() => fileInputRef.current?.click()}
                onExportOpenApi={onExport}
                onExportPdf={onExportPdf}
                onNewCollection={() => setShowCollection(true)}
              />
              {mode === 'workspace' && canEdit && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
                  onClick={() => setShowEndpoint(true)}
                >
                  {t('api.toolbar.newEndpointShort', { defaultValue: 'Endpoint' })}
                </Button>
              )}
            </div>
          ) : (
            toolbarButtons
          )}
        </div>
      </div>
      <div className="api-subtabs-row">
        <div className="sub-tabs api-mode-toggle" role="tablist" aria-label={t('api.mode.aria')}>
          <button
            ref={tabWorkspaceRef}
            type="button"
            role="tab"
            id="tab-api-workspace"
            aria-controls="panel-api-workspace"
            aria-selected={mode === 'workspace'}
            tabIndex={mode === 'workspace' ? 0 : -1}
            className={`sub-tab ${mode === 'workspace' ? 'sub-tab-active' : ''}`}
            aria-label={t('api.mode.workspace')}
            title={t('api.mode.workspace')}
            onClick={() => setMode('workspace')}
            onKeyDown={handleModeKeyDown}
          >
            <PencilSimple size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('api.mode.workspace')}</span>
          </button>
          <button
            ref={tabDocsRef}
            type="button"
            role="tab"
            id="tab-api-docs"
            aria-controls="panel-api-docs"
            aria-selected={mode === 'docs'}
            tabIndex={mode === 'docs' ? 0 : -1}
            className={`sub-tab ${mode === 'docs' ? 'sub-tab-active' : ''}`}
            aria-label={t('api.mode.docs')}
            title={t('api.mode.docs')}
            onClick={() => setMode('docs')}
            onKeyDown={handleModeKeyDown}
          >
            <BookOpen size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('api.mode.docs')}</span>
          </button>
        </div>
        <div className="api-subtabs-actions" />
      </div>

      {(importError || importNotice) && (
        <div className="api-import-sticky">
          {importError && <InlineError className="mb-12">{importError}</InlineError>}
          {importNotice && (
            <p className="api-import-notice mb-12" role="status">
              {importNotice}
            </p>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json,application/json,text/yaml"
        hidden
        onChange={onImportFile}
      />

      {mode === 'docs' ? (
        <div id="panel-api-docs" role="tabpanel" aria-labelledby="tab-api-docs" tabIndex={0}>
          <ApiDocsView
            projectName={projectName}
            projectDescription={projectDescription}
            collections={collections}
            endpoints={endpoints}
            milestones={state.milestones}
            canEdit={canEdit}
            onNewEndpoint={() => setShowEndpoint(true)}
            onImport={() => fileInputRef.current?.click()}
          />
        </div>
      ) : (
        <div className="api-panes" id="panel-api-workspace" role="tabpanel" aria-labelledby="tab-api-workspace" tabIndex={0}>
        <aside
          className={`api-sidebar${dragging ? ' api-drop-active' : ''}`}
          style={isNarrow ? undefined : { width: sidebarWidth }}
          role={isNarrow ? 'dialog' : undefined}
          aria-modal={isNarrow || undefined}
          aria-label={isNarrow ? t('api.drawer.title') : t('api.sidebar.aria')}
          onDragOver={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void importOpenApiFile(file);
          }}
        >
          {isNarrow && (
            <div className="api-drawer-head">
              <h2 className="sheet-title">{t('api.drawer.title')}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                aria-label={t('common:action.close', { defaultValue: 'Close' })}
                onClick={() => setDrawerOpen(false)}
              >
                <X size={14} weight="bold" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="api-search-wrap">
            <input
              className="api-sidebar-search"
              type="search"
              placeholder={t('api.sidebar.searchPlaceholder')}
              value={search}
              maxLength={FE_LIMITS.SEARCH}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('api.sidebar.searchAria')}
            />
            {search && (
              <button
                type="button"
                className="api-search-clear"
                aria-label={t('api.sidebar.clearSearch')}
                onClick={() => setSearch('')}
              >
                <X size={12} weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>
          {query && (
            <p className="api-search-count" role="status">
              {t('api.sidebar.results', { count: matchCount })}
            </p>
          )}
          {isNarrow && <div className="api-drawer-sort">{sortPair}</div>}
          <div className="api-sidebar-scroll">
            {collections.length === 0 && ungrouped.length === 0 ? (
              <p className="api-sidebar-empty">
                {t('api.sidebar.empty')}
              </p>
            ) : query && visibleCollections.length === 0 && visibleUngrouped.length === 0 ? (
              <div className="api-search-empty">
                <p className="api-sidebar-empty">
                  {t('api.sidebar.noResults', { query: search.trim() })}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                  {t('api.sidebar.clearSearch')}
                </Button>
              </div>
            ) : (
              <div className="api-tree">
                {visibleCollections.map((c) => {
                  const isOpen = query ? true : !collapsed[c.id];
                  const epList = applySort(
                    endpoints.filter((e) => e.collectionId === c.id && matchesApiEndpoint(e, query)),
                    endpointSortSpec,
                    effectiveEndpointSort.dir,
                  );
                  return (
                    <div key={c.id} className="api-tree-group">
                      <div
                        className={`api-tree-group-label ${selection?.type === 'collection' && selection.id === c.id ? 'api-tree-item-selected' : ''}`}
                      >
                        <button
                          type="button"
                          className="api-tree-caret-btn"
                          aria-label={isOpen ? t('api.tree.collapse', { name: c.name }) : t('api.tree.expand', { name: c.name })}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setCollapsed((prev) => ({ ...prev, [c.id]: !prev[c.id] }));
                          }}
                        >
                          <CaretRight
                            size={12}
                            className={`api-tree-caret ${isOpen ? 'api-tree-caret-open' : ''}`}
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          className="api-tree-group-select"
                          onClick={() => setSelection({ type: 'collection', id: c.id })}
                        >
                          <Folder size={14} className="api-tree-folder" aria-hidden="true" />
                          <span className="api-tree-item-title">{highlightMatch(c.name, query)}</span>
                          <span className="api-tree-count">{endpointCount(c.id)}</span>
                          {unreadIds?.has(c.id) && (
                            <>
                              <span className="unread-pill" role="status" aria-label={t('api.unread')} title={t('api.unread')}>{t('api.unread')}</span>
                            </>
                          )}
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="api-tree-actions"
                            aria-label={t('api.tree.deleteCollectionNamed', { name: c.name })}
                            title={t('api.tree.deleteCollection')}
                            onClick={() => setDeleteTarget({ kind: 'collection', id: c.id, name: c.name })}
                          >
                            <Trash size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {isOpen && epList.length > 0 && (
                        <div className="api-tree-children">
                          {epList.map((e) => (
                            <div
                              key={e.id}
                              className={`api-tree-item ${selection?.type === 'endpoint' && selection.id === e.id ? 'api-tree-item-selected' : ''}`}
                            >
                              <div className="api-tree-item-main">
                                <button
                                  type="button"
                                  className="api-tree-item-select"
                                  onClick={() => setSelection({ type: 'endpoint', id: e.id })}
                                >
                                  <ApiMethodChip method={e.method} />
                                  <span className="api-tree-item-title">{highlightMatch(e.name, query)}</span>
                                  {unreadIds?.has(e.id) && (
                                    <>
                                      <span className="unread-pill" role="status" aria-label={t('api.unread')} title={t('api.unread')}>{t('api.unread')}</span>
                                    </>
                                  )}
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="api-tree-actions"
                                    aria-label={t('api.tree.deleteEndpointNamed', { name: e.name })}
                                    title={t('api.tree.deleteEndpoint')}
                                    onClick={() => setDeleteTarget({ kind: 'endpoint', id: e.id, name: e.name })}
                                  >
                                    <Trash size={14} aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                              <div className="api-tree-item-path">{highlightMatch(e.path, query)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {visibleUngrouped.length > 0 && (
                    <div className="api-tree-group">
                      <div className={`api-tree-group-label ${selectedColl ? 'api-tree-item-selected' : ''}`}>
                        <button
                        type="button"
                        className="api-tree-caret-btn"
                        aria-label={ungroupedOpen ? t('api.tree.collapseUngrouped') : t('api.tree.expandUngrouped')}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setCollapsed((prev) => ({ ...prev, ['__ungrouped__']: !prev['__ungrouped__'] }));
                      }}
                    >
                      <CaretRight
                        size={12}
                        className={`api-tree-caret ${ungroupedOpen ? 'api-tree-caret-open' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                      <Folder size={14} className="api-tree-folder" aria-hidden="true" />
                      <span className="api-tree-item-title">{t('api.tree.ungrouped')}</span>
                      <span className="api-tree-count">{visibleUngrouped.length}</span>
                    </div>
                    {ungroupedOpen && (
                      <div className="api-tree-children">
                        {visibleUngrouped.map((e) => (
                          <div
                            key={e.id}
                            className={`api-tree-item ${selection?.type === 'endpoint' && selection.id === e.id ? 'api-tree-item-selected' : ''}`}
                          >
                            <div className="api-tree-item-main">
                              <button
                                type="button"
                                className="api-tree-item-select"
                                onClick={() => setSelection({ type: 'endpoint', id: e.id })}
                              >
                                <ApiMethodChip method={e.method} />
                                <span className="api-tree-item-title">{highlightMatch(e.name, query)}</span>
                                {unreadIds?.has(e.id) && (
                                  <>
                                    <span className="unread-pill" role="status" aria-label={t('api.unread')} title={t('api.unread')}>{t('api.unread')}</span>
                                  </>
                                )}
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  className="api-tree-actions"
                                  aria-label={t('api.tree.deleteEndpointNamed', { name: e.name })}
                                  title={t('api.tree.deleteEndpoint')}
                                  onClick={() => setDeleteTarget({ kind: 'endpoint', id: e.id, name: e.name })}
                                >
                                  <Trash size={14} aria-hidden="true" />
                                </button>
                              )}
                            </div>
                            <div className="api-tree-item-path">{highlightMatch(e.path, query)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        <div
          className="api-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('api.resizer.aria')}
          tabIndex={0}
          onMouseDown={onResizeStart}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            setSidebarWidthClamped(sidebarWidth + (e.key === 'ArrowRight' ? 16 : -16));
          }}
        />

        <main className="api-main">
          {selectedEp ? (
            <>
            {canEdit && editing ? (
              <>
                <div className="api-workbench-header">
                  <div className="api-workbench-actions">
                    <Button variant="ghost" size="sm" onClick={cancelEditing}>
                      {t('api.workbench.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Check size={14} weight="bold" aria-hidden="true" />}
                      onClick={finishEditing}
                    >
                      {t('api.workbench.done')}
                    </Button>
                  </div>
                  <div className="api-workbench-method">
                    <SearchableSelect
                      id="api-workbench-method"
                      ariaLabel={t('api.workbench.methodAria')}
                      value={selectedEp.method}
                      allowEmpty={false}
                      searchable={false}
                      options={(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as ApiMethod[]).map((m) => ({ value: m, label: m }))}
                      onChange={(v) => { if (v) updateMethodPath({ method: v as ApiMethod }); }}
                    />
                    <input
                      className="input api-path-input"
                      value={selectedEp.path}
                      maxLength={FE_LIMITS.API_ENDPOINT_PATH}
                      aria-label={t('api.workbench.pathAria')}
                      onChange={(e) => updateMethodPath({ path: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-icon"
                      aria-label={copied ? t('api.workbench.copied') : t('api.workbench.copyPath')}
                      title={copied ? t('api.workbench.copied') : t('api.workbench.copyPath')}
                      leftIcon={
                        copied ? (
                          <Check size={13} weight="bold" aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )
                      }
                      onClick={() => void copy(selectedEp.path)}
                    />
                  </div>
                </div>

                {epError && <InlineError className="mb-12">{epError}</InlineError>}

                <div className="api-editor">
                  <Input
                    label={t('api.workbench.name')}
                    value={selectedEp.name}
                    maxLength={FE_LIMITS.API_ENDPOINT_NAME}
                    showCount
                    onChange={(e) => updateEp({ name: e.target.value })}
                  />
                  <Textarea
                    label={t('api.workbench.description')}
                    rows={2}
                    placeholder={t('api.workbench.descPlaceholder')}
                    value={selectedEp.description}
                    maxLength={FE_LIMITS.API_ENDPOINT_DESC}
                    showCount
                    onChange={(e) => updateEp({ description: e.target.value })}
                  />
                  <SearchableSelect
                    id="api-workbench-collection"
                    label={t('api.endpointModal.collection')}
                    value={selectedEp.collectionId ?? null}
                    options={collections.map((c) => ({ value: c.id, label: c.name }))}
                    emptyLabel={t('api.endpointModal.noneUngrouped')}
                    onChange={(v) => {
                      updateEp({ collectionId: v });
                      if (v) setCollapsed((prev) => ({ ...prev, [v]: false }));
                    }}
                  />

                  <div className="tabs mt-4" role="tablist" aria-label={t('api.workbench.tabsAria')}>
                    {(['headers', 'params', 'body', 'responses'] as ApiTab[]).map((tabId) => (
                      <button
                        key={tabId}
                        type="button"
                        role="tab"
                        aria-selected={tab === tabId}
                        className={`tab ${tab === tabId ? 'tab-active' : ''}`}
                        onClick={() => setTab(tabId)}
                      >
                        {t(`api.tab.${tabId}`)}
                        {tabId !== 'body' && selectedEp[tabId].length > 0 && (
                          <span className="tab-count">{selectedEp[tabId].length}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {tab === 'headers' && (
                    <div className="api-rows">
                      <div className="api-col-labels api-kv-grid">
                        <span>{t('api.col.key')}</span>
                        <span>{t('api.col.value')}</span>
                        <span>{t('api.col.description')}</span>
                        <span />
                      </div>
                      {selectedEp.headers.map((h, i) => (
                        <div key={i} className="api-kv-grid">
                          <div className="field api-row-field">
                            <label className="field-label" htmlFor={`api-hdr-key-${i}`}>{t('api.col.key')}</label>
                            <input
                              id={`api-hdr-key-${i}`}
                              className="input"
                              aria-label={t('api.header.keyAria', { n: i + 1 })}
                              placeholder={t('api.header.keyPlaceholder')}
                              value={h.key}
                              maxLength={FE_LIMITS.API_HEADER_KEY}
                              onChange={(e) => updateHeader(i, { key: e.target.value })}
                            />
                          </div>
                          <div className="field api-row-field">
                            <label className="field-label" htmlFor={`api-hdr-value-${i}`}>{t('api.col.value')}</label>
                            <input
                              id={`api-hdr-value-${i}`}
                              className="input api-mono-input"
                              aria-label={t('api.header.valueAria', { n: i + 1 })}
                              placeholder={t('api.header.valuePlaceholder')}
                              value={h.value}
                              maxLength={FE_LIMITS.API_HEADER_VALUE}
                              onChange={(e) => updateHeader(i, { value: e.target.value })}
                            />
                          </div>
                          <div className="field api-row-field">
                            <label className="field-label" htmlFor={`api-hdr-desc-${i}`}>{t('api.col.description')}</label>
                            <input
                              id={`api-hdr-desc-${i}`}
                              className="input"
                              aria-label={t('api.header.descAria', { n: i + 1 })}
                              placeholder={t('api.header.descPlaceholder')}
                              value={h.description}
                              maxLength={FE_LIMITS.API_HEADER_DESC}
                              onChange={(e) => updateHeader(i, { description: e.target.value })}
                            />
                          </div>
                          <Button
                            variant="danger"
                            size="sm"
                            className="btn-icon api-row-remove"
                            aria-label={t('api.header.remove')}
                            leftIcon={<Trash size={14} aria-hidden="true" />}
                            onClick={() => updateEp({ headers: selectedEp.headers.filter((_, idx) => idx !== i) })}
                          />
                        </div>
                      ))}
                      {selectedEp.headers.length === 0 && (
                        <p className="api-rows-empty">{t('api.header.empty')}</p>
                      )}
                      <Button variant="ghost" size="sm" leftIcon={<Plus size={14} aria-hidden="true" />} onClick={() => updateEp({ headers: [...selectedEp.headers, { key: '', value: '', description: '' }] })}>
                        {t('api.header.add')}
                      </Button>
                    </div>
                  )}

                  {tab === 'params' && (
                    <div className="api-rows">
                      <div className="api-col-labels api-param-grid">
                        <span>{t('api.col.name')}</span>
                        <span>{t('api.col.in')}</span>
                        <span className="api-req-label">{t('api.col.required')}</span>
                        <span>{t('api.col.description')}</span>
                        <span />
                      </div>
                      {selectedEp.params.map((p, i) => (
                        <div key={i} className="api-param-grid">
                          <div className="field api-row-field">
                            <label className="field-label" htmlFor={`api-param-name-${i}`}>{t('api.col.name')}</label>
                            <input
                              id={`api-param-name-${i}`}
                              className="input"
                              aria-label={t('api.param.nameAria', { n: i + 1 })}
                              placeholder={t('api.param.namePlaceholder')}
                              value={p.name}
                              maxLength={FE_LIMITS.API_PARAM_NAME}
                              onChange={(e) => updateParam(i, { name: e.target.value })}
                            />
                          </div>
                          <div className="field api-row-field">
                            <span className="field-label" aria-hidden="true">{t('api.col.in')}</span>
                            <SearchableSelect
                              id={`api-param-in-${i}`}
                              ariaLabel={t('api.param.locationAria', { n: i + 1 })}
                              value={p.in}
                              allowEmpty={false}
                              searchable={false}
                              options={(['path', 'query'] as ApiParam['in'][]).map((loc) => ({ value: loc, label: loc }))}
                              onChange={(v) => { if (v) updateParam(i, { in: v as ApiParam['in'] }); }}
                            />
                          </div>
                          <div className="field api-row-field">
                            <label className="field-label" htmlFor={`api-param-req-${i}`}>{t('api.col.required')}</label>
                            <label className="api-check">
                              <input
                                id={`api-param-req-${i}`}
                                type="checkbox"
                                checked={p.required}
                                aria-label={t('api.param.requiredAria', { n: i + 1 })}
                                onChange={(e) => updateParam(i, { required: e.target.checked })}
                              />
                            </label>
                          </div>
                          <div className="field api-row-field">
                            <label className="field-label" htmlFor={`api-param-desc-${i}`}>{t('api.col.description')}</label>
                            <input
                              id={`api-param-desc-${i}`}
                              className="input"
                              aria-label={t('api.param.descAria', { n: i + 1 })}
                              placeholder={t('api.param.descPlaceholder')}
                              value={p.description}
                              maxLength={FE_LIMITS.API_PARAM_DESC}
                              onChange={(e) => updateParam(i, { description: e.target.value })}
                            />
                          </div>
                          <Button
                            variant="danger"
                            size="sm"
                            className="btn-icon api-row-remove"
                            aria-label={t('api.param.remove')}
                            leftIcon={<Trash size={14} aria-hidden="true" />}
                            onClick={() => updateEp({ params: selectedEp.params.filter((_, idx) => idx !== i) })}
                          />
                        </div>
                      ))}
                      {selectedEp.params.length === 0 && <p className="api-rows-empty">{t('api.param.empty')}</p>}
                      <Button variant="ghost" size="sm" leftIcon={<Plus size={14} aria-hidden="true" />} onClick={() => updateEp({ params: [...selectedEp.params, { name: '', in: 'query', required: false, description: '' }] })}>
                        {t('api.param.add')}
                      </Button>
                    </div>
                  )}

                  {tab === 'body' && (
                    <div className="api-rows">
                      <Textarea
                        label={t('api.body.label')}
                        rows={12}
                        className="api-mono-input"
                        placeholder={'{\n  "name": "Ada"\n}'}
                        helper={
                          BODY_METHODS.includes(selectedEp.method)
                            ? t('api.body.helper')
                            : t('api.body.notExported', { method: selectedEp.method })
                        }
                        value={selectedEp.body}
                        maxLength={FE_LIMITS.API_BODY}
                        showCount
                        onChange={(e) => updateEp({ body: e.target.value })}
                      />
                    </div>
                  )}

                  {tab === 'responses' && (
                    <div className="api-rows">
                      {selectedEp.responses.map((r, i) => (
                        <div key={i} className="api-resp-card">
                          <div className="api-resp-grid">
                            <div className="field">
                              <label className="field-label" htmlFor={`resp-status-${i}`}>
                                {t('api.response.status')}
                              </label>
                              <input
                                id={`resp-status-${i}`}
                                className="input api-mono-input"
                                type="number"
                                min={100}
                                max={599}
                                placeholder={t('api.response.statusPlaceholder')}
                                value={r.status === 0 || Number.isNaN(r.status) ? '' : r.status}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  updateResponse(i, { status: Number.isFinite(v) ? v : 0 });
                                }}
                                onBlur={() => {
                                  if (r.status === 0) updateResponse(i, { status: 200 });
                                }}
                              />
                            </div>
                            <div className="field">
                              <label className="field-label" htmlFor={`resp-type-${i}`}>
                                {t('api.response.contentType')}
                              </label>
                              <input
                                id={`resp-type-${i}`}
                                className="input"
                                placeholder={t('api.response.contentTypePlaceholder')}
                                value={r.contentType}
                                maxLength={FE_LIMITS.API_CONTENT_TYPE}
                                onChange={(e) => updateResponse(i, { contentType: e.target.value })}
                              />
                            </div>
                            <Button
                              variant="danger"
                              size="sm"
                              className="btn-icon api-row-remove"
                              aria-label={t('api.response.remove')}
                              leftIcon={<Trash size={14} aria-hidden="true" />}
                              onClick={() => updateEp({ responses: selectedEp.responses.filter((_, idx) => idx !== i) })}
                            />
                          </div>
                          <Input
                            label={t('api.workbench.description')}
                            placeholder={t('api.response.descPlaceholder')}
                            value={r.description}
                            maxLength={FE_LIMITS.API_RESPONSE_DESC}
                            showCount
                            onChange={(e) => updateResponse(i, { description: e.target.value })}
                          />
                          <Textarea
                            label={t('api.response.bodyLabel')}
                            rows={4}
                            className="api-mono-input"
                            placeholder={'{\n  "id": "1"\n}'}
                            value={r.body}
                            maxLength={FE_LIMITS.API_BODY}
                            showCount
                            onChange={(e) => updateResponse(i, { body: e.target.value })}
                          />
                        </div>
                      ))}
                      {selectedEp.responses.length === 0 && <p className="api-rows-empty">{t('api.response.empty')}</p>}
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Plus size={14} aria-hidden="true" />}
                        onClick={() =>
                          updateEp({
                            responses: [...selectedEp.responses, { status: 200, contentType: '', description: '', body: '' }],
                          })
                        }
                      >
                        {t('api.response.add')}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {canEdit && (
                  <div className="api-read-actions">
                    <Button
                      variant="danger"
                      size="sm"
                      className="btn-icon"
                      aria-label={t('api.tree.deleteEndpointNamed', { name: selectedEp.name })}
                      title={t('api.tree.deleteEndpoint')}
                      leftIcon={<Trash size={14} aria-hidden="true" />}
                      onClick={() => setDeleteTarget({ kind: 'endpoint', id: selectedEp.id, name: selectedEp.name })}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<PencilSimple size={14} aria-hidden="true" />}
                      onClick={startEditing}
                    >
                      {t('api.workbench.edit')}
                    </Button>
                  </div>
                )}
                <EndpointDocs endpoint={selectedEp} />
              </>
            )}
            <h4 className="detail-subtitle">{t('api.activity')}</h4>
            <ActivityList projectId={projectId} entity="apiEndpoints" entityId={selectedEp.id} />
            </>
          ) : selectedColl ? (
            <div className="api-col-view">
              <div className="api-workbench-header">
                <div className="api-workbench-method">
                  <Folder size={16} className="api-tree-folder" aria-hidden="true" />
                  {canEdit ? (
                    <input
                      className="input api-title-input"
                      value={selectedColl.name}
                      maxLength={FE_LIMITS.API_COLLECTION_NAME}
                      aria-label={t('api.collection.nameAria')}
                      aria-invalid={collError ? true : undefined}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (
                          v.trim() !== '' &&
                          collections.some(
                            (c) => c.id !== selectedColl.id && c.name.toLowerCase() === v.trim().toLowerCase(),
                          )
                        ) {
                          setCollError(t('api.collectionModal.duplicate'));
                        } else {
                          if (collError) setCollError(null);
                          dispatch({ type: 'apiCollection/update', id: selectedColl.id, patch: { name: v } });
                        }
                      }}
                    />
                  ) : (
                    <h2 className="preview-title">{selectedColl.name}</h2>
                  )}
                  <span className="api-tree-count">{endpointCount(selectedColl.id)}</span>
                </div>
                <div className="api-workbench-actions">
                  {canEdit && (
                    <Button
                      variant="danger"
                      size="sm"
                      className="api-delete-btn"
                      aria-label={t('api.tree.deleteCollection')}
                      title={t('api.tree.deleteCollection')}
                      leftIcon={<Trash size={14} aria-hidden="true" />}
                      onClick={() => setDeleteTarget({ kind: 'collection', id: selectedColl.id, name: selectedColl.name })}
                    />
                  )}
                </div>
              </div>
              {collError && <InlineError className="mb-12">{collError}</InlineError>}
              {canEdit ? (
                <Textarea
                  label={t('api.workbench.description')}
                  rows={3}
                  placeholder={t('api.collection.descPlaceholder')}
                  value={selectedColl.description}
                  maxLength={FE_LIMITS.API_COLLECTION_DESC}
                  showCount
                  onChange={(e) => dispatch({ type: 'apiCollection/update', id: selectedColl.id, patch: { description: e.target.value } })}
                />
              ) : (
                selectedColl.description && (
                  <div className="preview-block">
                    <p className="preview-body mt-8">
                      {selectedColl.description}
                    </p>
                  </div>
                )
              )}
              <div className="api-col-list">
                {endpoints
                  .filter((e) => e.collectionId === selectedColl.id)
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="api-col-list-row"
                      onClick={() => setSelection({ type: 'endpoint', id: e.id })}
                    >
                      <ApiMethodChip method={e.method} />
                      <div className="api-col-list-main">
                        <span className="api-tree-item-title">{e.name}</span>
                        <span className="api-tree-item-path">{e.path}</span>
                        {unreadIds?.has(e.id) && (
                          <>
                            <span className="unread-pill" role="status" aria-label={t('api.unread')} title={t('api.unread')}>{t('api.unread')}</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                {endpoints.filter((e) => e.collectionId === selectedColl.id).length === 0 && (
                  <p className="api-rows-empty">{t('api.collection.emptyEndpoints')}</p>
                )}
              </div>
              <h4 className="detail-subtitle">{t('api.activity')}</h4>
              <ActivityList projectId={projectId} entity="apiCollections" entityId={selectedColl.id} />
            </div>
          ) : (
            emptyWorkbench
          )}
        </main>
        </div>
      )}

      {isNarrow && drawerOpen && createPortal(
        <div
          className="api-drawer-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        />,
        document.body,
      )}

      {showCollection && <CollectionModal onClose={() => setShowCollection(false)} onCreated={onCreatedCollection} />}
      {showEndpoint && (
        <EndpointModal onClose={() => setShowEndpoint(false)} onCreated={onCreatedEndpoint} collections={collections} />
      )}

      <Modal
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'collection' ? t('api.delete.collectionTitle') : t('api.delete.endpointTitle')}
        onClose={() => setDeleteTarget(null)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setDeleteTarget(null)}>
              {t('api.delete.cancel')}
            </Button>
            <Button variant="danger" size="md" leftIcon={<Trash size={14} aria-hidden="true" />} onClick={onDeleteTarget}>
              {t('api.delete.confirm')}
            </Button>
          </>
        }
      >
        <p className="modal-copy">
          {deleteTarget?.kind === 'collection'
            ? t('api.delete.collectionDesc', { name: deleteTarget.name })
            : t('api.delete.endpointDesc', { name: deleteTarget?.name ?? '' })}
        </p>
      </Modal>
    </div>
  );
}