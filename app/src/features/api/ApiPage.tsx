import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react';
import {
  BookOpen,
  CaretRight,
  Check,
  Copy,
  DownloadSimple,
  Folder,
  FolderPlus,
  PencilSimple,
  Plugs,
  Plus,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { newId } from '../../lib/utils';
import { fromOpenApi, toOpenApi } from '../../lib/openapi';
import type { ApiEndpoint, ApiMethod, ApiParam } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Button } from '../../components/Button';
import { ActivityList } from '../../components/ActivityList';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { ApiDocsView } from './ApiDocsView';
import { ApiMethodChip } from './ApiMethodChip';
import { CollectionModal } from './CollectionModal';
import { EndpointDocs } from './EndpointDocs';
import { EndpointModal } from './EndpointModal';

type ApiTab = 'headers' | 'params' | 'body' | 'responses';
type ApiMode = 'workspace' | 'docs';
type ApiSelection = { type: 'collection'; id: string } | { type: 'endpoint'; id: string } | null;
type DeleteTarget = { kind: 'collection'; id: string; name: string } | { kind: 'endpoint'; id: string; name: string } | null;

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 360;
const SIDEBAR_KEY = 'api-sidebar-width';

function parseDefaultWidth(): number {
  const raw = localStorage.getItem(SIDEBAR_KEY);
  const n = raw ? Number(raw) : 264;
  if (!Number.isFinite(n)) return 264;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

function safeFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `devhub-${slug || 'api'}-openapi.yaml`;
}

interface ApiPageProps {
  projectName: string;
  projectDescription: string;
}

