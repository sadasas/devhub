import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));

// Mock the wrapper module — never posthog-js directly.
vi.mock('../../lib/analytics', () => ({
  track: trackMock,
  useFeatureFlag: (_key: string, fallback: boolean) => fallback,
  FOCUS_MODE_FLAG: 'focus-mode-enabled',
}));

import { FocusTimer } from './FocusTimer';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function openSheet() {
  fireEvent.click(screen.getByRole('button', { name: 'Timer' }));
  expect(screen.queryByRole('dialog', { name: 'Timer' })).toBeTruthy();
}

describe('FocusTimer analytics', () => {
  beforeEach(() => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    trackMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fires timer_sheet_open when the sheet opens', () => {
    render(<FocusTimer />);
    openSheet();
    expect(trackMock).toHaveBeenCalledWith('timer_sheet_open');
  });

  it('fires timer_mode_switch with the new mode', () => {
    render(<FocusTimer />);
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Stopwatch' }));
    expect(trackMock).toHaveBeenCalledWith('timer_mode_switch', { mode: 'up' });
  });

  it('fires timer_duration_set from the stepper with seconds + source', () => {
    render(<FocusTimer />);
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '+ 1 min' }));
    expect(trackMock).toHaveBeenCalledWith('timer_duration_set', {
      seconds: 1560,
      source: 'stepper',
    });
  });

  it('fires timer_duration_set from edit apply with seconds + source', () => {
    render(<FocusTimer />);
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '25:00' }));
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '30' } });
    fireEvent.keyDown(screen.getByLabelText('Seconds'), { key: 'Enter' });
    expect(trackMock).toHaveBeenCalledWith('timer_duration_set', {
      seconds: 630,
      source: 'edit',
    });
  });

  it('fires start / pause / resume across the toggle lifecycle', () => {
    render(<FocusTimer />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(trackMock).toHaveBeenCalledWith('timer_start', { mode: 'down', duration: 1500 });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(trackMock).toHaveBeenCalledWith('timer_pause', { mode: 'down', elapsed: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(trackMock).toHaveBeenCalledWith('timer_resume', { mode: 'down', elapsed: 5 });
  });

  it('fires timer_complete with mode + duration at zero and timer_reset on reset', () => {
    render(<FocusTimer />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });
    expect(trackMock).toHaveBeenCalledWith('timer_complete', { mode: 'down', duration: 1500 });
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(trackMock).toHaveBeenCalledWith('timer_reset');
  });
});
