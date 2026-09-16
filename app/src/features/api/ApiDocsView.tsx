import { useState } from 'react';
import { Plugs, Plus, UploadSimple, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { ApiCollection, ApiEndpoint, Milestone } from '../../lib/types';
import { formatDate, matchesApiEndpoint } from '../../lib/utils';
import { FE_LIMITS } from '../../lib/limits';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DocsToc, DocsTocMobile, type DocsTocItem } from '../docs/DocsToc';
import { EndpointDocs } from './EndpointDocs';

interface ApiDocsViewProps {
  projectName: string;
  projectDescription: string;
  collections: ApiCollection[];
  endpoints: ApiEndpoint[];
  milestones?: Milestone[];
  canEdit: boolean;
  onNewEndpoint: () => void;
  onImport: () => void;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'endpoint';
}

/**
 * Stable human-readable anchor ids, deduplicated with -2/-3 suffixes.
 * Built from the full endpoint list so hashes survive filtering.
 */
function buildAnchors(endpoints: ApiEndpoint[]): Map<string, string> {
  const taken = new Set<string>();
  const map = new Map<string, string>();
  for (const e of endpoints) {
    const base = `ep-${e.method.toLowerCase()}-${slugify(e.path)}`;
    let id = base;
    let n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    taken.add(id);
    map.set(e.id, id);
  }
  return map;
}

function buildCollectionAnchors(collections: ApiCollection[]): Map<string, string> {
  const taken = new Set<string>(['api-overview', 'api-ungrouped']);
  const map = new Map<string, string>();
  for (const c of collections) {
    const base = `col-${slugify(c.name)}`;
    let id = base;
    let n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    taken.add(id);
    map.set(c.id, id);
  }
  return map;
}

function methodLabel(ep: ApiEndpoint): string {
  return `${ep.method} ${ep.path}`;
}

