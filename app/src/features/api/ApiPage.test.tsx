import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ApiCollection, ApiEndpoint, State } from '../../lib/types';
import { ApiPage } from './ApiPage';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  canEdit: true,
  state: null as State | null,
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({
    state: mocks.state,
    loading: false,
    error: null,
    saveError: null,
    saving: false,
    role: 'editor',
    canEdit: mocks.canEdit,
    dispatch: mocks.dispatch,
    setStatus: vi.fn(),
    retrySave: vi.fn(),
  }),
}));

function makeState(over: Partial<State> = {}): State {
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
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
    ...over,
  };
}

const collection: ApiCollection = {
  id: 'c1',
  name: 'Users',
  description: 'The users API',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

const collection2: ApiCollection = {
  ...collection,
  id: 'c2',
  name: 'Billing',
  description: '',
};

const endpoint: ApiEndpoint = {
  id: 'e1',
  collectionId: null,
  method: 'GET',
  path: '/users/:id',
  name: 'Get user',
  description: 'Returns a single user by id',
  headers: [{ key: 'X-Api-Key', value: 'abc', description: 'Trace id' }],
  params: [
    { name: 'id', in: 'path', required: true, description: 'User id' },
    { name: 'include', in: 'query', required: false, description: 'Extra' },
  ],
  body: '',
  responses: [
    { status: 200, contentType: 'application/json', description: 'Found', body: '{"kind":"ok"}' },
    { status: 404, contentType: '', description: 'Not found', body: '' },
  ],
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

function renderPage(unreadIds?: ReadonlySet<string>, initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ApiPage
        projectName="Demo Project"
        projectDescription="A public demo"
        unreadIds={unreadIds}
      />
    </MemoryRouter>,
  );
}

describe('ApiPage', () => {
  beforeEach(() => {
    mocks.state = makeState();
    mocks.canEdit = true;
    mocks.dispatch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a collection via modal and dispatches apiCollection/add', () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'New collection' })[0]!);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Name', { exact: false }), { target: { value: 'Users API' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create collection' }));

    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'apiCollection/add',
        collection: expect.objectContaining({ name: 'Users API' }),
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeTruthy();
  });

  it('shows editor in workspace and full docs view in docs mode', () => {
    mocks.state = makeState({ apiCollections: [collection], apiEndpoints: [endpoint] });
    renderPage();

    expect(screen.getByRole('tab', { name: 'Workspace' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Docs' }).getAttribute('aria-selected')).toBe('false');

    fireEvent.click(screen.getByText('Get user'));
    // read mode first: docs preview + Edit button, no method editor
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.queryByLabelText('HTTP method')).not.toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('HTTP method')).toBeTruthy();
    expect((screen.getByLabelText('Endpoint path') as HTMLInputElement).value).toBe('/users/:id');
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));

    expect(screen.getByRole('heading', { name: 'Demo Project API' })).toBeTruthy();
    expect(screen.getAllByText('1 collection · 1 endpoint').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GET /users/:id').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Get user' })).toBeTruthy();
    expect(screen.getByText('Returns a single user by id')).toBeTruthy();
    expect(screen.getByText('Parameters')).toBeTruthy();
    expect(screen.getByText('X-Api-Key')).toBeTruthy();
    expect(screen.getByText('abc')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('application/json')).toBeTruthy();
    expect(screen.getByText('Found')).toBeTruthy();
    expect(screen.getByText('Not found')).toBeTruthy();
    expect(screen.getByText('{"kind":"ok"}')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ungrouped' })).toBeTruthy();
    expect(screen.queryByLabelText('HTTP method')).not.toBeTruthy();
  });

  it('forces docs mode for viewer role', () => {
    mocks.canEdit = false;
    mocks.state = makeState({ apiCollections: [collection], apiEndpoints: [endpoint] });
    renderPage();

    expect(screen.getByRole('tab', { name: 'Docs' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', { name: 'New endpoint' })).not.toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New collection' })).not.toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Demo Project API' })).toBeTruthy();
    expect(screen.getByText('Returns a single user by id')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Workspace' }));

    expect(screen.getByText('Pick an endpoint from the sidebar to view its documentation.')).toBeTruthy();

    fireEvent.click(screen.getByText('Get user'));

    expect(screen.getByRole('heading', { name: 'Get user' })).toBeTruthy();
    expect(screen.queryByLabelText('HTTP method')).not.toBeTruthy();
    expect(screen.queryByLabelText('Endpoint path')).not.toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeTruthy();
    expect(screen.getByText('Returns a single user by id')).toBeTruthy();
  });

  it('shows docs empty state with actions when there is no API data', () => {
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));

    expect(screen.getByText('No API documentation yet')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'New endpoint' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Import OpenAPI' }).length).toBeGreaterThan(0);
  });

  it('shows collection view and lists its endpoints', () => {
    mocks.state = makeState({ apiCollections: [collection], apiEndpoints: [{ ...endpoint, collectionId: 'c1' }] });
    renderPage();

    fireEvent.click(screen.getByText('Users'));

    expect((screen.getByLabelText('Collection name') as HTMLInputElement).value).toBe('Users');
    expect(screen.getByText('The users API')).toBeTruthy();
    expect(screen.getAllByText('Get user')).toHaveLength(2);
    expect(screen.getAllByText('/users/:id').length).toBeGreaterThan(0);
  });

  it('marks collections and endpoints with an unread dot for ids in unreadIds', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage(new Set(['c1', 'e1']));

    expect(screen.getAllByText('New').length).toBe(2);
    expect(document.querySelectorAll('.unread-pill').length).toBe(2);
  });

  it('renders no unread dots without unreadIds', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    expect(document.querySelectorAll('.unread-pill').length).toBe(0);
  });

  it('auto-expands a collapsed collection on search with count and highlight', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Users' }));
    expect(screen.queryByText('Get user')).not.toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search endpoints'), { target: { value: 'get user' } });

    expect(screen.getByText('1 result')).toBeTruthy();
    expect(screen.getByText('Get user')).toBeTruthy();
    expect(document.querySelector('.api-tree-item-title mark')).toBeTruthy();
  });

  it('matches endpoints by method and description and clears via the clear button', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Search endpoints'), { target: { value: 'single user' } });
    expect(screen.getAllByText('Get user').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Search endpoints'), { target: { value: 'GET' } });
    expect(screen.getByText('1 result')).toBeTruthy();
    expect(document.querySelector('.api-tree-item-title mark')?.textContent).toBe('Get');

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect((screen.getByLabelText('Search endpoints') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeTruthy();
  });

  it('shows a no-results state with a clear action when nothing matches', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Search endpoints'), { target: { value: 'zzz-no-match' } });

    expect(screen.getByText('0 results')).toBeTruthy();
    expect(screen.getByText('No matches for "zzz-no-match".')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear search' })[0]!);
    expect((screen.getByLabelText('Search endpoints') as HTMLInputElement).value).toBe('');
  });

  it('docs search filters with path TOC labels, slug anchors, and h4 endpoint headings', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));

    // TOC labels carry the path (desktop + mobile TOC)
    expect(screen.getAllByText('GET /users/:id').length).toBeGreaterThan(0);
    // collection section renders with its description
    expect(screen.getByText('The users API')).toBeTruthy();
    // human-readable stable anchor
    expect(document.getElementById('ep-get-users-id')).toBeTruthy();
    // heading hierarchy: overview h2 > collection h3 > endpoint h4
    expect(screen.getByRole('heading', { name: 'Get user' }).tagName).toBe('H4');

    fireEvent.change(screen.getByLabelText('Search endpoints'), { target: { value: 'zzz-no-match' } });
    expect(screen.getByText('0 results')).toBeTruthy();
    expect(screen.getByText('No matches for "zzz-no-match".')).toBeTruthy();
    expect(document.getElementById('ep-get-users-id')).not.toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search endpoints'), { target: { value: 'single user' } });
    expect(screen.getByText('1 result')).toBeTruthy();
    expect(document.getElementById('ep-get-users-id')).toBeTruthy();
  });

  it('workbench opens in read mode; Cancel discards edits', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByText('Get user'));
    expect(screen.getByRole('heading', { name: 'Get user' }).tagName).toBe('H4');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.queryByLabelText('HTTP method')).not.toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('HTTP method')).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue('Get user'), { target: { value: 'Get user v2' } });
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'apiEndpoint/update' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'replace' }));
    expect(screen.queryByLabelText('HTTP method')).not.toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Get user' })).toBeTruthy();
  });

  it('workbench Done returns to read view keeping edits', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByText('Get user'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('Get user'), { target: { value: 'Get user v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByLabelText('HTTP method')).not.toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Get user' })).toBeTruthy();
    const replaces = mocks.dispatch.mock.calls.filter((c) => c[0].type === 'replace');
    expect(replaces).toHaveLength(0);
  });

  it('collection rename blocks duplicates like the modal', () => {
    mocks.state = makeState({ apiCollections: [collection, collection2], apiEndpoints: [] });
    renderPage();

    fireEvent.click(screen.getByText('Users'));
    const titleInput = screen.getByLabelText('Collection name') as HTMLInputElement;
    expect(titleInput.value).toBe('Users');

    fireEvent.change(titleInput, { target: { value: 'Billing' } });
    expect(screen.getByText('A collection with this name already exists.')).toBeTruthy();
    const renamed = mocks.dispatch.mock.calls.filter(
      (c) => c[0].type === 'apiCollection/update' && c[0].patch?.name === 'Billing',
    );
    expect(renamed).toHaveLength(0);

    fireEvent.change(titleInput, { target: { value: 'Users v2' } });
    expect(screen.queryByText('A collection with this name already exists.')).not.toBeTruthy();
  });

  it('new endpoint modal blocks duplicate method+path', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'New endpoint' })[0]!);
    fireEvent.change(screen.getByPlaceholderText('e.g. List users'), { target: { value: 'Duplicate user' } });
    const pathInput = document.getElementById('endpoint-path') as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: '/users/:id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create endpoint' }));

    expect(screen.getByText('An endpoint with this method and path already exists.')).toBeTruthy();
    const added = mocks.dispatch.mock.calls.filter((c) => c[0].type === 'apiEndpoint/add');
    expect(added).toHaveLength(0);
  });

  it('workbench blocks method+path clashes with another endpoint', () => {
    const other: ApiEndpoint = {
      ...endpoint,
      id: 'e2',
      name: 'List orders',
      path: '/orders',
      description: '',
    };
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [
        { ...endpoint, collectionId: 'c1' },
        { ...other, collectionId: 'c1' },
      ],
    });
    renderPage();

    fireEvent.click(screen.getByText('Get user'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByLabelText('Endpoint path'), { target: { value: '/orders' } });
    expect(screen.getByText('An endpoint with this method and path already exists.')).toBeTruthy();
    const renamed = mocks.dispatch.mock.calls.filter(
      (c) => c[0].type === 'apiEndpoint/update' && c[0].patch?.path === '/orders',
    );
    expect(renamed).toHaveLength(0);

    fireEvent.click(screen.getByLabelText('HTTP method'));
    fireEvent.click(screen.getByRole('option', { name: 'POST' }));
    expect(screen.queryByText('An endpoint with this method and path already exists.')).not.toBeTruthy();
  });

  it('import skips duplicate endpoints and reports a summary', async () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    const yaml = [
      'openapi: 3.0.3',
      'info: { title: Demo, version: 0.1.0 }',
      'tags: [{ name: Users }]',
      'paths:',
      '  /users/:id:',
      '    get:',
      '      summary: Get user',
      '  /orders:',
      '    post:',
      '      summary: Create order',
      '',
    ].join('\n');
    const file = new File([yaml], 'api.yaml', { type: 'text/yaml' });
    const input = document.querySelector('.api-page input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText('Import complete — 1 endpoints added, 1 duplicates skipped, 1 collections.'),
    ).toBeTruthy();
    const added = mocks.dispatch.mock.calls.filter((c) => c[0].type === 'apiEndpoint/add');
    expect(added).toHaveLength(1);
    expect(added[0]?.[0].endpoint.path).toBe('/orders');
  });

  it('docs print starts content directly with collection chapters', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));

    expect(screen.getByText(/Generated on /)).toBeTruthy();
    expect(document.querySelector('.api-print-toc')).toBeNull();
    expect(document.querySelector('.api-print-matrix')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Users' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Get user' })).toBeTruthy();
  });

  it('docs tables use fixed column variants without horizontal scroll', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));

    const paramsTable = document.querySelector('.preview-table--params');
    expect(paramsTable).toBeTruthy();
    expect(paramsTable?.querySelectorAll('col').length).toBe(4);
    const headersTable = document.querySelector('.preview-table--headers');
    expect(headersTable).toBeTruthy();
    expect(headersTable?.querySelectorAll('col').length).toBe(3);
  });

  it('body tab warns that GET bodies are not exported', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByText('Get user'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Body' }));

    expect(
      screen.getByText('Not exported for GET — only POST, PUT and PATCH include a request body.'),
    ).toBeTruthy();
  });

  it('body tab shows the standard helper for POST', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1', method: 'POST' as const }],
    });
    renderPage();

    fireEvent.click(screen.getByText('Get user'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Body' }));

    expect(screen.getByText('JSON body example. Exported only for POST, PUT and PATCH.')).toBeTruthy();
  });

  it('import rejects oversized files with the file name', async () => {
    mocks.state = makeState({ apiCollections: [collection], apiEndpoints: [] });
    renderPage();

    const big = new File(['x'.repeat(6 * 1024 * 1024)], 'huge-spec.yaml', { type: 'text/yaml' });
    const input = document.querySelector('.api-page input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [big] } });

    expect(await screen.findByText('“huge-spec.yaml” is too large (max 5 MB).')).toBeTruthy();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('import failure names the file', async () => {
    mocks.state = makeState({ apiCollections: [], apiEndpoints: [] });
    renderPage();

    const file = new File(['not yaml: ['], 'broken.yaml', { type: 'text/yaml' });
    const input = document.querySelector('.api-page input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/broken\.yaml/)).toBeTruthy();
  });

  it('dropping a spec file onto the sidebar imports it', async () => {
    mocks.state = makeState({ apiCollections: [], apiEndpoints: [] });
    renderPage();

    const yaml = [
      'openapi: 3.0.3',
      'info: { title: Demo, version: 0.1.0 }',
      'paths:',
      '  /ping:',
      '    get:',
      '      summary: Ping',
      '',
    ].join('\n');
    const file = new File([yaml], 'ping.yaml', { type: 'text/yaml' });
    const sidebar = document.querySelector('.api-sidebar') as HTMLElement;
    fireEvent.drop(sidebar, { dataTransfer: { files: [file] } });

    expect(
      await screen.findByText('Import complete — 1 endpoints added, 0 duplicates skipped, 0 collections.'),
    ).toBeTruthy();
  });

  it('sidebar defaults to newest collections first', () => {
    const oldCollection: ApiCollection = {
      ...collection,
      id: 'c-old',
      name: 'OldStuff',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mocks.state = makeState({ apiCollections: [collection, oldCollection], apiEndpoints: [] });
    renderPage();

    const titles = Array.from(
      document.querySelectorAll('.api-tree-group-select .api-tree-item-title'),
    ).map((el) => el.textContent);
    expect(titles).toEqual(['Users', 'OldStuff']);
  });

  it('collection sort param orders alphabetically', () => {
    const oldCollection: ApiCollection = {
      ...collection,
      id: 'c-old',
      name: 'OldStuff',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mocks.state = makeState({ apiCollections: [collection, oldCollection], apiEndpoints: [] });
    renderPage(undefined, ['/?sort=name&dir=asc']);

    const titles = Array.from(
      document.querySelectorAll('.api-tree-group-select .api-tree-item-title'),
    ).map((el) => el.textContent);
    expect(titles).toEqual(['OldStuff', 'Users']);
  });

  it('endpoint sort param orders by method', () => {
    const epAlpha: ApiEndpoint = {
      ...endpoint,
      id: 'e-post',
      name: 'Alpha',
      method: 'POST' as const,
      path: '/alpha',
      collectionId: 'c1',
      description: '',
    };
    const epZulu: ApiEndpoint = {
      ...endpoint,
      id: 'e-get',
      name: 'Zulu',
      method: 'GET' as const,
      path: '/zulu',
      collectionId: 'c1',
      description: '',
    };
    mocks.state = makeState({ apiCollections: [collection], apiEndpoints: [epAlpha, epZulu] });
    renderPage(undefined, ['/?sortE=method&dir=asc']);

    const titles = Array.from(
      document.querySelectorAll('.api-tree-item-select .api-tree-item-title'),
    ).map((el) => el.textContent);
    expect(titles).toEqual(['Zulu', 'Alpha']);
  });

  it('sidebar resizer adjusts width with arrow keys within limits', () => {
    localStorage.removeItem('api-sidebar-width');
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    const resizer = screen.getByRole('separator', { name: 'Resize sidebar' });
    fireEvent.keyDown(resizer, { key: 'ArrowRight' });
    expect(localStorage.getItem('api-sidebar-width')).toBe('280');

    for (let i = 0; i < 10; i += 1) {
      fireEvent.keyDown(resizer, { key: 'ArrowLeft' });
    }
    expect(localStorage.getItem('api-sidebar-width')).toBe('220');

    localStorage.removeItem('api-sidebar-width');
  });

  it('docs empty state hides editor instructions from viewers', () => {
    mocks.canEdit = false;
    mocks.state = makeState();
    renderPage();

    expect(screen.getByText('No API documentation yet')).toBeTruthy();
    expect(screen.queryByText(/Document your API/)).not.toBeTruthy();
  });

  it('headers and params tabs expose a mobile field legend', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByText('Get user'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByText('Key · Value · Description')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Params/ }));
    expect(screen.getByText('Name · In · Required · Description')).toBeTruthy();
  });

  it('export PDF opens print and cleans up afterwards', async () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export PDF' }));
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.contentWindow).toBeTruthy();
    const printSpy = vi.fn();
    Object.defineProperty(frame.contentWindow!, 'print', { value: printSpy, configurable: true });
    expect(document.title).toBe('devhub-demo-project-api');

    await vi.waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

    const frameDoc = frame.contentDocument;
    expect(frameDoc?.documentElement.getAttribute('data-theme')).toBe('light');
    expect(frameDoc?.querySelector('.api-print-footer')?.textContent).toMatch(/Generated by DevHub on /);
    expect(frameDoc?.querySelector('.api-print-coverpage')?.textContent).toMatch(/Generated on /);
    expect(frameDoc?.querySelector('#ep-get-users-id')).toBeTruthy();
    expect(frameDoc?.querySelector('.api-print-toc')).toBeNull();
    expect(frameDoc?.querySelector('.api-print-matrix')).toBeNull();

    fireEvent(window, new Event('afterprint'));
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.title).not.toBe('devhub-demo-project-api');
  });

  it('delete collection flow confirms and dispatches remove', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Delete collection Users' }));
    expect(screen.getByText(/Its endpoints move to Ungrouped/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'apiCollection/remove', id: 'c1' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeTruthy();
  });

  it('print iframe clones dev style tags as well as links', async () => {
    const probe = document.createElement('style');
    probe.textContent = '.probe-print-test{color:red}';
    document.head.appendChild(probe);
    try {
      mocks.state = makeState({ apiCollections: [], apiEndpoints: [] });
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Export' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Export PDF' }));
      const frame = document.querySelector('iframe') as HTMLIFrameElement;
      if (frame.contentWindow) {
        Object.defineProperty(frame.contentWindow, 'print', { value: vi.fn(), configurable: true });
      }
      await vi.waitFor(() => {
        const styles = Array.from(frame.contentDocument?.querySelectorAll('style') ?? []);
        expect(styles.some((s) => s.textContent?.includes('.probe-print-test'))).toBe(true);
      });
      fireEvent(window, new Event('afterprint'));
      expect(document.querySelector('iframe')).toBeNull();
    } finally {
      probe.remove();
    }
  });

  it('workbench collection field moves the endpoint to another collection', () => {
    const billing: ApiCollection = { ...collection, id: 'c2', name: 'Billing', description: '' };
    mocks.state = makeState({
      apiCollections: [collection, billing],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByText('Get user'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.click(screen.getByRole('button', { name: 'Collection' }));
    fireEvent.click(screen.getByRole('option', { name: 'Billing' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'apiEndpoint/update', patch: { collectionId: 'c2' } }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collection' }));
    fireEvent.click(screen.getByRole('option', { name: 'None (ungrouped)' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'apiEndpoint/update', patch: { collectionId: null } }),
    );
  });

  it('docs print cover shows version from the latest released milestone', () => {
    const m1 = {
      id: 'm1',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      name: 'M1',
      version: '0.31',
      targetDate: '2026-09-17',
      status: 'released' as const,
      changelog: 'Shipped X',
    };
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
      milestones: [m1],
    });
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));

    expect(screen.getByText('Version 0.31')).toBeTruthy();
    expect(screen.queryByText('Changelog')).not.toBeTruthy();
    expect(screen.queryByText('Endpoint Matrix')).not.toBeTruthy();
  });

  it('docs print omits version without released milestones', () => {
    mocks.state = makeState({
      apiCollections: [collection],
      apiEndpoints: [{ ...endpoint, collectionId: 'c1' }],
    });
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));

    expect(screen.queryByText(/Version /)).not.toBeTruthy();
    expect(screen.queryByText('Changelog')).not.toBeTruthy();
  });
});