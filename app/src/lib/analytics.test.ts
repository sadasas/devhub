import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    init: vi.fn(),
    capture: vi.fn(),
    captureException: vi.fn(),
    isFeatureEnabled: vi.fn(),
    onFeatureFlags: vi.fn(),
    getAllFeatureFlags: vi.fn(),
  },
}));

vi.mock('posthog-js', () => ({
  default: {
    init: mocks.init,
    capture: mocks.capture,
    captureException: mocks.captureException,
    isFeatureEnabled: mocks.isFeatureEnabled,
    onFeatureFlags: mocks.onFeatureFlags,
    getAllFeatureFlags: mocks.getAllFeatureFlags,
  },
}));

import {
  __resetAnalyticsForTests,
  initAnalytics,
  reportError,
  track,
  useFeatureFlag,
} from './analytics';

beforeEach(() => {
  __resetAnalyticsForTests();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.isFeatureEnabled.mockReturnValue(undefined);
  mocks.onFeatureFlags.mockReturnValue(() => {});
  mocks.getAllFeatureFlags.mockReturnValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('analytics wrapper', () => {
  it('skips init entirely when key is empty (dev-safe no-op)', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    initAnalytics();
    expect(mocks.init).not.toHaveBeenCalled();
    expect(() => track('timer_start', { mode: 'down' })).not.toThrow();
    expect(() => reportError(new Error('x'))).not.toThrow();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it('inits once with memory persistence, no autocapture, no recording (US default host)', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    vi.stubEnv('VITE_POSTHOG_HOST', '');
    initAnalytics();
    initAnalytics();
    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(mocks.init).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        persistence: 'memory',
        autocapture: false,
        disable_session_recording: true,
      }),
    );
  });

  it('uses VITE_POSTHOG_HOST when set', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');
    initAnalytics();
    expect(mocks.init).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({ api_host: 'https://us.i.posthog.com' }),
    );
  });

  it('captures events and exceptions after init with props', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    initAnalytics();
    track('timer_start', { mode: 'down', duration: 1500 });
    expect(mocks.capture).toHaveBeenCalledWith('timer_start', { mode: 'down', duration: 1500 });
    const err = new Error('boom');
    reportError(err, { route: '/project/p1/focus/t1' });
    expect(mocks.captureException).toHaveBeenCalledWith(err, { route: '/project/p1/focus/t1' });
  });

  it('useFeatureFlag returns fallback until flags arrive, then the flag value', () => {
    let flagsCb: (() => void) | null = null;
    mocks.isFeatureEnabled.mockReturnValue(undefined);
    mocks.onFeatureFlags.mockImplementation((cb: () => void) => {
      flagsCb = cb;
      return () => {};
    });
    const { result } = renderHook(() => useFeatureFlag('focus-mode-enabled', true));
    expect(result.current).toBe(true);
    mocks.isFeatureEnabled.mockReturnValue(false);
    act(() => {
      flagsCb?.();
    });
    expect(result.current).toBe(false);
  });

  it('useFeatureFlag stays fail-open when SDK throws', () => {
    mocks.isFeatureEnabled.mockImplementation(() => {
      throw new Error('sdk down');
    });
    mocks.onFeatureFlags.mockImplementation(() => {
      throw new Error('sdk down');
    });
    const { result } = renderHook(() => useFeatureFlag('focus-mode-enabled', true));
    expect(result.current).toBe(true);
  });
});

describe('flag health probe', () => {
  it('warns once when no flags ever load (dead /flags request)', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    mocks.getAllFeatureFlags.mockReturnValue([]);
    initAnalytics();
    act(() => {
      vi.advanceTimersByTime(8000);
      vi.advanceTimersByTime(8000);
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no flags loaded'));
  });

  it('warns when flags load but this key is absent', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    mocks.getAllFeatureFlags.mockReturnValue([{ key: 'some-other-flag', enabled: true }]);
    initAnalytics();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('this key is absent'));
  });

  it('stays quiet when the flag is present, enabled or not', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    mocks.getAllFeatureFlags.mockReturnValue([{ key: 'focus-mode-enabled', enabled: false }]);
    initAnalytics();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not probe when init was skipped (no key)', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    initAnalytics();
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
