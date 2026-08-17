import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleasesPage } from './ReleasesPage';
import type { Milestone } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function milestone(over: Partial<Milestone> = {}): Milestone {
  return {
    id: 'm1',
    name: 'V1.0',
    status: 'planned',
    changelog: '',
    targetDate: '2026-09-30',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderPage(unreadIds?: ReadonlySet<string>) {
  return render(
    <MemoryRouter>
      <ReleasesPage unreadIds={unreadIds} />
    </MemoryRouter>,
  );
}

describe('ReleasesPage', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        milestones: [milestone(), milestone({ id: 'm2', name: 'V2.0' })],
        tasks: [],
      },
      loading: false,
      error: null,
      canEdit: true,
    });
  });

  it('marks rows with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['m1']));
    expect(document.querySelectorAll('.unread-dot').length).toBe(1);
    expect(screen.getAllByText('Unread').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-dot').length).toBe(0);
  });
});