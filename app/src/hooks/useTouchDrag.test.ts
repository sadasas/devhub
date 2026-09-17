import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useTouchDrag } from './useTouchDrag';

function touchEvent(type: string, x = 0, y = 0): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { pointerType: 'touch', clientX: x, clientY: y });
  return e;
}

function setupCard(onDrop = vi.fn()) {
  const el = document.createElement('button');
  document.body.appendChild(el);
  const ref = { current: el } as RefObject<HTMLButtonElement | null>;
  renderHook(({ r }) => useTouchDrag(r, { enabled: true, onDrop }), {
    initialProps: { r: ref },
  });
  return { el, onDrop };
}

describe('useTouchDrag tap vs drag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom tidak mengimplementasikan hit-testing.
    document.elementFromPoint = () => null;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('lets a slow tap through: long-press without movement is not a drag', () => {
    const { el, onDrop } = setupCard();
    el.dispatchEvent(touchEvent('pointerdown'));
    vi.advanceTimersByTime(250);
    window.dispatchEvent(touchEvent('pointerup'));

    expect(onDrop).not.toHaveBeenCalled();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(el.dispatchEvent(click)).toBe(true);
  });

  it('still drops and suppresses the click after a real press-and-move drag', () => {
    const { el, onDrop } = setupCard();
    el.dispatchEvent(touchEvent('pointerdown'));
    vi.advanceTimersByTime(250);
    window.dispatchEvent(touchEvent('pointermove', 60, 0));
    window.dispatchEvent(touchEvent('pointerup', 60, 0));

    expect(onDrop).toHaveBeenCalledTimes(1);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(el.dispatchEvent(click)).toBe(false);
  });

  it('does not let a stale flag from pointercancel swallow the next tap', () => {
    const { el, onDrop } = setupCard();
    el.dispatchEvent(touchEvent('pointerdown'));
    vi.advanceTimersByTime(250);
    window.dispatchEvent(touchEvent('pointercancel'));

    expect(onDrop).not.toHaveBeenCalled();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(el.dispatchEvent(click)).toBe(true);
  });
});
