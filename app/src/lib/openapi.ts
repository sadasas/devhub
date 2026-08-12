/* OpenAPI 3.0/3.1 <-> DevHub API docs converter (client-side).
   toOpenApi:   state -> OpenAPI 3.0.3 YAML document.
   fromOpenApi: parse YAML or JSON (3.0/3.1) -> apiCollections + apiEndpoints. */

import { parse, stringify } from 'yaml';
import type { ApiCollection, ApiEndpoint, ApiMethod, State } from './types';
import { newId } from './utils';

const METHODS: ApiMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function parseMaybeJson(body: string): string | unknown {
  const trimmed = body.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return body;
  }
}

function toExampleString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  return JSON.stringify(value, null, 2);
}

export function toOpenApi(
  state: State,
  info: { name: string; description: string },
): string {
  const byId = new Map(state.apiCollections.map((c) => [c.id, c]));
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of state.apiEndpoints) {
    const operation: Record<string, unknown> = { summary: endpoint.name };
    if (endpoint.description) operation.description = endpoint.description;

    const collection = endpoint.collectionId ? byId.get(endpoint.collectionId) : undefined;
    if (collection) operation.tags = [collection.name];

    const parameters: Record<string, unknown>[] = [];
    for (const p of endpoint.params) {
      parameters.push({
        name: p.name,
        in: p.in,
        required: p.required || undefined,
        description: p.description || undefined,
        schema: { type: 'string' },
      });
    }
    for (const h of endpoint.headers) {
      parameters.push({
        name: h.key,
        in: 'header',
        description: h.description || undefined,
        example: h.value || undefined,
        schema: { type: 'string' },
      });
    }
    if (parameters.length > 0) operation.parameters = parameters;

    const hasBodyMethod = endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH';
    if (hasBodyMethod && endpoint.body) {
      operation.requestBody = {
        content: { 'application/json': { example: parseMaybeJson(endpoint.body) } },
      };
    }

    const responses: Record<string, unknown> = {};
    if (endpoint.responses.length === 0) {
      responses['200'] = { description: 'Success' };
    } else {
      for (const r of endpoint.responses) {
        const response: Record<string, unknown> = {
          description: r.description || '',
        };
        if (r.contentType) {
          response.content = { [r.contentType]: { example: parseMaybeJson(r.body) } };
        }
        responses[String(r.status)] = response;
      }
    }
    operation.responses = responses;

    paths[endpoint.path] = {
      ...(paths[endpoint.path] ?? {}),
      [endpoint.method.toLowerCase()]: operation,
    };
  }

  const doc = {
    openapi: '3.0.3',
    info: {
      title: info.name,
      version: '0.1.0',
      ...(info.description ? { description: info.description } : {}),
    },
    tags: state.apiCollections.map((c) => ({
      name: c.name,
      ...(c.description ? { description: c.description } : {}),
    })),
    paths,
  };
  return stringify(doc);
}

export interface ImportedApi {
  collections: ApiCollection[];
  endpoints: ApiEndpoint[];
}

export function parseOpenApi(input: string): unknown {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('File is empty');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid JSON document');
    }
  }
  try {
    return parse(trimmed);
  } catch {
    throw new Error('Invalid YAML document');
  }
}

