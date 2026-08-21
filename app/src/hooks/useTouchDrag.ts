import { useEffect, useRef, type RefObject } from 'react';

const DRAG_DELAY_MS = 180;
const MOVE_THRESHOLD_PX = 10;
const SCROLL_EDGE_PX = 40;
const SCROLL_STEP_PX = 12;

interface UseTouchDragOptions {
  enabled: boolean;
  onDrop: (dropKey: string | null) => void;
}

export function useTouchDrag<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseTouchDragOptions,
) {
  const onDropRef = useRef(options.onDrop);
  onDropRef.current = options.onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el || !options.enabled) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches) return;

    let timer: number | undefined;
    let dragging = false;
    let suppressClick = false;
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
      clearTimer();
      timer = window.setTimeout(() => {
        dragging = true;
        suppressClick = true;
        el.classList.add('dragging');
        scrollEl = el.closest('.kanban');
      }, DRAG_DELAY_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
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
      if (
        timer &&
        (Math.abs(e.clientX - startX) > MOVE_THRESHOLD_PX ||
          Math.abs(e.clientY - startY) > MOVE_THRESHOLD_PX)
      ) {
        clearTimer();
      }
    };

    const finish = (e: PointerEvent) => {
      if (!dragging) {
        clearTimer();
        return;
      }
      dragging = false;
      el.classList.remove('dragging');
      const key = dropKeyAt(e.clientX, e.clientY);
      setActive(null);
      e.preventDefault();
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
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [ref, options.enabled]);
}