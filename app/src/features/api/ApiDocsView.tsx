import { Folder, Plugs, Plus, UploadSimple } from '@phosphor-icons/react';
import type { ApiCollection, ApiEndpoint } from '../../lib/types';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DocsToc, DocsTocMobile, type DocsTocItem } from '../docs/DocsToc';
import { EndpointDocs } from './EndpointDocs';

interface ApiDocsViewProps {
  projectName: string;
  projectDescription: string;
  collections: ApiCollection[];
  endpoints: ApiEndpoint[];
  canEdit: boolean;
  onNewEndpoint: () => void;
  onImport: () => void;
}

function methodLabel(ep: ApiEndpoint): string {
  return `${ep.method} ${ep.name}`;
}

export function ApiDocsView({
  projectName,
  projectDescription,
  collections,
  endpoints,
  canEdit,
  onNewEndpoint,
  onImport,
}: ApiDocsViewProps) {
  const ungrouped = endpoints.filter((e) => !e.collectionId);

  const tocItems: DocsTocItem[] = [];
  tocItems.push({ id: 'api-overview', label: 'Overview' });
  for (const c of collections) {
    const children = endpoints
      .filter((e) => e.collectionId === c.id)
      .map((e) => ({ id: e.id, label: methodLabel(e) }));
    tocItems.push({ id: c.id, label: c.name, children });
  }
  if (ungrouped.length > 0) {
    tocItems.push({
      id: 'api-ungrouped',
      label: 'Ungrouped',
      children: ungrouped.map((e) => ({ id: e.id, label: methodLabel(e) })),
    });
  }

  if (collections.length === 0 && endpoints.length === 0) {
    return (
      <div className="api-docs-empty">
        <EmptyState
          icon={<Plugs size={22} />}
          title="No API documentation yet"
          description="Document your API: describe collections and endpoints, then export as an OpenAPI 3.0 document."
          action={
            canEdit && (
              <div className="api-empty-actions">
                <Button size="sm" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} onClick={onNewEndpoint}>
                  New endpoint
                </Button>
                <Button size="sm" variant="outline" leftIcon={<UploadSimple size={13} aria-hidden="true" />} onClick={onImport}>
                  Import OpenAPI
                </Button>
              </div>
            )
          }
        />
      </div>
    );
  }

  const endpointCount = (collection: ApiCollection) =>
    endpoints.filter((e) => e.collectionId === collection.id).length;

  return (
    <div className="api-docs docs-grid">
      <div className="docs-main">
        <DocsTocMobile items={tocItems} />
        <section id="api-overview" className="docs-section api-docs-overview">
          <h2 className="preview-title">{projectName} API</h2>
          {projectDescription && <p className="preview-body mt-8">{projectDescription}</p>}
          <p className="api-toolbar-count mt-8">
            {collections.length} collection{collections.length === 1 ? '' : 's'} · {endpoints.length} endpoint{endpoints.length === 1 ? '' : 's'}
          </p>
        </section>

        {collections.map((c) => (
          <section key={c.id} id={c.id} className="docs-section api-docs-group">
            <h3 className="api-docs-group-title">{c.name}</h3>
            {c.description && <p className="preview-body">{c.description}</p>}
            <span className="api-tree-count">{endpointCount(c)} endpoint{endpointCount(c) === 1 ? '' : 's'}</span>
            <div className="api-docs-group-body">
              {endpoints
                .filter((e) => e.collectionId === c.id)
                .map((e) => (
                  <div key={e.id} id={e.id} className="api-docs-endpoint-anchor">
                    <EndpointDocs endpoint={e} />
                  </div>
                ))}
            </div>
          </section>
        ))}

        {ungrouped.length > 0 && (
          <section id="api-ungrouped" className="docs-section api-docs-group">
            <h3 className="api-docs-group-title">
              <Folder size={14} className="api-tree-folder" aria-hidden="true" />
              Ungrouped
            </h3>
            <span className="api-tree-count">{ungrouped.length} endpoint{ungrouped.length === 1 ? '' : 's'}</span>
            <div className="api-docs-group-body">
              {ungrouped.map((e) => (
                <div key={e.id} id={e.id} className="api-docs-endpoint-anchor">
                  <EndpointDocs endpoint={e} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <DocsToc items={tocItems} />
    </div>
  );
}