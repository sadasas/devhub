import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FocusTimer, formatFocusTimer } from './FocusTimer';

// U+2212 MINUS SIGN — must match board.focus.timerSubtractMinute in tracker.json.
const SUBTRACT_ONE = '− 1 min';
const DURATION_HINT = 'Tap to add minutes · min 1:00';

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

function renderTimer() {
  const utils = render(<FocusTimer />);
  const wrapper = document.querySelector('.focus-timer') as HTMLElement;
  return { ...utils, wrapper };
}

function sheet() {
  return screen.queryByRole('dialog', { name: 'Timer' });
}

function openSheet() {
  fireEvent.click(screen.getByRole('button', { name: 'Timer' }));
  expect(sheet()).toBeTruthy();
}

function panel() {
  return document.querySelector('.focus-timer .pcard');
}

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Timer' }));
  expect(panel()).toBeTruthy();
}

describe('formatFocusTimer', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatFocusTimer(0)).toBe('00:00');
    expect(formatFocusTimer(65)).toBe('01:05');
    expect(formatFocusTimer(1500)).toBe('25:00');
    expect(formatFocusTimer(3661)).toBe('1:01:01');
  });
});

describe('FocusTimer', () => {
  beforeEach(() => {
    mockMatchMedia(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('collapsed shows number, mode icon and toggle with no sheet', () => {
    renderTimer();
    expect(screen.getByText('25:00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(document.querySelector('.focus-timer svg')).toBeTruthy();
    expect(sheet()).toBeNull();
  });

  it('clicking the number opens the sheet, × closes it', () => {
    renderTimer();
    openSheet();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(sheet()).toBeNull();
  });

  it('number toggles the sheet closed on second click', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Timer' }));
    expect(sheet()).toBeNull();
  });

  it('Escape closes the sheet', () => {
    renderTimer();
    openSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sheet()).toBeNull();
  });

  it('edit-mode opens on number click with MM:SS prefilled', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '25:00' }));
    expect((screen.getByLabelText('Minutes') as HTMLInputElement).value).toBe('25');
    expect((screen.getByLabelText('Seconds') as HTMLInputElement).value).toBe('00');
    expect(sheet()).toBeTruthy();
  });

  it('apply via Enter commits MM:SS, stays open and does not start', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '25:00' }));
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '30' } });
    fireEvent.keyDown(screen.getByLabelText('Seconds'), { key: 'Enter' });
    expect(screen.getAllByText('10:30').length).toBeGreaterThan(0);
    expect(sheet()).toBeTruthy();
    expect(screen.queryByLabelText('Minutes')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(2);
  });

  it('blur applies the edit without starting or closing', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '25:00' }));
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '05' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '45' } });
    fireEvent.blur(screen.getByLabelText('Seconds'));
    expect(screen.getAllByText('05:45').length).toBeGreaterThan(0);
    expect(sheet()).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(2);
  });

  it('Escape cancels the edit, reverts and keeps the sheet open', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '25:00' }));
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '99' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '99' } });
    fireEvent.keyDown(screen.getByLabelText('Seconds'), { key: 'Escape' });
    expect(screen.getAllByText('25:00').length).toBeGreaterThan(0);
    expect(sheet()).toBeTruthy();
    expect(screen.queryByLabelText('Minutes')).toBeNull();
  });

  it('clamps SS above 59 and totals below 1:00', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '25:00' }));
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '05' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '99' } });
    fireEvent.keyDown(screen.getByLabelText('Seconds'), { key: 'Enter' });
    expect(screen.getAllByText('05:59').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '05:59' }));
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '00' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '05' } });
    fireEvent.keyDown(screen.getByLabelText('Seconds'), { key: 'Enter' });
    expect(screen.getAllByText('01:00').length).toBeGreaterThan(0);
    expect(sheet()).toBeTruthy();
  });

  it('edit affordance is hidden for stopwatch, running and finished', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Stopwatch' }));
    expect(screen.queryByRole('button', { name: '00:00' })).toBeNull();
    expect(screen.queryByLabelText('Minutes')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Countdown' }));
    const firstPlay = screen.getAllByRole('button', { name: 'Play' })[0];
    expect(firstPlay).toBeTruthy();
    fireEvent.click(firstPlay!);
    expect(screen.queryByRole('button', { name: '25:00' })).toBeNull();
    expect(screen.queryByLabelText('Minutes')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });
    expect(screen.queryByRole('button', { name: '00:00' })).toBeNull();
    expect(screen.queryByLabelText('Minutes')).toBeNull();
    expect(sheet()).toBeTruthy();
  });

  it('auto-advance moves MM to SS after 2 digits; Backspace on empty SS returns', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '25:00' }));
    const mm = screen.getByLabelText('Minutes') as HTMLInputElement;
    const ss = screen.getByLabelText('Seconds') as HTMLInputElement;
    fireEvent.change(mm, { target: { value: '' } });
    fireEvent.change(mm, { target: { value: '12' } });
    expect(document.activeElement).toBe(ss);
    fireEvent.change(ss, { target: { value: '' } });
    fireEvent.keyDown(ss, { key: 'Backspace' });
    expect(document.activeElement).toBe(mm);
    fireEvent.keyDown(mm, { key: 'Escape' });
    expect(screen.getAllByText('25:00').length).toBeGreaterThan(0);
  });

  it('stepper composes with edited seconds duration', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '25:00' }));
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '30' } });
    fireEvent.keyDown(screen.getByLabelText('Seconds'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '+ 1 min' }));
    expect(screen.getAllByText('11:30').length).toBeGreaterThan(0);
    expect(sheet()).toBeTruthy();
  });

  it('countdown idle shows the stepper and hint; stopwatch hides them', () => {
    renderTimer();
    openSheet();
    expect(screen.getByRole('button', { name: '+ 1 min' })).toBeTruthy();
    expect(screen.getByRole('button', { name: SUBTRACT_ONE })).toBeTruthy();
    expect(screen.getByText(DURATION_HINT)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stopwatch' }));
    expect(screen.queryByRole('button', { name: '+ 1 min' })).toBeNull();
    expect(screen.queryByRole('button', { name: SUBTRACT_ONE })).toBeNull();
    expect(screen.queryByText(DURATION_HINT)).toBeNull();
    expect(sheet()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Countdown' }));
    expect(screen.getByRole('button', { name: '+ 1 min' })).toBeTruthy();
  });

  it('stepper adds a minute without starting', () => {
    renderTimer();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: '+ 1 min' }));
    expect(screen.getAllByText('26:00').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(2);
    expect(sheet()).toBeTruthy();
  });

  it('stepper subtract clamps at 1:00', () => {
    renderTimer();
    openSheet();
    for (let i = 0; i < 30; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: SUBTRACT_ONE }));
    }
    expect(screen.getAllByText('01:00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: SUBTRACT_ONE }));
    expect(screen.getAllByText('01:00').length).toBeGreaterThan(0);
  });

  it('stepper and hint hide while running', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    openSheet();
    expect(screen.queryByRole('button', { name: '+ 1 min' })).toBeNull();
    expect(screen.queryByRole('button', { name: SUBTRACT_ONE })).toBeNull();
    expect(screen.queryByText(DURATION_HINT)).toBeNull();
    expect(sheet()).toBeTruthy();
  });

  it('circular play from idle closes the sheet; reset is disabled when idle', () => {
    renderTimer();
    openSheet();
    const plays = screen.getAllByRole('button', { name: 'Play' });
    expect(plays).toHaveLength(2);
    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    expect(resetBtn.getAttribute('disabled')).not.toBeNull();
    expect(resetBtn.getAttribute('style') ?? '').toContain('0.45');
    const secondPlay = plays[1];
    expect(secondPlay).toBeTruthy();
    fireEvent.click(secondPlay!);
    expect(sheet()).toBeNull();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('reset enables after progress, restores the duration and never closes', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    openSheet();
    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    expect(resetBtn.getAttribute('disabled')).toBeNull();
    fireEvent.click(resetBtn);
    expect(screen.getAllByText('25:00').length).toBeGreaterThan(0);
    expect(sheet()).toBeTruthy();
  });

  it('fine pointer opens the inline panel instead of a dialog', () => {
    mockMatchMedia(false);
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Timer' }));
    expect(sheet()).toBeNull();
    expect(panel()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ 1 min' }));
    expect(screen.getAllByText('26:00').length).toBeGreaterThan(0);
    const panelPlay = screen.getAllByRole('button', { name: 'Play' })[1];
    expect(panelPlay).toBeTruthy();
    fireEvent.click(panelPlay!);
    expect(panel()).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Pause' })).toHaveLength(2);
  });

  it('number toggles the desktop panel closed on second click', () => {
    mockMatchMedia(false);
    renderTimer();
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Timer' }));
    expect(panel()).toBeNull();
  });

  it('Escape closes the desktop panel and refocuses the number button', () => {
    mockMatchMedia(false);
    renderTimer();
    openPanel();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Timer' }));
  });

  it('outside mousedown closes the desktop panel; inside does not', () => {
    mockMatchMedia(false);
    renderTimer();
    openPanel();
    const panelEl = panel() as HTMLElement;
    fireEvent.mouseDown(panelEl);
    expect(panel()).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(panel()).toBeNull();
  });

  it('chevron rotates 180deg while the desktop panel is open', () => {
    mockMatchMedia(false);
    renderTimer();
    const chevron = () =>
      (screen.getByRole('button', { name: 'Timer' }).querySelector('span[aria-hidden]') as HTMLElement);
    expect(chevron().getAttribute('style') ?? '').not.toContain('rotate(180deg)');
    openPanel();
    const openStyle = chevron().getAttribute('style') ?? '';
    expect(openStyle).toContain('rotate(180deg)');
    expect(openStyle).toContain('var(--duration-fast)');
    fireEvent.click(screen.getByRole('button', { name: 'Timer' }));
    expect(chevron().getAttribute('style') ?? '').not.toContain('rotate(180deg)');
  });

  it('desktop panel play never closes; reset never closes', () => {
    mockMatchMedia(false);
    renderTimer();
    openPanel();
    const desktopPlay = screen.getAllByRole('button', { name: 'Play' })[1];
    expect(desktopPlay).toBeTruthy();
    fireEvent.click(desktopPlay!);
    expect(panel()).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    expect(resetBtn.getAttribute('disabled')).toBeNull();
    fireEvent.click(resetBtn);
    expect(panel()).toBeTruthy();
    expect(screen.getAllByText('25:00').length).toBeGreaterThan(0);
  });

  it('quick toggle plays and pauses without opening the sheet', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(sheet()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText('24:55')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText('24:55')).toBeTruthy();
    expect(sheet()).toBeNull();
  });

  it('turns amber at ten seconds or less of countdown', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Timer' }).getAttribute('style') ?? '').not.toContain(
      'var(--status-warn)',
    );
    act(() => {
      vi.advanceTimersByTime((25 * 60 - 10) * 1000);
    });
    expect(screen.getByText('00:10')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Timer' }).getAttribute('style') ?? '').toContain(
      'var(--status-warn)',
    );
  });

  it('shows the finished badge on completion', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });
    expect(screen.getByText('00:00')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });
});
