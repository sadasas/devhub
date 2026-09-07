import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  TOUR_POPOVER_ESTIMATE,
  arrowOffset,
  computePopoverPlacement,
  resolveTargets,
  unionRect,
  type AnchorRect,
  type PopoverSize,
} from './tour-dom';

interface TourPopoverProps {
  targetIds: string[];
  labelledBy: string;
  describedBy?: string;
  onEscape: () => void;
  children: ReactNode;
}

function viewportSize() {
  try {
    return { width: window.innerWidth, height: window.innerHeight };
  } catch {
    return { width: 1280, height: 800 };
  }
}

/**
 * Non-modal anchored coachmark: points at the union box ("box gabungan")
 * of the step targets instead of sitting static in the viewport center.
 * The dim backdrop stays pointer-events:none, so the glowing real button
 * remains clickable — the card only explains, never blocks.
 * Renders a centered card until the anchor resolves (lazy tabs), then
 * glides to the target.
 */
export function TourPopover({ targetIds, labelledBy, describedBy, onEscape, children }: TourPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [size, setSize] = useState<PopoverSize>(TOUR_POPOVER_ESTIMATE);
  const [viewport, setViewport] = useState(viewportSize);
  const key = targetIds.join('|');
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  // Resolve anchor (union box) with retries for lazy-mounted tabs.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const onMove = () => {
      if (cancelled) return;
      const box = unionRect(resolveTargets(targetIds));
      setAnchor((prev) => {
        if (!box && !prev) return prev;
        if (box && prev && box.top === prev.top && box.left === prev.left && box.width === prev.width && box.height === prev.height) {
          return prev;
        }
        return box;
      });
      setViewport(viewportSize());
    };

    const apply = (attempt: number) => {
      if (cancelled) return;
      const els = resolveTargets(targetIds);
      const box = unionRect(els);
      if (box) {
        setAnchor(box);
        if (typeof ResizeObserver !== 'undefined') {
          try {
            observer = new ResizeObserver(onMove);
            for (const el of els) observer.observe(el);
          } catch {
            observer = null;
          }
        }
        return;
      }
      if (attempt < 4) {
        window.setTimeout(() => apply(attempt + 1), 120);
      }
    };

    setAnchor(null);
    apply(0);

    let raf = 0;
    const onScrollResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(onMove);
    };
    window.addEventListener('resize', onScrollResize);
    window.addEventListener('scroll', onScrollResize, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onScrollResize);
      window.removeEventListener('scroll', onScrollResize, true);
      try {
        observer?.disconnect();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Measure the card itself so placement uses the real size.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) {
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    let observer: ResizeObserver | null = null;
    try {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    } catch {
      observer = null;
    }
    return () => {
      try {
        observer?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [key]);

  // ESC skips (Modal did this for the welcome step; popover owns it here).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') escapeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const pos = useMemo(
    () => computePopoverPlacement(anchor, size, viewport),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor?.top, anchor?.left, anchor?.width, anchor?.height, size.width, size.height, viewport.width, viewport.height],
  );

  const centered = pos.placement === 'center';
  const arrow = !centered && anchor ? arrowOffset(anchor, pos, size) : 0;

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-tour="popover"
      data-placement={pos.placement}
      className={centered ? 'tour-popover tour-popover-centered' : 'tour-popover'}
      style={centered ? undefined : { top: pos.top, left: pos.left }}
    >
      {!centered && (
        <span
          className="tour-popover-arrow"
          data-placement={pos.placement}
          aria-hidden="true"
          style={
            pos.placement === 'bottom' || pos.placement === 'top'
              ? { left: arrow }
              : { top: arrow }
          }
        />
      )}
      {children}
    </div>,
    document.body,
  );
}
