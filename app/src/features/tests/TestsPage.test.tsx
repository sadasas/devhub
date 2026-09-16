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
});