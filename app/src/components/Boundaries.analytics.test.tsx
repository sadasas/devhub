import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { reportMock } = vi.hoisted(() => ({ reportMock: vi.fn() }));

// Mock the wrapper module — never posthog-js directly.
vi.mock('../lib/analytics', () => ({
  reportError: reportMock,
  track: vi.fn(),
  useFeatureFlag: (_key: string, fallback: boolean) => fallback,
  FOCUS_MODE_FLAG: 'focus-mode-enabled',
}));

import { ErrorBoundary } from './ErrorBoundary';
import { RouteBoundary } from './RouteBoundary';

function Boom(): never {
  throw new Error('render boom');
}

beforeEach(() => {
  reportMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('error boundaries report via analytics', () => {
  it('ErrorBoundary calls reportError with the route on caught error', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary')).toBeTruthy();
    expect(reportMock).toHaveBeenCalledTimes(1);
    const [err, props] = reportMock.mock.calls[0] as [Error, Record<string, unknown>];
    expect(err).toBeInstanceOf(Error);
    expect(props).toEqual({ route: window.location.pathname });
  });

  it('RouteBoundary surfaces the fallback and reports once via the inner boundary', () => {
    render(
      <MemoryRouter initialEntries={['/project/p1/focus/t1']}>
        <RouteBoundary fallback={<div>LOADING</div>}>
          <Boom />
        </RouteBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('error-boundary')).toBeTruthy();
    expect(reportMock).toHaveBeenCalledTimes(1);
    const [, props] = reportMock.mock.calls[0] as [Error, Record<string, unknown>];
    // MemoryRouter does not touch window.location — the boundary reports the real path.
    expect(props).toEqual({ route: window.location.pathname });
  });
});
