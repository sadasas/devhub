import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionsPage } from './DecisionsPage';
import type { Decision } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function decision(over: Partial<Decision> = {}): Decision {
  return {
    id: 'd1',
    title: 'Use Postgres',
    status: 'accepted',
    date: '2026-01-01',
    context: '',
    decision: '',
    consequences: '',
    options: ['Postgres', 'MySQL'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderPage(unreadIds?: ReadonlySet<string>) {
  return render(
    <MemoryRouter>
      <DecisionsPage unreadIds={unreadIds} />
    </MemoryRouter>,
  );
}

describe('DecisionsPage', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    dispatchMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        decisions: [decision(), decision({ id: 'd2', title: 'Use Redis' })],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
  });

  it('marks rows with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['d1']));
    expect(document.querySelectorAll('.unread-pill').length).toBe(1);
    expect(screen.getAllByText('New').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-pill').length).toBe(0);
  });

  it('toggles pinned via dispatch', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pin decision' })[0]!);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'decision/update',
      id: 'd1',
      patch: { pinned: true },
    });
  });

  it('renders pinned decisions first', () => {
    useProjectMock.mockReturnValue({
      state: {
        decisions: [decision(), decision({ id: 'd2', title: 'Use Redis', pinned: true })],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
    renderPage();
    const first = screen.getAllByText('Use Redis')[0]!;
    expect((first.closest('.data-row') as HTMLElement).textContent).toContain('Use Redis');
  });

  it('hover layer holds Pin+Trash in .swap-group, delete asks for confirm', () => {
    renderPage();
    const row = screen.getByText('Use Postgres').closest('.data-row')!;
    // Keduanya hover-only (tidak persisten saat idle, kecuali pinned peek)
    const group = row.querySelector('.swap-group');
    expect(group?.contains(screen.getAllByRole('button', { name: 'Pin decision' })[0]!)).toBe(true);
    expect(group?.contains(screen.getByRole('button', { name: 'Delete decision Use Postgres' }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete decision Use Postgres' }));
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Delete decision record?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'decision/remove', id: 'd1' });
    expect(screen.queryByText('Delete decision record?')).toBeNull();
  });

  it('hides pin/delete for viewers', () => {
    useProjectMock.mockReturnValue({
      state: { decisions: [decision()] },
      loading: false,
      error: null,
      canEdit: false,
      dispatch: dispatchMock,
    });
    renderPage();
    expect(screen.queryByRole('button', { name: 'Pin decision' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete decision/ })).toBeNull();
  });
});

describe('DecisionsPage mobile header', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('640px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    useProjectMock.mockReset();
    dispatchMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        decisions: [decision(), decision({ id: 'd2', title: 'Use Redis' })],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('uses the short Decision label on the header add button', () => {
    renderPage();
    expect(document.querySelector('.decisions-page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decision' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New decision' })).toBeNull();
  });

  it('narrow: inline actions replaced by kebab popup menu', () => {
    renderPage();
    expect(screen.getAllByRole('button', { name: /More actions for/ }).length).toBe(2);
    expect(screen.queryByRole('button', { name: 'Pin decision' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete decision/ })).toBeNull();
  });

  it('narrow: kebab Pin toggles and closes menu', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin decision' }));
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'decision/update',
      id: 'd1',
      patch: { pinned: true },
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('narrow: kebab Delete opens confirm dialog', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByText('Delete decision record?')).toBeTruthy();
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});