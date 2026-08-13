import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityList } from './ActivityList';
import { api, type ActivityEntry } from '../lib/api';

const CURRENT_USER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

vi.mock('../state/auth-context', () => ({
  useOptionalAuth: () => ({ user: { id: CURRENT_USER_ID, email: 'me@devhub.test' } }),
}));

const PROJECT_ID = '99999999-9999-4999-8999-999999999999';
const ENTITY_ID = '88888888-8888-4888-8888-888888888888';

function makeEntry(over: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    projectId: PROJECT_ID,
    entity: 'tasks',
    entityId: ENTITY_ID,
    action: 'updated',
    authorId: null,
    authorName: 'Ada',
    summary: 'Ship search',
    changes: {},
    createdAt: '2026-08-13T10:00:00.000Z',
    ...over,
  };
}

describe('ActivityList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton then entries', async () => {
    const fetchActivity = vi
      .spyOn(api, 'fetchActivity')
      .mockResolvedValue([makeEntry({ action: 'created' })]);
    const { container } = render(
      <ActivityList projectId={PROJECT_ID} entity="tasks" entityId={ENTITY_ID} />,
    );
    expect(container.querySelector('.activity-list[aria-busy="true"]')).toBeTruthy();
    expect(await screen.findByText('created')).toBeTruthy();
    expect(fetchActivity).toHaveBeenCalledWith(PROJECT_ID, {
      entity: 'tasks',
      entityId: ENTITY_ID,
      limit: 50,
    });
  });

  it('renders from → to change lines with field labels', async () => {
    vi.spyOn(api, 'fetchActivity').mockResolvedValue([
      makeEntry({
        changes: {
          status: { from: 'todo', to: 'done' },
          priority: { from: 'low', to: 'high' },
        },
      }),
    ]);
    render(<ActivityList projectId={PROJECT_ID} entity="tasks" entityId={ENTITY_ID} />);
    expect(await screen.findByText('Status')).toBeTruthy();
    expect(screen.getByText('todo → done')).toBeTruthy();
    expect(screen.getByText('Priority')).toBeTruthy();
    expect(screen.getByText('low → high')).toBeTruthy();
  });

  it('labels the current user as You', async () => {
    vi.spyOn(api, 'fetchActivity').mockResolvedValue([
      makeEntry({ authorId: CURRENT_USER_ID }),
    ]);
    render(<ActivityList projectId={PROJECT_ID} entity="tasks" entityId={ENTITY_ID} />);
    expect(await screen.findByText('You')).toBeTruthy();
  });

  it('falls back to Someone when author name is empty', async () => {
    vi.spyOn(api, 'fetchActivity').mockResolvedValue([
      makeEntry({ authorName: '', changes: { title: { from: 'A', to: 'B' } } }),
    ]);
    render(<ActivityList projectId={PROJECT_ID} entity="tasks" entityId={ENTITY_ID} />);
    expect(await screen.findByText('Someone')).toBeTruthy();
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('A → B')).toBeTruthy();
  });

  it('shows the empty state', async () => {
    vi.spyOn(api, 'fetchActivity').mockResolvedValue([]);
    render(<ActivityList projectId={PROJECT_ID} entity="tasks" entityId={ENTITY_ID} />);
    expect(await screen.findByText('No activity recorded yet.')).toBeTruthy();
  });

  it('shows the error state', async () => {
    vi.spyOn(api, 'fetchActivity').mockRejectedValue(new Error('boom'));
    render(<ActivityList projectId={PROJECT_ID} entity="tasks" entityId={ENTITY_ID} />);
    expect(await screen.findByText('boom')).toBeTruthy();
  });
});