export function fromOpenApi(input: string | unknown): ImportedApi {
  const doc = (typeof input === 'string' ? parseOpenApi(input) : input) as Record<string, unknown>;
  if (typeof doc !== 'object' || doc === null || typeof doc.paths !== 'object' || doc.paths === null) {
    throw new Error('Not an OpenAPI document: missing top-level "paths"');
  }
  const now = new Date().toISOString();
  const collections: ApiCollection[] = [];
  const tagToId = new Map<string, string>();

  if (Array.isArray(doc.tags)) {
    for (const raw of doc.tags) {
      if (typeof raw !== 'object' || raw === null) continue;
      const tag = raw as Record<string, unknown>;
      const name = typeof tag.name === 'string' ? tag.name.trim().slice(0, 200) : '';
      if (!name) continue;
      const id = newId();
      tagToId.set(name, id);
      collections.push({
        id,
        createdAt: now,
        updatedAt: now,
        name,
        description: typeof tag.description === 'string' ? tag.description.slice(0, 2_000) : '',
      });
    }
  }

  const endpoints: ApiEndpoint[] = [];
  const paths = doc.paths as Record<string, Record<string, unknown>>;
  for (const [path, pathItem] of Object.entries(paths)) {
    if (typeof pathItem !== 'object' || pathItem === null) continue;
    for (const method of METHODS) {
      const operation = pathItem[method.toLowerCase()];
      if (typeof operation !== 'object' || operation === null) continue;
      const op = operation as Record<string, unknown>;

      const tagNames: string[] = Array.isArray(op.tags)
        ? (op.tags.filter((t): t is string => typeof t === 'string'))
        : [];
      const ownTags = tagNames.filter((name) => tagToId.has(name));
      const firstTag = ownTags[0];
      const collectionId = firstTag ? (tagToId.get(firstTag) ?? null) : null;

      const params: ApiEndpoint['params'] = [];
      const headers: ApiEndpoint['headers'] = [];
      if (Array.isArray(op.parameters)) {
        for (const raw of op.parameters) {
          if (typeof raw !== 'object' || raw === null) continue;
          const p = raw as Record<string, unknown>;
          const name = typeof p.name === 'string' ? p.name.trim().slice(0, 200) : '';
          if (!name) continue;
          if (p.in === 'header') {
            headers.push({
              key: name,
              value: typeof p.example === 'string' ? p.example.slice(0, 2_000) : '',
              description: typeof p.description === 'string' ? p.description.slice(0, 2_000) : '',
            });
            continue;
          }
          const inValue = p.in === 'query' ? 'query' : 'path';
          params.push({
            name,
            in: inValue,
            required: p.required === true,
            description: typeof p.description === 'string' ? p.description.slice(0, 2_000) : '',
          });
        }
      }

      const body = extractBody(op.requestBody);
      const responses = extractResponses(op.responses);

      const summary = typeof op.summary === 'string' ? op.summary.trim().slice(0, 200) : '';
      const description =
        typeof op.description === 'string' ? op.description.slice(0, 10_000) : '';

      endpoints.push({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        collectionId,
        method,
        path: path.slice(0, 500) || '/',
        name: summary || `${method} ${path}`,
        description,
        headers,
        params,
        body,
        responses,
      });
    }
  }

  return { collections, endpoints };
}

function extractBody(requestBody: unknown): string {
  if (typeof requestBody !== 'object' || requestBody === null) return '';
  const body = requestBody as Record<string, unknown>;
  const content = body.content;
  if (typeof content !== 'object' || content === null) return '';
  const entries = Object.entries(content as Record<string, unknown>);
  if (entries.length === 0) return '';
  const sorted = entries.sort(([a], [b]) => (b === 'application/json' ? 1 : 0) - (a === 'application/json' ? 1 : 0));
  const first = sorted[0];
  if (!first) return '';
  const media = first[1];
  if (typeof media !== 'object' || media === null) return '';
  const m = media as Record<string, unknown>;
  return toExampleString(m.example).slice(0, 50_000);
}

function extractResponses(responses: unknown): ApiEndpoint['responses'] {
  if (typeof responses !== 'object' || responses === null) return [];
  const out: ApiEndpoint['responses'] = [];
  for (const [code, raw] of Object.entries(responses as Record<string, unknown>)) {
    const status = Number(code);
    if (!Number.isInteger(status) || status < 100 || status > 599) continue;
    if (typeof raw !== 'object' || raw === null) continue;
    const resp = raw as Record<string, unknown>;
    let contentType = '';
    let body = '';
    const content = resp.content;
    if (typeof content === 'object' && content !== null) {
      const entries = Object.entries(content as Record<string, unknown>);
      const first = entries[0];
      if (first) {
        contentType = first[0].slice(0, 100);
        const media = first[1];
        if (typeof media === 'object' && media !== null) {
          body = toExampleString((media as Record<string, unknown>).example).slice(0, 50_000);
        }
      }
    }
    out.push({
      status,
      contentType,
      description: typeof resp.description === 'string' ? resp.description.slice(0, 5_000) : '',
      body,
    });
  }
  out.sort((a, b) => a.status - b.status);
  return out;
}