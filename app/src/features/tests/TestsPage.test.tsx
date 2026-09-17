import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TestsPage } from './TestsPage';
import type { TestCase } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function testCase(over: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc1',
    name: 'Login flow',
    status: 'pass',
    steps: 'Fill form',
    expected: 'Logged in',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderPage(unreadIds?: ReadonlySet<string>) {
  return render(
    <MemoryRouter>
      <TestsPage unreadIds={unreadIds} />
    </MemoryRouter>,
  );
}

describe('TestsPage', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    dispatchMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        testCases: [testCase(), testCase({ id: 'tc2', name: 'Regression' })],
        tasks: [],
        issues: [],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
  });

  it('marks rows with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['tc1']));
    expect(document.querySelectorAll('.unread-pill').length).toBe(1);
    expect(screen.getAllByText('New').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-pill').length).toBe(0);
  });

  it('toggles pinned via dispatch', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pin test case' })[0]!);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'testCase/update',
      id: 'tc1',
      patch: { pinned: true },
    });
  });

  it('renders pinned test cases first', () => {
    useProjectMock.mockReturnValue({
      state: {
        testCases: [testCase(), testCase({ id: 'tc2', name: 'Regression', pinned: true })],
        tasks: [],
        issues: [],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
    renderPage();
    const first = screen.getAllByText('Regression')[0]!;
    expect((first.closest('.data-row') as HTMLElement).textContent).toContain('Regression');
  });

  it('row swap: idle shows status, hover layer holds Pin+Trash', () => {
    renderPage();
    const row = screen.getByText('Login flow').closest('.data-row')!;
    expect(row.querySelector('.row-swap')).toBeTruthy();
    expect(row.querySelector('.swap-status')?.textContent).toMatch(/Pass/);
    const group = row.querySelector('.swap-group');
    expect(group?.contains(screen.getAllByRole('button', { name: 'Pin test case' })[0]!)).toBe(true);
    expect(group?.contains(screen.getByRole('button', { name: 'Delete test case Login flow' }))).toBe(true);
  });

  it('delete via row asks for confirm before dispatch', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete test case Login flow' }));
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Delete test case?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'testCase/remove', id: 'tc1' });
    expect(screen.queryByText('Delete test case?')).toBeNull();
  });

  it('hides pin/delete for viewers', () => {
    useProjectMock.mockReturnValue({
      state: { testCases: [testCase()], tasks: [], issues: [] },
      loading: false,
      error: null,
      canEdit: false,
      dispatch: dispatchMock,
    });
    renderPage();
    expect(screen.queryByRole('button', { name: 'Pin test case' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete test case/ })).toBeNull();
  });
});

describe('TestsPage mobile header', () => {
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
        testCases: [testCase(), testCase({ id: 'tc2', name: 'Regression' })],
        tasks: [],
        issues: [],
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

  it('uses the short Test case label on the header add button', () => {
    renderPage();
    expect(document.querySelector('.tests-page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Test case' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New test case' })).toBeNull();
  });

  it('narrow: inline actions replaced by kebab popup menu', () => {
    renderPage();
    expect(screen.getAllByRole('button', { name: /More actions for/ }).length).toBe(2);
    expect(document.querySelector('.tests-page .swap-group')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pin test case' })).toBeNull();
  });

  it('narrow: kebab Pin toggles and closes menu', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin test case' }));
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'testCase/update',
      id: 'tc1',
      patch: { pinned: true },
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('narrow: kebab Delete opens confirm dialog', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByText('Delete test case?')).toBeTruthy();
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});