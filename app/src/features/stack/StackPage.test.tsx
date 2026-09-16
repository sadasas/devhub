import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { StackPage } from './StackPage';
import type { TechEntry } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function entry(over: Partial<TechEntry> = {}): TechEntry {
  return {
    id: 't1',
    name: 'React',
    category: 'frontend',
    status: 'current',
    version: '19.0.0',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderPage(unreadIds?: ReadonlySet<string>) {
  return render(
    <MemoryRouter>
      <StackPage unreadIds={unreadIds} />
    </MemoryRouter>,
  );
}

describe('StackPage', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        techEntries: [entry(), entry({ id: 't2', name: 'Postgres' })],
      },
      loading: false,
      error: null,
      canEdit: true,
    });
  });

  it('marks rows with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['t1']));
    expect(document.querySelectorAll('.unread-pill').length).toBe(1);
    expect(screen.getAllByText('New').length).toBe(1);
    // i18n: teks ter-render, bukan raw key
    expect(screen.getByText('React')).toBeTruthy();
    expect(screen.queryByText(/board\.taskModal/)).toBeNull();
    expect(screen.queryByText(/issues\.modal/)).toBeNull();
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-pill').length).toBe(0);
  });
});

describe('StackPage mobile header', () => {
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
    useProjectMock.mockReturnValue({
      state: {
        techEntries: [entry(), entry({ id: 't2', name: 'Postgres' })],
      },
      loading: false,
      error: null,
      canEdit: true,
    });
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('uses the short Entry label on the header add button', () => {
    renderPage();
    expect(document.querySelector('.stack-page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entry' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New entry' })).toBeNull();
  });

  it('keeps view toggle text for screen readers via aria-label', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'List' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Graph' })).toBeTruthy();
  });
});