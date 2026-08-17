import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionsPage } from './DecisionsPage';
import type { Decision } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

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
    useProjectMock.mockReturnValue({
      state: {
        decisions: [decision(), decision({ id: 'd2', title: 'Use Redis' })],
      },
      loading: false,
      error: null,
      canEdit: true,
    });
  });

  it('marks rows with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['d1']));
    expect(document.querySelectorAll('.unread-dot').length).toBe(1);
    expect(screen.getAllByText('Unread').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-dot').length).toBe(0);
  });
});