export function ApiPage({ projectName, projectDescription }: ApiPageProps) {
  const { state, canEdit, dispatch, projectId } = useProject();
  const [sidebarWidth, setSidebarWidth] = useState(parseDefaultWidth);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<ApiSelection>(null);
  const [tab, setTab] = useState<ApiTab>('headers');
  const [mode, setMode] = useState<ApiMode>(canEdit ? 'workspace' : 'docs');
  const [showCollection, setShowCollection] = useState(false);
  const [showEndpoint, setShowEndpoint] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { copied, copy } = useCopyFeedback();

  const collections = state?.apiCollections ?? [];
  const endpoints = state?.apiEndpoints ?? [];

  const selectedEp = selection?.type === 'endpoint' ? endpoints.find((e) => e.id === selection.id) : undefined;
  const selectedColl = selection?.type === 'collection' ? collections.find((c) => c.id === selection.id) : undefined;

  useEffect(() => {
    if (selection?.type === 'endpoint') setTab('headers');
  }, [selection]);

  useEntityDeepLink('apiEndpoints', (id) => setSelection({ type: 'endpoint', id }));
  useEntityDeepLink('apiCollections', (id) => setSelection({ type: 'collection', id }));

  if (!state) return null;

  const query = search.trim().toLowerCase();
  const visibleCollections = query
    ? collections.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          endpoints.some(
            (e) =>
              e.collectionId === c.id &&
              (e.name.toLowerCase().includes(query) || e.path.toLowerCase().includes(query)),
          ),
      )
    : collections;
  const ungrouped = endpoints.filter((e) => !e.collectionId);
  const visibleUngrouped = query
    ? ungrouped.filter(
        (e) => e.name.toLowerCase().includes(query) || e.path.toLowerCase().includes(query),
      )
    : ungrouped;

  function matchesEndpoint(e: ApiEndpoint): boolean {
    return e.name.toLowerCase().includes(query) || e.path.toLowerCase().includes(query);
  }

  function endpointCount(collectionId: string | null): number {
    return endpoints.filter((e) => e.collectionId === collectionId).length;
  }

  function onResizeStart(e: ReactMouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX));
      setSidebarWidth(w);
      localStorage.setItem(SIDEBAR_KEY, String(w));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const imported = fromOpenApi(text);
      const idMap = new Map<string, string>();
      for (const c of imported.collections) {
        const existing = collections.find((x) => x.name.toLowerCase() === c.name.toLowerCase());
        const id = existing ? existing.id : newId();
        idMap.set(c.id, id);
        if (!existing) {
          dispatch({ type: 'apiCollection/add', collection: { ...c, id } });
        }
      }
      for (const ep of imported.endpoints) {
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
        setImportError('No endpoints or (tag) collections found in the file.');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import OpenAPI document.');
    }
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

  const toolbarButtons = (
    <div className="api-toolbar-actions">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<UploadSimple size={13} aria-hidden="true" />}
        onClick={() => fileInputRef.current?.click()}
      >
        Import OpenAPI
      </Button>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<DownloadSimple size={13} aria-hidden="true" />}
        onClick={onExport}
      >
        Export OpenAPI
      </Button>
      {canEdit && (
        <>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<FolderPlus size={13} aria-hidden="true" />}
            onClick={() => setShowCollection(true)}
          >
            New collection
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />}
            onClick={() => setShowEndpoint(true)}
          >
            New endpoint
          </Button>
        </>
      )}
    </div>
  );

  const emptyWorkbench = canEdit ? (
    <div className="api-main-empty">
      <EmptyState
        icon={<Plugs size={22} />}
        title="No endpoint selected"
        description="Document your API: describe collections and endpoints, then export as an OpenAPI 3.0 document."
        action={
          <div className="api-empty-actions">
            <Button size="sm" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} onClick={() => setShowEndpoint(true)}>
              New endpoint
            </Button>
            <Button size="sm" variant="outline" leftIcon={<FolderPlus size={13} aria-hidden="true" />} onClick={() => setShowCollection(true)}>
              New collection
            </Button>
            <Button size="sm" variant="outline" leftIcon={<UploadSimple size={13} aria-hidden="true" />} onClick={() => fileInputRef.current?.click()}>
              Import OpenAPI
            </Button>
          </div>
        }
      />
    </div>
  ) : (
    <div className="api-main-empty">
      <EmptyState
        icon={<Plugs size={22} />}
        title="No endpoint selected"
        description="Pick an endpoint from the sidebar to view its documentation."
      />
    </div>
  );

  return (
    <div className="api-page">
      <div className="api-toolbar">
        <div className="api-toolbar-left">
          <span className="api-toolbar-count">
            {collections.length} collection{collections.length === 1 ? '' : 's'} · {endpoints.length} endpoint{endpoints.length === 1 ? '' : 's'}
          </span>
          <div className="sub-tabs api-mode-toggle" role="tablist" aria-label="API view mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'workspace'}
              className={`sub-tab ${mode === 'workspace' ? 'sub-tab-active' : ''}`}
              onClick={() => setMode('workspace')}
            >
              <PencilSimple size={13} aria-hidden="true" />
              Workspace
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'docs'}
              className={`sub-tab ${mode === 'docs' ? 'sub-tab-active' : ''}`}
              onClick={() => setMode('docs')}
            >
              <BookOpen size={13} aria-hidden="true" />
              Docs
            </button>
          </div>
        </div>
        {toolbarButtons}
      </div>

      {importError && <InlineError className="mb-12">{importError}</InlineError>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json,application/json,text/yaml"
        hidden
        onChange={onImportFile}
      />

      {mode === 'docs' ? (
        <ApiDocsView
          projectName={projectName}
          projectDescription={projectDescription}
          collections={collections}
          endpoints={endpoints}
          canEdit={canEdit}
          onNewEndpoint={() => setShowEndpoint(true)}
          onImport={() => fileInputRef.current?.click()}
        />
      ) : (
        <div className="api-panes">
        <aside className="api-sidebar" style={{ width: sidebarWidth }} aria-label="API collections">
          <input
            className="api-sidebar-search"
            type="search"
            placeholder="Search endpoints…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search endpoints"
          />
          <div className="api-sidebar-scroll">
            {collections.length === 0 && ungrouped.length === 0 ? (
              <p className="api-sidebar-empty">
                No collections yet. Create one or import an OpenAPI document.
              </p>
            ) : (
              <div className="api-tree">
                {visibleCollections.map((c) => {
                  const isOpen = !collapsed[c.id];
                  const epList = endpoints.filter((e) => e.collectionId === c.id && (!query || matchesEndpoint(e)));
                  return (
                    <div key={c.id} className="api-tree-group">
                      <div
                        className={`api-tree-group-label ${selection?.type === 'collection' && selection.id === c.id ? 'api-tree-item-selected' : ''}`}
                      >
                        <button
                          type="button"
                          className="api-tree-caret-btn"
                          aria-label={isOpen ? `Collapse ${c.name}` : `Expand ${c.name}`}
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
                          <span className="api-tree-item-title">{c.name}</span>
                          <span className="api-tree-count">{endpointCount(c.id)}</span>
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="api-tree-actions"
                            aria-label={`Delete collection ${c.name}`}
                            title="Delete collection"
                            onClick={() => setDeleteTarget({ kind: 'collection', id: c.id, name: c.name })}
                          >
                            <Trash size={13} aria-hidden="true" />
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
                                  <span className="api-tree-item-title">{e.name}</span>
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="api-tree-actions"
                                    aria-label={`Delete endpoint ${e.name}`}
                                    title="Delete endpoint"
                                    onClick={() => setDeleteTarget({ kind: 'endpoint', id: e.id, name: e.name })}
                                  >
                                    <Trash size={13} aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                              <div className="api-tree-item-path">{e.path}</div>
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
                      aria-label={collapsed['__ungrouped__'] ? 'Expand Ungrouped' : 'Collapse Ungrouped'}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setCollapsed((prev) => ({ ...prev, ['__ungrouped__']: !prev['__ungrouped__'] }));
                      }}
                    >
                      <CaretRight
                        size={12}
                        className={`api-tree-caret ${!collapsed['__ungrouped__'] ? 'api-tree-caret-open' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                      <Folder size={14} className="api-tree-folder" aria-hidden="true" />
                      <span className="api-tree-item-title">Ungrouped</span>
                      <span className="api-tree-count">{visibleUngrouped.length}</span>
                    </div>
                    {!collapsed['__ungrouped__'] && (
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
                                <span className="api-tree-item-title">{e.name}</span>
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  className="api-tree-actions"
                                  aria-label={`Delete endpoint ${e.name}`}
                                  title="Delete endpoint"
                                  onClick={() => setDeleteTarget({ kind: 'endpoint', id: e.id, name: e.name })}
                                >
                                  <Trash size={13} aria-hidden="true" />
                                </button>
                              )}
                            </div>
                            <div className="api-tree-item-path">{e.path}</div>
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
          aria-label="Resize sidebar"
          onMouseDown={onResizeStart}
        />

        <main className="api-main">
          {selectedEp ? (
            <>
            {canEdit ? (
              <>
                <div className="api-workbench-header">
                  <div className="api-workbench-method">
                    {canEdit ? (
                      <select
                        className="select api-method-select"
                        value={selectedEp.method}
                        aria-label="HTTP method"
                        onChange={(e) => updateEp({ method: e.target.value as ApiMethod })}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                        <option value="OPTIONS">OPTIONS</option>
                      </select>
                    ) : (
                      <ApiMethodChip method={selectedEp.method} />
                    )}
                    {canEdit ? (
                      <input
                        className="input api-path-input"
                        value={selectedEp.path}
                        aria-label="Endpoint path"
                        onChange={(e) => updateEp({ path: e.target.value })}
                      />
                    ) : (
                      <code className="api-path-view">{selectedEp.path}</code>
                    )}
                  </div>
                  <div className="api-workbench-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-icon"
                      aria-label="Copy path"
                      title="Copy path"
                      leftIcon={
                        copied ? (
                          <Check size={13} weight="bold" aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )
                      }
                      onClick={() => void copy(selectedEp.path)}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="api-delete-btn"
                        aria-label="Delete endpoint"
                        title="Delete endpoint"
                        leftIcon={<Trash size={13} aria-hidden="true" />}
                        onClick={() => setDeleteTarget({ kind: 'endpoint', id: selectedEp.id, name: selectedEp.name })}
                      />
                    )}
                  </div>
                </div>

                <div className="api-editor">
                  <Input
                    label="Name"
                    value={selectedEp.name}
                    onChange={(e) => updateEp({ name: e.target.value })}
                  />
                  <Textarea
                    label="Description"
                    rows={2}
                    placeholder="What does this endpoint do?"
                    value={selectedEp.description}
                    onChange={(e) => updateEp({ description: e.target.value })}
                  />

                  <div className="tabs mt-4" role="tablist" aria-label="Endpoint details">
                    {(['headers', 'params', 'body', 'responses'] as ApiTab[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={tab === t}
                        className={`tab ${tab === t ? 'tab-active' : ''}`}
                        onClick={() => setTab(t)}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                        {t !== 'body' && selectedEp[t].length > 0 && (
                          <span className="tab-count">{selectedEp[t].length}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {tab === 'headers' && (
                    <div className="api-rows">
                      <div className="api-col-labels api-kv-grid">
                        <span>Key</span>
                        <span>Value</span>
                        <span>Description</span>
                        <span />
                      </div>
                      {selectedEp.headers.map((h, i) => (
                        <div key={i} className="api-kv-grid">
                          <input
                            className="input"
                            aria-label={`Header ${i + 1} key`}
                            placeholder="X-Api-Key"
                            value={h.key}
                            onChange={(e) => updateHeader(i, { key: e.target.value })}
                          />
                          <input
                            className="input api-mono-input"
                            aria-label={`Header ${i + 1} value`}
                            placeholder="value"
                            value={h.value}
                            onChange={(e) => updateHeader(i, { value: e.target.value })}
                          />
                          <input
                            className="input"
                            aria-label={`Header ${i + 1} description`}
                            placeholder="What is it for?"
                            value={h.description}
                            onChange={(e) => updateHeader(i, { description: e.target.value })}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="btn-icon api-row-remove"
                            aria-label="Remove header"
                            leftIcon={<Trash size={13} aria-hidden="true" />}
                            onClick={() => updateEp({ headers: selectedEp.headers.filter((_, idx) => idx !== i) })}
                          />
                        </div>
                      ))}
                      {selectedEp.headers.length === 0 && (
                        <p className="api-rows-empty">No headers yet.</p>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => updateEp({ headers: [...selectedEp.headers, { key: '', value: '', description: '' }] })}>
                        Add header
                      </Button>
                    </div>
                  )}

                  {tab === 'params' && (
                    <div className="api-rows">
                      <div className="api-col-labels api-param-grid">
                        <span>Name</span>
                        <span>In</span>
                        <span className="api-req-label">Required</span>
                        <span>Description</span>
                        <span />
                      </div>
                      {selectedEp.params.map((p, i) => (
                        <div key={i} className="api-param-grid">
                          <input
                            className="input"
                            aria-label={`Param ${i + 1} name`}
                            placeholder="user_id"
                            value={p.name}
                            onChange={(e) => updateParam(i, { name: e.target.value })}
                          />
                          <select
                            className="select"
                            aria-label={`Param ${i + 1} location`}
                            value={p.in}
                            onChange={(e) => updateParam(i, { in: e.target.value as ApiParam['in'] })}
                          >
                            <option value="path">path</option>
                            <option value="query">query</option>
                          </select>
                          <label className="api-check">
                            <input
                              type="checkbox"
                              checked={p.required}
                              aria-label={`Param ${i + 1} required`}
                              onChange={(e) => updateParam(i, { required: e.target.checked })}
                            />
                          </label>
                          <input
                            className="input"
                            aria-label={`Param ${i + 1} description`}
                            placeholder="What is it?"
                            value={p.description}
                            onChange={(e) => updateParam(i, { description: e.target.value })}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="btn-icon api-row-remove"
                            aria-label="Remove param"
                            leftIcon={<Trash size={13} aria-hidden="true" />}
                            onClick={() => updateEp({ params: selectedEp.params.filter((_, idx) => idx !== i) })}
                          />
                        </div>
                      ))}
                      {selectedEp.params.length === 0 && <p className="api-rows-empty">No params yet.</p>}
                      <Button variant="ghost" size="sm" onClick={() => updateEp({ params: [...selectedEp.params, { name: '', in: 'query', required: false, description: '' }] })}>
                        Add param
                      </Button>
                    </div>
                  )}

                  {tab === 'body' && (
                    <div className="api-rows">
                      <Textarea
                        label="Request body"
                        rows={12}
                        className="api-mono-input"
                        placeholder={'{\n  "name": "Ada"\n}'}
                        helper="JSON body example. Sent only when the method supports a body."
                        value={selectedEp.body}
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
                                Status
                              </label>
                              <input
                                id={`resp-status-${i}`}
                                className="input api-mono-input"
                                type="number"
                                min={100}
                                max={599}
                                placeholder="200"
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
                                Content type
                              </label>
                              <input
                                id={`resp-type-${i}`}
                                className="input"
                                placeholder="application/json"
                                value={r.contentType}
                                onChange={(e) => updateResponse(i, { contentType: e.target.value })}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="btn-icon api-row-remove"
                              aria-label="Remove response"
                              leftIcon={<Trash size={13} aria-hidden="true" />}
                              onClick={() => updateEp({ responses: selectedEp.responses.filter((_, idx) => idx !== i) })}
                            />
                          </div>
                          <Input
                            label="Description"
                            placeholder="e.g. User found"
                            value={r.description}
                            onChange={(e) => updateResponse(i, { description: e.target.value })}
                          />
                          <Textarea
                            label="Response body"
                            rows={4}
                            className="api-mono-input"
                            placeholder={'{\n  "id": "1"\n}'}
                            value={r.body}
                            onChange={(e) => updateResponse(i, { body: e.target.value })}
                          />
                        </div>
                      ))}
                      {selectedEp.responses.length === 0 && <p className="api-rows-empty">No responses documented.</p>}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateEp({
                            responses: [...selectedEp.responses, { status: 200, contentType: '', description: '', body: '' }],
                          })
                        }
                      >
                        Add response
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <EndpointDocs endpoint={selectedEp} />
            )}
            <h4 className="detail-subtitle">Activity</h4>
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
                      aria-label="Collection name"
                      onChange={(e) => dispatch({ type: 'apiCollection/update', id: selectedColl.id, patch: { name: e.target.value } })}
                    />
                  ) : (
                    <h2 className="preview-title">{selectedColl.name}</h2>
                  )}
                  <span className="api-tree-count">{endpointCount(selectedColl.id)}</span>
                </div>
                <div className="api-workbench-actions">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="api-delete-btn"
                      aria-label="Delete collection"
                      title="Delete collection"
                      leftIcon={<Trash size={13} aria-hidden="true" />}
                      onClick={() => setDeleteTarget({ kind: 'collection', id: selectedColl.id, name: selectedColl.name })}
                    />
                  )}
                </div>
              </div>
              {canEdit ? (
                <Textarea
                  label="Description"
                  rows={3}
                  placeholder="What does this collection group?"
                  value={selectedColl.description}
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
                      </div>
                    </button>
                  ))}
                {endpoints.filter((e) => e.collectionId === selectedColl.id).length === 0 && (
                  <p className="api-rows-empty">No endpoints in this collection yet.</p>
                )}
              </div>
              <h4 className="detail-subtitle">Activity</h4>
              <ActivityList projectId={projectId} entity="apiCollections" entityId={selectedColl.id} />
            </div>
          ) : (
            emptyWorkbench
          )}
        </main>
        </div>
      )}

      {showCollection && <CollectionModal onClose={() => setShowCollection(false)} onCreated={onCreatedCollection} />}
      {showEndpoint && (
        <EndpointModal onClose={() => setShowEndpoint(false)} onCreated={onCreatedEndpoint} collections={collections} />
      )}

      <Modal
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.kind === 'collection' ? 'collection' : 'endpoint'}`}
        onClose={() => setDeleteTarget(null)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onDeleteTarget}>
              Delete
            </Button>
          </>
        }
      >
        <p className="modal-copy">
          {deleteTarget?.kind === 'collection'
            ? `This deletes “${deleteTarget.name}”. Its endpoints move to Ungrouped.`
            : `This permanently deletes “${deleteTarget?.name}”.`}
        </p>
      </Modal>
    </div>
  );
}