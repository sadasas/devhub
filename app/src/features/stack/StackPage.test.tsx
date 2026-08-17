import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(document.querySelectorAll('.unread-dot').length).toBe(1);
    expect(screen.getAllByText('Unread').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-dot').length).toBe(0);
  });
});