import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { zoomAtPoint, type ViewState } from '../features/whiteboard/geometry';

export interface CanvasViewOptions {
  minZoom?: number;
  maxZoom?: number;
  /** Wheel-up factor (default 1.12). */
  zoomInFactor?: number;
  /** Wheel-down factor (default 1/1.12). Schema ERD uses 0.89. */
  zoomOutFactor?: number;
  /** Extra side effect per wheel gesture (e.g. ERD clears tooltips). */
  onWheel?: () => void;
  /** Called when a two-finger pinch takes over (e.g. ERD aborts node/connect drags). */
  onPinchTakeover?: () => void;
}

/**
 * WB-12: shared canvas view — the single spec for pan/zoom across canvases.
 * View math (zoom-at-cursor, centroid pinch) is identical to the schema ERD
 * canvas; ERD keeps its own wiring (separate wheel/pinch targets + drag refs)
 * until its suite is migrated, so this hook is currently adopted by Whiteboard.
 */
export function useCanvasView(panEnabled: boolean, opts: CanvasViewOptions = {}) {
  const {
    minZoom = 0.3,
    maxZoom = 3,
    zoomInFactor = 1.12,
    zoomOutFactor = 1 / 1.12,
    onWheel,
    onPinchTakeover,
  } = opts;
  const [view, setView] = useState<ViewState>({ x: 16, y: 16, s: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const optsRef = useRef({ onWheel, onPinchTakeover });
  optsRef.current = { onWheel, onPinchTakeover };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      optsRef.current.onWheel?.();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? zoomInFactor : zoomOutFactor;
      setView((v) => zoomAtPoint(v, e.clientX - rect.left, e.clientY - rect.top, factor, minZoom, maxZoom));
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [zoomInFactor, zoomOutFactor, minZoom, maxZoom]);

  // Pinch zoom — two-finger touch gestures take over pan/tool interactions.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: { dist: number; cx: number; cy: number; view: ViewState } | null = null;
    let pinching = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        e.stopPropagation();
        if (!pinching) {
          const pts = [...pointers.values()];
          const a = pts[0];
          const b = pts[1];
          if (!a || !b) return;
          const rect = el.getBoundingClientRect();
          pinchStart = {
            dist: Math.hypot(a.x - b.x, a.y - b.y),
            cx: (a.x + b.x) / 2 - rect.left,
            cy: (a.y + b.y) / 2 - rect.top,
            view: viewRef.current,
          };
          pinching = true;
          optsRef.current.onPinchTakeover?.();
          dragStartRef.current = null;
          setDragging(false);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinching || !pinchStart || pointers.size < 2) return;
      e.stopPropagation();
      const pts = [...pointers.values()];
      const a = pts[0];
      const b = pts[1];
      if (!a || !b) return;
      const rect = el.getBoundingClientRect();
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      if (pinchStart.dist <= 0) return;
      const factor = dist / pinchStart.dist;
      const base = zoomAtPoint(pinchStart.view, pinchStart.cx, pinchStart.cy, factor, minZoom, maxZoom);
      setView({ ...base, x: base.x + (cx - pinchStart.cx), y: base.y + (cy - pinchStart.cy) });
    };

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pinching && pointers.size < 2) {
        pinching = false;
        pinchStart = null;
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endPointer);
      el.removeEventListener('pointercancel', endPointer);
    };
  }, [minZoom, maxZoom]);

  const zoomAt = (factor: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView((v) => zoomAtPoint(v, rect.width / 2, rect.height / 2, factor, minZoom, maxZoom));
  };

  const resetView = () => setView({ x: 16, y: 16, s: 1 });

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !panEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: view.x, y: view.y };
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setView((v) => ({
      ...v,
      x: start.x + (e.clientX - start.pointerX),
      y: start.y + (e.clientY - start.pointerY),
    }));
  };

  const endDrag = () => {
    dragStartRef.current = null;
    setDragging(false);
  };

  return {
    view,
    setView,
    viewRef,
    dragging,
    zoomAt,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    ref: svgRef,
  };
}
