import { useEffect, useRef, type RefObject } from 'react';

const DRAG_DELAY_MS = 180;
const MOVE_THRESHOLD_PX = 10;
const SCROLL_EDGE_PX = 40;
const SCROLL_STEP_PX = 12;

interface UseTouchDragOptions {
  enabled: boolean;
  onDrop: (dropKey: string | null) => void;
  /** Accessible task name used in the live-region announcement. Falls back to the element's own label/text. */
  label?: string;
  /** Optional extra announcer (e.g. app-wide live region). Called with the same message written to the local live region. */
  onAnnounce?: (message: string) => void;
}

const LIVE_REGION_ID = 'touch-drag-live';

function ensureLiveRegion(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let live = document.getElementById(LIVE_REGION_ID);
  if (!live) {
    live = document.createElement('div');
    live.id = LIVE_REGION_ID;
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.className = 'sr-only';
    document.body.appendChild(live);
  }
  return live;
}

function announce(message: string): void {
  // Mirror to the app-wide announcer when present (Layout listens for this).
  try {
    window.dispatchEvent(new CustomEvent('devhub:announce', { detail: { message } }));
  } catch {
    // ignore — live region below is the guaranteed path
  }
  const live = ensureLiveRegion();
  if (!live) return;
  // Clear-then-set so repeated identical moves are re-announced.
  live.textContent = '';
  window.setTimeout(() => {
    const current = document.getElementById(LIVE_REGION_ID);
    if (current) current.textContent = message;
  }, 30);
}

function labelFor(el: HTMLElement, fallback?: string): string {
  if (fallback) return fallback;
  const aria = el.getAttribute('aria-label');
  if (aria) {
    // CalTaskChip labels look like "Title. Press M …" — keep just the title.
    const first = aria.split('.')[0]?.trim();
    if (first) return first.length > 80 ? `${first.slice(0, 77)}…` : first;
  }
  const text = el.textContent?.trim().replace(/\s+/g, ' ');
  if (text) return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  return 'Task';
}

function prettyDropKey(key: string): string {
  if (key === 'clear') return 'Tanpa tanggal';
  if (key.startsWith('date:')) return key.slice('date:'.length);
  return key;
}

export function useTouchDrag<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseTouchDragOptions,
) {
  const onDropRef = useRef(options.onDrop);
  onDropRef.current = options.onDrop;
  const labelRef = useRef(options.label);
  labelRef.current = options.label;
  const announceRef = useRef(options.onAnnounce);
  announceRef.current = options.onAnnounce;

  useEffect(() => {
    const el = ref.current;
    if (!el || !options.enabled) return;
    // H3: no hover-based early return — touch/pen gate lives in onPointerDown
    // via e.pointerType !== 'mouse', so hybrid laptops keep working.

    // Discoverability: expose the keyboard equivalents (kanban ArrowLeft/
    // ArrowRight in BoardPage, calendar "M" in CalTaskChip) to AT.
    const hadShortcuts = el.hasAttribute('aria-keyshortcuts');
    if (!hadShortcuts) {
      el.setAttribute(
        'aria-keyshortcuts',
        el.classList.contains('due-cal-task') ? 'm Enter' : 'ArrowLeft ArrowRight',
      );
    }

    let timer: number | undefined;
    let dragging = false;
    let suppressClick = false;
    let movedFar = false;
    let startX = 0;
    let startY = 0;
    let activeTarget: HTMLElement | null = null;
    let scrollEl: HTMLElement | null = null;

    const setActive = (target: HTMLElement | null) => {
      if (activeTarget === target) return;
      activeTarget?.classList.remove('kanban-drop-active');
      activeTarget = target;
      target?.classList.add('kanban-drop-active');
    };

    const dropKeyAt = (x: number, y: number): string | null => {
      const under = document.elementFromPoint(x, y);
      const target = under?.closest<HTMLElement>('[data-drop-key]') ?? null;
      if (!target) return null;
      setActive(target);
      return target.dataset.dropKey ?? null;
    };

    const clearTimer = () => {
      window.clearTimeout(timer);
      timer = undefined;
    };

    const cancel = () => {
      clearTimer();
      suppressClick = false;
      if (dragging) {
        dragging = false;
        el.classList.remove('dragging');
        setActive(null);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      if ((e.target as HTMLElement | null)?.closest?.('.task-card-pin')) return;
      startX = e.clientX;
      startY = e.clientY;
      movedFar = false;
      // Gesture baru mulai bersih: flag dari gesture sebelumnya (mis.
      // pointercancel tanpa klik susulan) tidak boleh menelan tap ini.
      suppressClick = false;
      clearTimer();
      timer = window.setTimeout(() => {
        dragging = true;
        suppressClick = true;
        el.classList.add('dragging');
        scrollEl = el.closest('.kanban');
      }, DRAG_DELAY_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (
        Math.abs(e.clientX - startX) > MOVE_THRESHOLD_PX ||
        Math.abs(e.clientY - startY) > MOVE_THRESHOLD_PX
      ) {
        movedFar = true;
      }
      if (dragging) {
        e.preventDefault();
        if (scrollEl) {
          const rect = scrollEl.getBoundingClientRect();
          if (e.clientX > window.innerWidth - SCROLL_EDGE_PX) {
            scrollEl.scrollLeft += SCROLL_STEP_PX;
          } else if (e.clientX - rect.left < SCROLL_EDGE_PX) {
            scrollEl.scrollLeft -= SCROLL_STEP_PX;
          }
        }
        dropKeyAt(e.clientX, e.clientY);
        return;
      }
      if (timer) {
        if (
          Math.abs(e.clientX - startX) > MOVE_THRESHOLD_PX ||
          Math.abs(e.clientY - startY) > MOVE_THRESHOLD_PX
        ) {
          clearTimer();
        }
      }
    };

    const finish = (e: PointerEvent) => {
      if (!dragging) {
        clearTimer();
        return;
      }
      // Long-press tanpa gerak = tap lambat, bukan drag: batalkan diam-diam
      // agar klik menembus dan modal langsung terbuka (tanpa tap kedua),
      // dan jangan catat drop/announce palsu.
      if (!movedFar) {
        dragging = false;
        suppressClick = false;
        el.classList.remove('dragging');
        setActive(null);
        clearTimer();
        return;
      }
      dragging = false;
      el.classList.remove('dragging');
      const key = dropKeyAt(e.clientX, e.clientY);
      setActive(null);
      e.preventDefault();
      const name = labelFor(el, labelRef.current);
      const msg = key ? `Task ${name} pindah ke ${prettyDropKey(key)}` : `Task ${name} tidak dipindah`;
      announce(msg);
      announceRef.current?.(msg);
      onDropRef.current(key);
    };

    const onContextMenu = (e: Event) => {
      if (dragging || timer) e.preventDefault();
    };

    const onClickCapture = (e: MouseEvent) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('click', onClickCapture, true);

    return () => {
      clearTimer();
      if (!hadShortcuts) el.removeAttribute('aria-keyshortcuts');
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [ref, options.enabled]);
}