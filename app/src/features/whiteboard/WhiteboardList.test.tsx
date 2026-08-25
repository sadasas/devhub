import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhiteboardList } from './WhiteboardList';
import type { Whiteboard } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function board(over: Partial<Whiteboard> = {}): Whiteboard {
  return {
    id: 'wb1',
    name: 'Roadmap',
    description: '',
    elements: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderPage(unreadIds?: ReadonlySet<string>) {
  return render(
    <MemoryRouter>
      <WhiteboardList unreadIds={unreadIds} />
    </MemoryRouter>,
  );
}

describe('WhiteboardList', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        whiteboards: [board(), board({ id: 'wb2', name: 'Brainstorm' })],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: vi.fn(),
    });
  });

  it('marks cards with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['wb1']));
    expect(document.querySelectorAll('.unread-pill').length).toBe(1);
    expect(screen.getAllByText('New').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-pill').length).toBe(0);
  });
});