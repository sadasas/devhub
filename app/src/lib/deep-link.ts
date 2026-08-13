import type { GranularEntity } from './api';

const ENTITY_TAB: Record<string, string> = {
  tasks: 'board',
  issues: 'issues',
  testCases: 'tests',
  techEntries: 'stack',
  tables: 'schema',
  relations: 'schema',
  schemaVersions: 'schema',
  decisions: 'decisions',
  milestones: 'releases',
  apiCollections: 'api',
  apiEndpoints: 'api',
};

export function entityTab(entity: GranularEntity): string {
  return ENTITY_TAB[entity] ?? 'board';
}

export function entityDeepLink(projectId: string, entity: GranularEntity, entityId: string): string {
  const params = new URLSearchParams({ tab: entityTab(entity), entity, id: entityId });
  return `/project/${encodeURIComponent(projectId)}?${params.toString()}`;
}