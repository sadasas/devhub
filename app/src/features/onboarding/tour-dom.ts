/**
 * Shared DOM helpers for the onboarding tour (spotlight ring + anchored popover).
 * Pure geometry lives here so it stays unit-testable without a browser.
 */

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PopoverSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export type PopoverPlacement = 'bottom' | 'top' | 'right' | 'left' | 'center';

export interface PopoverPosition {
  top: number;
  left: number;
  placement: PopoverPlacement;
}

export const TOUR_POPOVER_GAP = 12;
export const TOUR_POPOVER_MARGIN = 8;
/** Estimate used before the popover measures itself. */
export const TOUR_POPOVER_ESTIMATE: PopoverSize = { width: 320, height: 220 };

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

function escapeId(id: string): string {
  try {
    return CSS.escape(id);
  } catch {
    return id.replace(/["\\]/g, '\\$&');
  }
}

/** Scopes in priority order: sidebar chrome first, page content as fallback. */
const TOUR_ANCHOR_SCOPES = ['.sidebar', '#mobile-nav-drawer'];

function elementRect(el: Element): AnchorRect {
  try {
    const r = (el as HTMLElement).getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  } catch {
    return { top: 0, left: 0, width: 0, height: 0 };
  }
}

function isLaidOut(el: Element): boolean {
  const r = elementRect(el);
  return r.width > 0 && r.height > 0;
}

/**
 * Resolve by element id first, then [data-tour-id] anchor.
 * Priority: visible match inside sidebar scopes (.sidebar,
 * mobile drawer) wins over page-content matches, so the coachmark points
 * at the sidebar — not the big dashboard button. Falls back to any visible
 * match (e.g. dashboard when the drawer is closed), then to the first
 * match regardless of layout (jsdom / not yet measured).
 */
export function resolveTarget(id: string): HTMLElement | null {
  try {
    const byId = document.getElementById(id);
    if (byId) return byId;
    const sel = `[data-tour-id="${escapeId(id)}"]`;
    for (const scope of TOUR_ANCHOR_SCOPES) {
      const scoped = document.querySelector(`${scope} ${sel}`) as HTMLElement | null;
      if (scoped && isLaidOut(scoped)) return scoped;
    }
    const all = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    return all.find((el) => isLaidOut(el)) ?? all[0] ?? null;
  } catch {
    return null;
  }
}

export function resolveTargets(ids: string[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const id of ids) {
    const el = resolveTarget(id);
    if (el && !out.includes(el)) out.push(el);
  }
  return out;
}

function domRect(el: HTMLElement): AnchorRect {
  try {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  } catch {
    return { top: 0, left: 0, width: 0, height: 0 };
  }
}

/**
 * Union bounding box of the given elements (user choice: "box gabungan").
 * Returns null when nothing resolves or every rect is empty (jsdom / hidden).
 */
export function unionRect(els: HTMLElement[]): AnchorRect | null {
  const rects = els.map(domRect).filter((r) => r.width > 0 && r.height > 0);
  if (rects.length === 0) return null;
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  return { top, left, width: right - left, height: bottom - top };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

/**
 * Pick popover position for an anchor box. Preference order:
 * bottom > top > right > left; each must fully fit inside the viewport
 * (minus margin). Falls back to the side with the most space (clamped),
 * or centered when there is no anchor at all.
 */
export function computePopoverPlacement(
  anchor: AnchorRect | null,
  size: PopoverSize,
  viewport: ViewportSize,
  gap = TOUR_POPOVER_GAP,
): PopoverPosition {
  const m = TOUR_POPOVER_MARGIN;
  if (!anchor) {
    return {
      top: Math.max(m, (viewport.height - size.height) / 2),
      left: Math.max(m, (viewport.width - size.width) / 2),
      placement: 'center',
    };
  }
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;

  const fits = {
    bottom: anchor.top + anchor.height + gap + size.height <= viewport.height - m,
    top: anchor.top - gap - size.height >= m,
    right: anchor.left + anchor.width + gap + size.width <= viewport.width - m,
    left: anchor.left - gap - size.width >= m,
  };

  if (fits.bottom) {
    return {
      top: anchor.top + anchor.height + gap,
      left: clamp(cx - size.width / 2, m, Math.max(m, viewport.width - size.width - m)),
      placement: 'bottom',
    };
  }
  if (fits.top) {
    return {
      top: anchor.top - gap - size.height,
      left: clamp(cx - size.width / 2, m, Math.max(m, viewport.width - size.width - m)),
      placement: 'top',
    };
  }
  if (fits.right) {
    return {
      top: clamp(cy - size.height / 2, m, Math.max(m, viewport.height - size.height - m)),
      left: anchor.left + anchor.width + gap,
      placement: 'right',
    };
  }
  if (fits.left) {
    return {
      top: clamp(cy - size.height / 2, m, Math.max(m, viewport.height - size.height - m)),
      left: anchor.left - gap - size.width,
      placement: 'left',
    };
  }

  // Nothing fits fully: take the roomiest side and clamp inside the viewport.
  const space = {
    bottom: viewport.height - m - (anchor.top + anchor.height + gap),
    top: anchor.top - gap - m,
    right: viewport.width - m - (anchor.left + anchor.width + gap),
    left: anchor.left - gap - m,
  };
  const roomiest = (Object.keys(space) as Array<keyof typeof space>).reduce((a, b) =>
    space[a] >= space[b] ? a : b,
  );
  if (roomiest === 'bottom' || roomiest === 'top') {
    return {
      top:
        roomiest === 'bottom'
          ? anchor.top + anchor.height + gap
          : Math.max(m, anchor.top - gap - size.height),
      left: clamp(cx - size.width / 2, m, Math.max(m, viewport.width - size.width - m)),
      placement: roomiest,
    };
  }
  return {
    top: clamp(cy - size.height / 2, m, Math.max(m, viewport.height - size.height - m)),
    left:
      roomiest === 'right'
        ? anchor.left + anchor.width + gap
        : Math.max(m, anchor.left - gap - size.width),
    placement: roomiest,
  };
}

/** Arrow offset (px) along the popover edge pointing back at the anchor center. */
export function arrowOffset(
  anchor: AnchorRect,
  pos: PopoverPosition,
  size: PopoverSize,
): number {
  const min = 16;
  if (pos.placement === 'bottom' || pos.placement === 'top') {
    return clamp(anchor.left + anchor.width / 2 - pos.left, min, Math.max(min, size.width - min));
  }
  if (pos.placement === 'left' || pos.placement === 'right') {
    return clamp(anchor.top + anchor.height / 2 - pos.top, min, Math.max(min, size.height - min));
  }
  return 0;
}

/**
 * Resume fast-forward: skip gates already satisfied (e.g. tour restarts at
 * the team step but a team exists). Step 2 + project is handled by the
 * caller via workspace navigation, not here.
 */
export function fastForwardStep(step: number, hasTeam: boolean): number {
  if (step === 1 && hasTeam) return 2;
  return step;
}

/** Breathing room between a target edge and its overlay cutout (px). */
export const TOUR_HOLE_PAD = 6;

/** SVG rounded-rect subpath (for evenodd cutouts). */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${x + rr},${y}` +
    `h${w - rr * 2}a${rr},${rr} 0 0 1 ${rr},${rr}` +
    `v${h - rr * 2}a${rr},${rr} 0 0 1 ${-rr},${rr}` +
    `h${-(w - rr * 2)}a${rr},${rr} 0 0 1 ${-rr},${-rr}` +
    `v${-(h - rr * 2)}a${rr},${rr} 0 0 1 ${rr},${-rr}z`
  );
}

/**
 * Merge padded boxes that touch or overlap into single blocks, so adjacent
 * targets (e.g. Board + Issue tabs, 2px apart) render as one clean cutout
 * instead of two seamed rings. Distant targets stay separate holes.
 */
export function mergeRects(rects: AnchorRect[]): AnchorRect[] {
  const boxes = rects.map((r) => ({ ...r }));
  const touches = (a: AnchorRect, b: AnchorRect) =>
    a.left <= b.left + b.width &&
    b.left <= a.left + a.width &&
    a.top <= b.top + b.height &&
    b.top <= a.top + a.height;
  const union = (a: AnchorRect, b: AnchorRect): AnchorRect => {
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const right = Math.max(a.left + a.width, b.left + b.width);
    const bottom = Math.max(a.top + a.height, b.top + b.height);
    return { left, top, width: right - left, height: bottom - top };
  };
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (touches(boxes[i]!, boxes[j]!)) {
          boxes[i] = union(boxes[i]!, boxes[j]!);
          boxes.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return boxes;
}

/**
 * Newest team id for the tour-forced sidebar context (step 2): most
 * recently updated team, falling back to the first. Null when team-less.
 */
export function newestTeamId(
  teams: ReadonlyArray<{ id: string; updatedAt?: string }> | null | undefined,
): string | null {
  if (!teams || teams.length === 0) return null;
  let best = teams[0]!;
  let bestTime = Date.parse(best.updatedAt ?? '') || 0;
  for (const t of teams) {
    const time = Date.parse(t.updatedAt ?? '') || 0;
    if (time > bestTime) {
      best = t;
      bestTime = time;
    }
  }
  return best.id;
}
