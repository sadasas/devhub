import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface ViewportPanelPos {
  top: number;
  left: number;
  width: number;
}

/**
 * Viewport-clamped popover position below an anchor (PresenceChip pattern,
 * centered): panel centered under the button (`anchor.centerX - width/2`),
 * clamped to `8..vw-8-width` so it never clips at edges; `top = anchor.bottom
 * + 8` keeps a clear gap. Width capped at `vw-24`. Recomputed on resize.
 *
 * `pickAnchor` (optional): resolve the real anchor from the ref element —
 * e.g. climb to a shared container so sibling triggers open one centered
 * panel instead of one panel per trigger.
 */
export function useViewportPanel<T extends HTMLElement>(
  anchorRef: RefObject<T | null>,
  width: number,
  pickAnchor?: (el: T | null) => HTMLElement | null,
): ViewportPanelPos {
  const compute = useCallback((): ViewportPanelPos => {
    const fallback = (vw: number): ViewportPanelPos => ({
      top: 8,
      left: 8,
      width: Math.max(0, Math.min(width, vw - 24)),
    });
    if (typeof window === 'undefined') return { top: 0, left: 0, width };
    const raw = anchorRef.current;
    const el = pickAnchor ? pickAnchor(raw) : raw;
    const vw = window.innerWidth;
    if (!el) return fallback(vw);
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(width, vw - 24));
    return {
      top: r.bottom + 8,
      left: Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - 8 - w)),
      width: w,
    };
  }, [anchorRef, width, pickAnchor]);

  const [pos, setPos] = useState<ViewportPanelPos>(() =>
    typeof window === 'undefined'
      ? { top: 0, left: 0, width }
      : { top: 8, left: 8, width: Math.max(0, Math.min(width, window.innerWidth - 24)) },
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
