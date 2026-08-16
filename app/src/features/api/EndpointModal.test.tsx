import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ApiCollection } from '../../lib/types';
import { EndpointModal } from './EndpointModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ dispatch: mockDispatch }),
}));

const COL_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COL_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const collections: ApiCollection[] = [
  {
    id: COL_A,
    name: 'Users API',
    description: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: COL_B,
    name: 'Auth API',
    description: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

const mockDispatch = vi.fn();

describe('EndpointModal collection select', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('assigns the endpoint to a collection', () => {
    render(<EndpointModal onClose={vi.fn()} onCreated={vi.fn()} collections={collections} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'List users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Collection' }));
    fireEvent.click(screen.getByRole('option', { name: 'Users API' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create endpoint' }));
    const added = mockDispatch.mock.calls.find((c) => c[0].type === 'apiEndpoint/add');
    expect(added?.[0].endpoint.collectionId).toBe(COL_A);
  });

  it('keeps the endpoint ungrouped by default', () => {
    render(<EndpointModal onClose={vi.fn()} onCreated={vi.fn()} collections={collections} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'List users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create endpoint' }));
    const added = mockDispatch.mock.calls.find((c) => c[0].type === 'apiEndpoint/add');
    expect(added?.[0].endpoint.collectionId).toBeNull();
  });
});