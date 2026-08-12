import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

function renderPage() {
  return render(<ApiPage projectName="Demo Project" projectDescription="A public demo" />);
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

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Users API' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create collection' }));

    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'apiCollection/add',
        collection: expect.objectContaining({ name: 'Users API' }),
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeTruthy();
  });

  it('shows editor then preview for a selected endpoint', () => {
    mocks.state = makeState({ apiCollections: [collection], apiEndpoints: [endpoint] });
    renderPage();

    fireEvent.click(screen.getByText('Get user'));
    expect(screen.getByLabelText('HTTP method')).toBeTruthy();
    expect((screen.getByLabelText('Endpoint path') as HTMLInputElement).value).toBe('/users/:id');

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(screen.getByRole('heading', { name: 'Get user' })).toBeTruthy();
    expect(screen.getByText('Returns a single user by id')).toBeTruthy();
    expect(screen.getByText('Parameters')).toBeTruthy();
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('include')).toBeTruthy();
    expect(screen.getByText('X-Api-Key')).toBeTruthy();
    expect(screen.getByText('abc')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('application/json')).toBeTruthy();
    expect(screen.getByText('Found')).toBeTruthy();
    expect(screen.getByText('Not found')).toBeTruthy();
    expect(screen.getByText('{"kind":"ok"}')).toBeTruthy();
  });

  it('forces read-only preview for viewer role', () => {
    mocks.canEdit = false;
    mocks.state = makeState({ apiCollections: [collection], apiEndpoints: [endpoint] });
    renderPage();

    expect(screen.queryByRole('button', { name: 'New endpoint' })).not.toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New collection' })).not.toBeTruthy();
    expect(screen.getByText('Pick an endpoint from the sidebar to view its documentation.')).toBeTruthy();

    fireEvent.click(screen.getByText('Get user'));

    expect(screen.getByRole('heading', { name: 'Get user' })).toBeTruthy();
    expect(screen.queryByLabelText('HTTP method')).not.toBeTruthy();
    expect(screen.queryByLabelText('Endpoint path')).not.toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeTruthy();
    expect(screen.getByText('Returns a single user by id')).toBeTruthy();
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
});