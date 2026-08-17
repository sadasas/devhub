import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestsPage } from './TestsPage';
import type { TestCase } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());

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
    useProjectMock.mockReturnValue({
      state: {
        testCases: [testCase(), testCase({ id: 'tc2', name: 'Regression' })],
        tasks: [],
        issues: [],
      },
      loading: false,
      error: null,
      canEdit: true,
    });
  });

  it('marks rows with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['tc1']));
    expect(document.querySelectorAll('.unread-dot').length).toBe(1);
    expect(screen.getAllByText('Unread').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-dot').length).toBe(0);
  });
});