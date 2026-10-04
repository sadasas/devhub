import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewportPanel } from './useViewportPanel';

describe('useViewportPanel', () => {
  it('clamps to the viewport when the anchor rect is empty (jsdom zeros)', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    // NOTE: stable ref object — an inline `{ current }` literal would change
    // identity every render and retrigger the effect endlessly.
    const ref = { current: anchor as HTMLButtonElement | null };
    const { result } = renderHook(() => useViewportPanel(ref, 280));
    // jsdom: rect all zeros, innerWidth 1024 → left clamps to the 8px rail.
    expect(result.current.top).toBe(6);
    expect(result.current.left).toBe(8);
    expect(result.current.width).toBe(280);
    anchor.remove();
  });

  it('falls back to the rail without an anchor', () => {
    const ref = { current: null as HTMLButtonElement | null };
    const { result } = renderHook(() => useViewportPanel(ref, 360));
    expect(result.current).toEqual({ top: 6, left: 8, width: 360 });
  });

  it('caps width on narrow viewports', () => {
    const prev = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
    try {
      const ref = { current: null as HTMLButtonElement | null };
      const { result } = renderHook(() => useViewportPanel(ref, 500));
      expect(result.current.width).toBe(376);
      expect(result.current.left).toBe(8);
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: prev,
      });
    }
  });
});