export function ApiDocsView({
  projectName,
  projectDescription,
  collections,
  endpoints,
  milestones = [],
  canEdit,
  onNewEndpoint,
  onImport,
}: ApiDocsViewProps) {
  const { t } = useTranslation('extras');
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const anchors = buildAnchors(endpoints);
  const collectionAnchors = buildCollectionAnchors(collections);

  const visibleEndpointIds = new Set(
    endpoints.filter((e) => matchesApiEndpoint(e, query)).map((e) => e.id),
  );
  const visibleCollections = query
    ? collections.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          endpoints.some((e) => e.collectionId === c.id && visibleEndpointIds.has(e.id)),
      )
    : collections;

  function endpointsFor(collectionId: string | null): ApiEndpoint[] {
    const inScope = endpoints.filter((e) =>
      collectionId ? e.collectionId === collectionId : !e.collectionId,
    );
    if (!query) return inScope;
    const matched = inScope.filter((e) => visibleEndpointIds.has(e.id));
    if (matched.length > 0) return matched;
    // Collection name matched but none of its endpoints did → show the whole group.
    if (collectionId) {
      const c = collections.find((x) => x.id === collectionId);
      if (c && c.name.toLowerCase().includes(query)) return inScope;
    }
    return matched;
  }

  const shownUngrouped = endpointsFor(null);
  const shownCount =
    visibleCollections.reduce((n, c) => n + endpointsFor(c.id).length, 0) +
    shownUngrouped.length;

  const latestVersion =
    [...milestones].reverse().find((m) => m.status === 'released' && m.version)?.version ?? null;

  const tocItems: DocsTocItem[] = [];
  tocItems.push({ id: 'api-overview', label: t('api.docs.overview') });
  for (const c of visibleCollections) {
    const children = endpointsFor(c.id).map((e) => ({
      id: anchors.get(e.id) ?? e.id,
      label: methodLabel(e),
    }));
    tocItems.push({ id: collectionAnchors.get(c.id) ?? c.id, label: c.name, children });
  }
  if (shownUngrouped.length > 0) {
    tocItems.push({
      id: 'api-ungrouped',
      label: t('api.tree.ungrouped'),
      children: shownUngrouped.map((e) => ({
        id: anchors.get(e.id) ?? e.id,
        label: methodLabel(e),
      })),
    });
  }

  if (collections.length === 0 && endpoints.length === 0) {
    return (
      <div className="api-docs-empty">
        <EmptyState
          icon={<Plugs size={22} />}
          title={t('api.docs.emptyTitle')}
          description={canEdit ? t('api.empty.editorDesc') : undefined}
          action={
            canEdit && (
              <div className="api-empty-actions">
                <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={onNewEndpoint}>
                  {t('api.toolbar.newEndpoint')}
                </Button>
                <Button size="sm" variant="outline" leftIcon={<UploadSimple size={14} aria-hidden="true" />} onClick={onImport}>
                  {t('api.toolbar.import')}
                </Button>
              </div>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="api-docs docs-grid">
      <div className="docs-main">
        <DocsTocMobile items={tocItems} />
        <div className="api-docs-search">
          <div className="api-search-wrap api-docs-search-wrap">
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
              {t('api.sidebar.results', { count: shownCount })}
            </p>
          )}
        </div>

        {query && shownCount === 0 ? (
          <div className="api-search-empty">
            <p className="api-sidebar-empty">
              {t('api.sidebar.noResults', { query: search.trim() })}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
              {t('api.sidebar.clearSearch')}
            </Button>
          </div>
        ) : (
          <>
            <div className="api-print-coverpage print-only" aria-hidden="true">
              <h1 className="preview-title">{t('api.docs.overviewTitle', { name: projectName })}</h1>
              {latestVersion && (
                <p className="api-print-cover-version">{t('api.docs.printVersion', { version: latestVersion })}</p>
              )}
              <p className="api-print-cover-meta">
                {t('api.count.collections', { count: collections.length })} · {t('api.count.endpoints', { count: endpoints.length })} · {t('api.docs.printDate', { date: formatDate(new Date().toISOString()) })}
              </p>
            </div>
            <section id="api-overview" className="docs-section api-docs-overview">
              <h2 className="preview-title">{t('api.docs.overviewTitle', { name: projectName })}</h2>
              {projectDescription && <p className="preview-body mt-8">{projectDescription}</p>}
              <p className="api-toolbar-count mt-8">
                {t('api.count.collections', { count: collections.length })} · {t('api.count.endpoints', { count: endpoints.length })}
              </p>
            </section>

            {visibleCollections.map((c) => {
              const eps = endpointsFor(c.id);
              if (eps.length === 0) return null;
              return (
                <section key={c.id} id={collectionAnchors.get(c.id) ?? c.id} className="docs-section api-docs-group">
                  <h3 className="api-docs-group-title">{c.name}</h3>
                  {c.description && <p className="preview-body">{c.description}</p>}
                  <span className="api-tree-count">{t('api.count.endpoints', { count: eps.length })}</span>
                  <div className="api-docs-group-body">
                    {eps.map((e) => (
                      <div key={e.id} id={anchors.get(e.id) ?? e.id} className="api-docs-endpoint-anchor">
                        <EndpointDocs endpoint={e} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            {shownUngrouped.length > 0 && (
              <section id="api-ungrouped" className="docs-section api-docs-group">
                <h3 className="api-docs-group-title">{t('api.tree.ungrouped')}</h3>
                <span className="api-tree-count">{t('api.count.endpoints', { count: shownUngrouped.length })}</span>
                <div className="api-docs-group-body">
                  {shownUngrouped.map((e) => (
                    <div key={e.id} id={anchors.get(e.id) ?? e.id} className="api-docs-endpoint-anchor">
                      <EndpointDocs endpoint={e} />
                    </div>
                  ))}
                </div>
              </section>
            )}

          </>
        )}
      </div>
      <DocsToc items={tocItems} />
    </div>
  );
}
