import { describe, expect, it } from 'vitest';
import { fromOpenApi, toOpenApi } from './openapi';
import type { ApiCollection, ApiEndpoint, State } from './types';

const NOW = '2026-08-12T00:00:00.000Z';

function collection(id: string, name: string): ApiCollection {
  return { id, name, description: 'Users resource', createdAt: NOW, updatedAt: NOW };
}

function base(id: string): Pick<ApiEndpoint, 'id' | 'createdAt' | 'updatedAt'> {
  return { id, createdAt: NOW, updatedAt: NOW };
}

function fixtureState(): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [collection('col-1', 'Users')],
    apiEndpoints: [
      {
        ...base('ep-1'),
        collectionId: 'col-1',
        method: 'GET',
        path: '/users/{id}',
        name: 'Get user',
        description: 'Returns a single user by id',
        headers: [{ key: 'X-Trace', value: 'abc', description: 'Trace id' }],
        params: [
          { name: 'id', in: 'path', required: true, description: 'User id' },
          { name: 'include', in: 'query', required: false, description: 'Extra fields' },
        ],
        body: '',
        responses: [
          { status: 200, contentType: 'application/json', description: 'Found', body: '{"id":"1","name":"Ada"}' },
          { status: 404, contentType: '', description: 'Not found', body: '' },
        ],
      },
      {
        ...base('ep-2'),
        collectionId: 'col-1',
        method: 'POST',
        path: '/users',
        name: 'Create user',
        description: '',
        headers: [],
        params: [],
        body: '{"name":"Ada"}',
        responses: [{ status: 201, contentType: 'application/json', description: 'Created', body: '{"id":"2"}' }],
      },
      {
        ...base('ep-3'),
        collectionId: null,
        method: 'DELETE',
        path: '/users/{id}',
        name: 'Delete user',
        description: 'Deletes a user',
        headers: [],
        params: [{ name: 'id', in: 'path', required: true, description: '' }],
        body: '',
        responses: [{ status: 204, contentType: '', description: 'No content', body: '' }],
      },
    ],
  };
}

describe('toOpenApi', () => {
  it('produces valid YAML with tags and methods', () => {
    const yaml = toOpenApi(fixtureState(), { name: 'My API', description: 'Test project' });
    expect(yaml).toContain('openapi: 3.0.3');
    expect(yaml).toContain('name: Users');
    expect(yaml).toContain('get:');
    expect(yaml).toContain('post:');
    expect(yaml).toContain('delete:');
    expect(yaml).toContain('/users/{id}');
  });
});

describe('fromOpenApi', () => {
  it('parses JSON documents', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'X', version: '1' },
      tags: [{ name: 'Pets', description: 'Pet store' }],
      paths: {
        '/pets': {
          get: {
            summary: 'List pets',
            tags: ['Pets'],
            parameters: [{ name: 'limit', in: 'query', required: false }],
            responses: { '200': { description: 'ok', content: { 'application/json': { example: [{ name: 'Rex' }] } } } },
          },
        },
      },
    };
    const { collections, endpoints } = fromOpenApi(JSON.stringify(doc));
    expect(collections).toHaveLength(1);
    expect(collections[0]!.name).toBe('Pets');
    expect(collections[0]!.description).toBe('Pet store');
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]!.method).toBe('GET');
    expect(endpoints[0]!.path).toBe('/pets');
    expect(endpoints[0]!.name).toBe('List pets');
    expect(endpoints[0]!.collectionId).toBe(collections[0]!.id);
    expect(endpoints[0]!.params).toEqual([{ name: 'limit', in: 'query', required: false, description: '' }]);
    expect(endpoints[0]!.responses[0]!).toMatchObject({ status: 200, contentType: 'application/json' });
    expect(endpoints[0]!.responses[0]!.body).toContain('Rex');
  });

  it('parses YAML documents (3.1)', () => {
    const yaml = [
      'openapi: 3.1.0',
      'info: {title: Y, version: "2"}',
      'paths:',
      '  /ping:',
      '    post:',
      '      summary: Ping',
      '      requestBody:',
      '        content:',
      '          application/json:',
      '            example: {ok: true}',
      '      responses:',
      '        "200":',
      '          description: pong',
      '        "503":',
      '          description: down',
    ].join('\n');
    const { collections, endpoints } = fromOpenApi(yaml);
    expect(collections).toHaveLength(0);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]!.method).toBe('POST');
    expect(endpoints[0]!.collectionId).toBeNull();
    expect(endpoints[0]!.body).toContain('"ok"');
    expect(endpoints[0]!.responses.map((r) => r.status)).toEqual([200, 503]);
  });

  it('skips unsupported methods like trace', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'X', version: '1' },
      paths: { '/x': { trace: { summary: 'trace' } } },
    };
    const { endpoints } = fromOpenApi(doc);
    expect(endpoints).toHaveLength(0);
  });
});

describe('round-trip', () => {
  it('state -> spec -> state preserves collections and endpoints', () => {
    const state = fixtureState();
    const yaml = toOpenApi(state, { name: 'My API', description: 'Test project' });
    const { collections, endpoints } = fromOpenApi(yaml);

    expect(collections.map((c) => c.name)).toEqual(['Users']);
    expect(endpoints).toHaveLength(3);

    const get = endpoints.find((e) => e.method === 'GET')!;
    expect(get.name).toBe('Get user');
    expect(get.path).toBe('/users/{id}');
    expect(get.description).toBe('Returns a single user by id');
    expect(get.collectionId).toBe(collections[0]!.id);
    expect(get.params).toEqual([
      { name: 'id', in: 'path', required: true, description: 'User id' },
      { name: 'include', in: 'query', required: false, description: 'Extra fields' },
    ]);
    expect(get.responses).toHaveLength(2);
    expect(get.responses[0]).toMatchObject({ status: 200, contentType: 'application/json' });
    expect(JSON.parse(get.responses[0]!.body)).toEqual({ id: '1', name: 'Ada' });

    const post = endpoints.find((e) => e.method === 'POST')!;
    expect(JSON.parse(post.body)).toEqual({ name: 'Ada' });
    expect(post.collectionId).toBe(collections[0]!.id);

    const del = endpoints.find((e) => e.method === 'DELETE')!;
    expect(del.collectionId).toBeNull();
    expect(del.responses[0]!.status).toBe(204);
    expect(del.responses[0]!.body).toBe('');
  });
});