import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { mergeRects, prefersReducedMotion, resolveTargets, roundedRectPath, TOUR_HOLE_PAD } from './tour-dom';
import type { AnchorRect } from './tour-dom';

interface TourSpotlightProps {
  targetIds: string[];
  /** Hide while another modal (create team/project) sits above the tour. */
  suppressed?: boolean;
}

function padRect(r: AnchorRect, pad: number): AnchorRect {
  return { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

const HOLE_RADIUS = 10;

function domRect(el: HTMLElement): AnchorRect | null {
  try {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  } catch {
    return null;
  }
}

function sameRects(a: AnchorRect[], b: AnchorRect[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (r, i) =>
      r.top === b[i]!.top && r.left === b[i]!.left && r.width === b[i]!.width && r.height === b[i]!.height,
  );
}

function viewportSize() {
  try {
    return { width: window.innerWidth, height: window.innerHeight };
  } catch {
    return { width: 1280, height: 800 };
  }
}

/**
 * Body-level dim overlay with per-target cutout holes (driver.js pattern).
 * Holes have no overlay pixels, so clicks pass straight to the real glowing
 * button — no z-index raising, immune to stacking contexts, overflow
 * clipping, and sidebar expand transitions. Clicks on the dim are ignored
 * (never skip). Resolution is continuous (mutation + scroll/resize + 500ms
 * poll) instead of give-up retries, so late-mounting targets always join.
 */
export function TourSpotlight({ targetIds, suppressed = false }: TourSpotlightProps) {
  const key = targetIds.join('|');
  const [holes, setHoles] = useState<AnchorRect[]>([]);
  const [viewport, setViewport] = useState(viewportSize);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (suppressed || targetIds.length === 0) return;
    const reduced = prefersReducedMotion();
    let cancelled = false;
    let raf = 0;

    const resolve = (scroll: boolean) => {
      if (cancelled) return;
      const els = resolveTargets(targetIds);
      const rects: AnchorRect[] = [];
      for (const el of els) {
        const r = domRect(el);
        if (r) rects.push(padRect(r, TOUR_HOLE_PAD));
      }
      // Adjacent targets (e.g. Board + Issue tabs) merge into one block
      // so the cutout never renders as seamed twin boxes.
      const merged = mergeRects(rects);
      setHoles((prev) => (sameRects(prev, merged) ? prev : merged));
      setViewport((prev) => {
        const next = viewportSize();
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
      if (scroll && !scrolledRef.current && els.length > 0) {
        scrolledRef.current = true;
        try {
          els[0]!.scrollIntoView({
            behavior: reduced ? 'auto' : 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        } catch {
          /* scroll unavailable */
        }
      }
    };

    scrolledRef.current = false;
    resolve(true);
    const observer = (() => {
      try {
        const o = new MutationObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => resolve(false));
        });
        o.observe(document.body, { childList: true, subtree: true });
        return o;
      } catch {
        return null;
      }
    })();
    const poll = window.setInterval(() => resolve(false), 500);
    const onScrollResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => resolve(false));
    };
    window.addEventListener('resize', onScrollResize);
    window.addEventListener('scroll', onScrollResize, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearInterval(poll);
      window.removeEventListener('resize', onScrollResize);
      window.removeEventListener('scroll', onScrollResize, true);
      try {
        observer?.disconnect();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, suppressed]);

  if (suppressed || targetIds.length === 0) return null;

  const dimPath =
    `M0,0H${viewport.width}V${viewport.height}H0Z` +
    holes.map((h) => roundedRectPath(h.left, h.top, h.width, h.height, HOLE_RADIUS)).join('');

  return createPortal(
    <div className="tour-overlay" aria-hidden="true" data-tour="spotlight">
      <svg className="tour-overlay-svg" width={viewport.width} height={viewport.height} aria-hidden="true">
        <path d={dimPath} fillRule="evenodd" className="tour-overlay-dim" pointerEvents="auto" />
        {holes.map((h, i) => (
          <g key={i} pointerEvents="none">
            <rect
              x={h.left + 3}
              y={h.top + 3}
              width={Math.max(0, h.width - 6)}
              height={Math.max(0, h.height - 6)}
              rx={HOLE_RADIUS - 3}
              className="tour-overlay-glow"
            />
            <rect
              x={h.left}
              y={h.top}
              width={h.width}
              height={h.height}
              rx={HOLE_RADIUS}
              className="tour-overlay-ring"
            />
          </g>
        ))}
      </svg>
    </div>,
    document.body,
  );
}
