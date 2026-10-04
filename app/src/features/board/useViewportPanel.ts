import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface ViewportPanelPos {
  top: number;
  left: number;
  width: number;
}

/**
 * Viewport-clamped popover position below an anchor (PresenceChip pattern,
 * left-aligned): panel's left edge follows the anchor's left edge, clamped to
 * `8..vw-8-width`; `top = anchor.bottom + 6`; width capped at `vw-24`.
 * Keeps small panels (timer, radio) exactly under their pill buttons without
 * clipping at viewport edges. Recomputed on resize.
 */
export function useViewportPanel<T extends HTMLElement>(
  anchorRef: RefObject<T | null>,
  width: number,
): ViewportPanelPos {
  const compute = useCallback((): ViewportPanelPos => {
    const fallback = (vw: number): ViewportPanelPos => ({
      top: 6,
      left: 8,
      width: Math.max(0, Math.min(width, vw - 24)),
    });
    if (typeof window === 'undefined') return { top: 0, left: 0, width };
    const el = anchorRef.current;
    const vw = window.innerWidth;
    if (!el) return fallback(vw);
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(width, vw - 24));
    return {
      top: r.bottom + 6,
      left: Math.max(8, Math.min(r.left, vw - 8 - w)),
      width: w,
    };
  }, [anchorRef, width]);

  const [pos, setPos] = useState<ViewportPanelPos>(() =>
    typeof window === 'undefined'
      ? { top: 0, left: 0, width }
      : { top: 6, left: 8, width: Math.max(0, Math.min(width, window.innerWidth - 24)) },
  );

  useEffect(() => {
    // Set only on real change: keeps unstable inputs (and resize storms)
    // from retriggering renders in a loop.
    setPos((prev) => {
      const next = compute();
      return prev.top === next.top && prev.left === next.left && prev.width === next.width
        ? prev
        : next;
    });
    const onResize = () => {
      setPos((prev) => {
        const next = compute();
        return prev.top === next.top && prev.left === next.left && prev.width === next.width
          ? prev
          : next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [compute]);

  return pos;
}
