import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssuesPage } from './IssuesPage';
import type { Issue } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: 'i1',
    title: 'Flaky test',
    severity: 'medium',
    status: 'open',
    description: '',
    reproduction: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderPage(unreadIds?: ReadonlySet<string>) {
  return render(
    <MemoryRouter>
      <IssuesPage unreadIds={unreadIds} />
    </MemoryRouter>,
  );
}

describe('IssuesPage', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    dispatchMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        issues: [issue(), issue({ id: 'i2', title: 'Second issue' })],
        tasks: [],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
  });

  it('marks rows with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['i1']));
    expect(document.querySelectorAll('.unread-pill').length).toBe(1);
    expect(screen.getAllByText('New').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-pill').length).toBe(0);
  });

  it('toggles pinned via dispatch', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pin issue' })[0]!);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'issue/update',
      id: 'i1',
      patch: { pinned: true },
    });
  });

  it('renders pinned issues first', () => {
    useProjectMock.mockReturnValue({
      state: {
        issues: [issue(), issue({ id: 'i2', title: 'Second issue', pinned: true })],
        tasks: [],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
    renderPage();
    const first = screen.getAllByText('Second issue')[0]!;
    expect((first.closest('.data-row') as HTMLElement).textContent).toContain('Second issue');
    expect(screen.getAllByRole('button', { name: 'Unpin issue' }).length).toBe(1);
  });
});