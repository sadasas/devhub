import type { State } from '../schema/state.js';

export interface SearchHit {
  entity: keyof State & string;
  entityId: string;
  title: string;
  field: string;
  snippet: string;
  score: number;
}

export interface FieldSpec {
  path: string;
  weight: number;
}

export interface ExtraText {
  text: string;
  weight: number;
}

interface EntitySpec {
  key: keyof State;
  titleField: string;
  fields: FieldSpec[];
  deriveTitle?: (item: Record<string, unknown>, state: State) => string;
  extraCollector?: (item: Record<string, unknown>, state: State) => ExtraText[];
}

function relationsDeriveTitle(item: Record<string, unknown>, state: State): string {
  const fromTableId = String(item.fromTableId ?? '');
  const toTableId = String(item.toTableId ?? '');
  const tables = (state.tables ?? []) as Array<{ id: string; name?: string }>;
  const fromName = tables.find((t) => t.id === fromTableId)?.name ?? fromTableId;
  const toName = tables.find((t) => t.id === toTableId)?.name ?? toTableId;
  return `${fromName}.${String(item.fromColumnId ?? '')} → ${toName}.${String(item.toColumnId ?? '')}`;
}

export const SEARCH_ENTITIES: EntitySpec[] = [
  {
    key: 'tasks',
    titleField: 'title',
    fields: [
      { path: 'title', weight: 3 },
      { path: 'description', weight: 1 },
      { path: 'labels', weight: 1 },
    ],
  },
  {
    key: 'issues',
    titleField: 'title',
    fields: [
      { path: 'title', weight: 3 },
      { path: 'description', weight: 1 },
      { path: 'reproduction', weight: 1 },
    ],
  },
  {
    key: 'testCases',
    titleField: 'name',
    fields: [
      { path: 'name', weight: 3 },
      { path: 'steps', weight: 1 },
      { path: 'expected', weight: 1 },
    ],
  },
  {
    key: 'decisions',
    titleField: 'title',
    fields: [
      { path: 'title', weight: 3 },
      { path: 'context', weight: 1 },
      { path: 'options', weight: 1 },
      { path: 'decision', weight: 1 },
      { path: 'consequences', weight: 1 },
    ],
  },
  {
    key: 'techEntries',
    titleField: 'name',
    fields: [
      { path: 'name', weight: 3 },
      { path: 'version', weight: 1 },
      { path: 'notes', weight: 1 },
    ],
  },
  {
    key: 'apiEndpoints',
    titleField: 'name',
    fields: [
      { path: 'name', weight: 3 },
      { path: 'path', weight: 3 },
      { path: 'description', weight: 1 },
      { path: 'method', weight: 1 },
    ],
  },
  {
    key: 'apiCollections',
    titleField: 'name',
    fields: [
      { path: 'name', weight: 3 },
      { path: 'description', weight: 1 },
    ],
  },
  {
    key: 'milestones',
    titleField: 'name',
    fields: [
      { path: 'name', weight: 3 },
      { path: 'changelog', weight: 1 },
    ],
  },
  {
    key: 'whiteboards',
    titleField: 'name',
    fields: [
      { path: 'name', weight: 3 },
      { path: 'description', weight: 1 },
    ],
    extraCollector: (item, state) => {
      const out: ExtraText[] = [];
      const elements = Array.isArray(item.elements) ? item.elements : [];
      for (const el of elements as Array<Record<string, unknown>>) {
        if (el.kind === 'sticky' || el.kind === 'text') {
          if (typeof el.text === 'string' && el.text) out.push({ text: el.text, weight: 1 });
        } else if (el.kind === 'shape') {
          if (typeof el.label === 'string' && el.label) out.push({ text: el.label, weight: 1 });
        } else if (el.kind === 'ref') {
          const entity = el.entity === 'issues' ? 'issues' : 'tasks';
          const entityId = typeof el.entityId === 'string' ? el.entityId : '';
          if (entityId) {
            const rows = (state[entity] ?? []) as Array<{ id: string; title?: string }>;
            const title = rows.find((r) => r.id === entityId)?.title;
            if (title) out.push({ text: title, weight: 1 });
          }
        }
      }
      return out;
    },
  },
  {
    key: 'tables',
    titleField: 'name',
    fields: [{ path: 'name', weight: 3 }],
  },
  {
    key: 'relations',
    titleField: 'name',
    fields: [],
    deriveTitle: relationsDeriveTitle,
    extraCollector: (item, state) => {
      const derived = relationsDeriveTitle(item, state);
      return derived ? [{ text: derived, weight: 3 }] : [];
    },
  },
  {
    key: 'schemaVersions',
    titleField: 'version',
    fields: [{ path: 'version', weight: 3 }],
    deriveTitle: (item) => (typeof item.version === 'string' ? item.version : ''),
  },
];

export const DEFAULT_LIMIT = 50;
export const PROJECT_HIT_LIMIT = 20;
export const ENTITY_HIT_LIMIT = 5;

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (value.length > 0) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, out);
    }
  }
}

function makeSnippet(value: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(value.length, index + length + 30);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < value.length ? '…' : '';
  return prefix + value.slice(start, end) + suffix;
}

function scoreString(
  value: string,
  query: string,
  weight: number,
): { score: number; snippet: string } | null {
  const haystack = value.toLowerCase();
  const needle = query.toLowerCase();
  if (haystack === needle) return { score: weight * 10, snippet: value };
  if (haystack.startsWith(needle)) return { score: weight * 5, snippet: value };
  const index = haystack.indexOf(needle);
  if (index === -1) return null;
  return { score: weight * 2, snippet: makeSnippet(value, index, needle.length) };
}

function compareHits(a: SearchHit, b: SearchHit): number {
  if (b.score !== a.score) return b.score - a.score;
  return (
    a.title.localeCompare(b.title) ||
    a.entity.localeCompare(b.entity) ||
    a.entityId.localeCompare(b.entityId)
  );
}

export function searchState(state: State, query: string, perEntityLimit = ENTITY_HIT_LIMIT): SearchHit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const spec of SEARCH_ENTITIES) {
    const items = (state[spec.key] ?? []) as unknown as Array<Record<string, unknown>>;
    const entityHits: SearchHit[] = [];
    for (const item of items) {
      const title = spec.deriveTitle
        ? spec.deriveTitle(item, state)
        : typeof item[spec.titleField] === 'string'
          ? (item[spec.titleField] as string)
          : '';
      const entityId = typeof item.id === 'string' ? item.id : '';
      for (const field of spec.fields) {
        const strings: string[] = [];
        collectStrings(item[field.path], strings);
        let best: { score: number; snippet: string } | null = null;
        for (const candidate of strings) {
          const result = scoreString(candidate, q, field.weight);
          if (result && (!best || result.score > best.score)) best = result;
        }
        if (best) {
          entityHits.push({
            entity: spec.key,
            entityId,
            title,
            field: field.path,
            snippet: best.snippet,
            score: best.score,
          });
        }
      }
      if (spec.extraCollector) {
        const extra = spec.extraCollector(item, state);
        let best: { score: number; snippet: string } | null = null;
        for (const candidate of extra) {
          const result = scoreString(candidate.text, q, candidate.weight);
          if (result && (!best || result.score > best.score)) best = result;
        }
        if (best) {
          entityHits.push({
            entity: spec.key,
            entityId,
            title,
            field: 'elements',
            snippet: best.snippet,
            score: best.score,
          });
        }
      }
    }
    entityHits.sort(compareHits);
    hits.push(...entityHits.slice(0, perEntityLimit));
  }
  hits.sort(compareHits);
  return hits;
}
