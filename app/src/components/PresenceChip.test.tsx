import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ActivityEntry } from '../lib/api';
import type { PresenceUser } from '../lib/realtime-client';
import { PresenceChip } from './PresenceChip';

const { useProjectMock, subscribeMock, fetchActivityMock } = vi.hoisted(() => {
  const subscribeMock: ReturnType<typeof vi.fn> = vi.fn(
    (_cb: (msg: unknown) => void): (() => void) => () => {},
  );
  return {
    useProjectMock: vi.fn<() => { presence: PresenceUser[]; projectId: string; subscribeActivity: typeof subscribeMock }>(),
    subscribeMock,
    fetchActivityMock: vi.fn(),
  };
});

vi.mock('../state/project-context', () => ({
  useProject: () => useProjectMock(),
}));

vi.mock('../lib/api', () => ({
  api: { fetchActivity: fetchActivityMock },
}));

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'a1',
    projectId: 'p1',
    entity: 'tasks',
    entityId: 't1',
    action: 'created',
    authorId: 'u1',
    authorName: 'One',
    summary: 'Ship chat',
    changes: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderChip(presence: PresenceUser[], projectId = 'p1') {
  useProjectMock.mockReturnValue({ presence, projectId, subscribeActivity: subscribeMock });
  return render(<PresenceChip />);
}

describe('PresenceChip', () => {
  beforeEach(() => {
    fetchActivityMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the online count and opens a listbox with user names on click', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: 'Two' },
    ]);
    const chip = screen.getByTestId('presence-chip');
    expect(chip.textContent).toContain('2 online');
    expect(chip.getAttribute('aria-haspopup')).toBe('listbox');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.getAttribute('aria-controls')).toBe('presence-listbox');

    fireEvent.click(chip);
    const listbox = screen.getByRole('listbox', { name: 'Online users' });
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(listbox.getAttribute('id')).toBe('presence-listbox');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['One', 'Two']);
  });

  it('falls back unnamed users in the list', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: '' },
      { userId: 'u3', name: 'One' },
    ]);
    const chip = screen.getByTestId('presence-chip');
    expect(chip.textContent).toContain('3 online');
    fireEvent.click(chip);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['One', 'User', 'One']);
  });

  it('closes on a second click', () => {
    renderChip([{ userId: 'u1', name: 'One' }]);
    const chip = screen.getByTestId('presence-chip');
    fireEvent.click(chip);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(chip);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(chip.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on an outside click but not on a click inside the popover', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: 'Two' },
    ]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape', () => {
    renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('renders nothing when nobody is online', () => {
    renderChip([]);
    expect(screen.queryByTestId('presence-chip')).toBeNull();
  });

  it('fetches recent activity per displayed user when opened', async () => {
    fetchActivityMock.mockImplementation(async (_projectId: string, opts: { authorId?: string }) =>
      opts.authorId === 'u1' ? [entry({ action: 'created' })] : [entry({ id: 'a2', authorId: 'u2', action: 'updated', summary: 'Fix login' })],
    );
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: 'Two' },
    ]);
    fireEvent.click(screen.getByTestId('presence-chip'));

    expect(await screen.findByText('Ship chat')).toBeTruthy();
    expect(await screen.findByText('Fix login')).toBeTruthy();
    expect(fetchActivityMock).toHaveBeenCalledWith('p1', { authorId: 'u1', limit: 5 });
    expect(fetchActivityMock).toHaveBeenCalledWith('p1', { authorId: 'u2', limit: 5 });
  });

  it('shows an empty state for users without activity', async () => {
    fetchActivityMock.mockResolvedValue([]);
    renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    expect(await screen.findByText('No activity yet')).toBeTruthy();
  });

  it('shows a loading skeleton while fetching', () => {
    fetchActivityMock.mockImplementation(() => new Promise(() => {}));
    const { container } = renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    expect(container.querySelector('.presence-activity-loading')).toBeTruthy();
  });

  it('shows an error when fetching fails', async () => {
    fetchActivityMock.mockRejectedValue(new Error('boom'));
    renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    expect(await screen.findByText('boom')).toBeTruthy();
  });

  it('prepends live activity for displayed users and replaces by id', async () => {
    fetchActivityMock.mockResolvedValue([]);
    renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    await screen.findByText('No activity yet');

    const cb = subscribeMock.mock.calls[0]![0] as (msg: { entry: ActivityEntry }) => void;
    act(() => cb({ entry: entry({ action: 'updated', summary: 'First change' }) }));
    expect(screen.getByText('First change')).toBeTruthy();

    act(() => cb({ entry: entry({ action: 'updated', summary: 'Second change' }) }));
    expect(screen.getByText('Second change')).toBeTruthy();
    expect(screen.queryByText('First change')).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('ignores live activity from users not in the popover', async () => {
    fetchActivityMock.mockResolvedValue([]);
    renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    await screen.findByText('No activity yet');

    const cb = subscribeMock.mock.calls[0]![0] as (msg: { entry: ActivityEntry }) => void;
    act(() => cb({ entry: entry({ authorId: 'u9', summary: 'Sneaky' }) }));
    expect(screen.queryByText('Sneaky')).toBeNull();
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });
});