import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
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

function renderPage(unreadIds?: ReadonlySet<string>, onOpen?: (id: string) => void) {
  return render(
    <MemoryRouter>
      <WhiteboardList unreadIds={unreadIds} onOpen={onOpen} />
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
      setStatus: vi.fn(),
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

  it('desktop: Edit opens the edit modal, Trash uses hover-reveal wb-trash', () => {
    renderPage();
    expect(document.querySelectorAll('.wb-card .wb-trash').length).toBe(2);
    expect(document.querySelectorAll('.wb-card .wb-edit').length).toBe(2);
    expect(screen.queryByRole('button', { name: /More actions for/ })).toBeNull();
    // Meta baris sendiri di luar tombol main + kolom aksi (tidak ikut menyusut)
    const card = document.querySelector('.wb-card')!;
    expect(card.querySelector('.wb-card-main .project-card-meta')).toBeNull();
    expect(card.querySelector(':scope > .project-card-meta')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit board' })[0]!);
    expect(screen.getByRole('dialog', { name: 'Edit board' })).toBeTruthy();
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe('Roadmap');
  });
});

describe('WhiteboardList narrow', () => {
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
        whiteboards: [board(), board({ id: 'wb2', name: 'Brainstorm' })],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: vi.fn(),
      setStatus: vi.fn(),
    });
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('replaces Trash with kebab popup menu', () => {
    renderPage();
    expect(screen.getAllByRole('button', { name: /More actions for/ }).length).toBe(2);
    expect(document.querySelector('.wb-card .wb-trash')).toBeNull();
  });

  it('kebab Open opens the board and closes menu', () => {
    const onOpen = vi.fn();
    renderPage(undefined, onOpen);
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalledWith('wb1');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('kebab Delete opens confirm dialog', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete board' }));
    expect(screen.getByText('Delete board')).toBeTruthy();
  });

  it('kebab Edit opens the edit modal', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit board' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Edit board' })).toBeTruthy();
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('');
  });
});