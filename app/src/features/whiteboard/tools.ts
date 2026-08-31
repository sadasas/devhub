import { newId } from '../../lib/utils';
import type { WhiteboardBoundary, WhiteboardRef, WhiteboardRefEntity, WhiteboardShape, WhiteboardSticky, WhiteboardStroke, WhiteboardText } from '../../lib/types';

/** Tools that draw on the canvas. `select` pans/zooms (and later selects); `view` pans/zooms only. */
export type WbTool = 'view' | 'select' | 'marquee' | 'pen' | 'eraser' | 'text' | 'sticky' | 'shape' | 'edge' | 'ref' | 'boundary';

export const PEN_COLOR = '#e4e4e7';
export const ERASER_COLOR = '#8a8a93';
export const PEN_WIDTH = 2;
export const ERASER_WIDTH = 6;
export const THINNING = 2;

export const STICKY_COLOR = '#e8b955';
export const TEXT_COLOR = '#e4e4e7';
export const SHAPE_COLOR = '#6ea8fe';
export const BOUNDARY_COLOR = '#6ea8fe';

export const STICKY_W = 200;
export const STICKY_H = 120;
export const TEXT_FONT_SIZE = 16;
export const SHAPE_W = 120;
export const SHAPE_H = 80;
export const SHAPE_STROKE_WIDTH = 2;
export const REF_W = 180;
export const REF_H = 44;

export function drawColor(tool: 'pen' | 'eraser'): string {
  return tool === 'pen' ? PEN_COLOR : ERASER_COLOR;
}

export function drawWidth(tool: 'pen' | 'eraser'): number {
  return tool === 'pen' ? PEN_WIDTH : ERASER_WIDTH;
}

/** Builds a stored stroke element from a completed gesture's points. */
export function buildStroke(
  tool: 'pen' | 'eraser',
  points: Array<[number, number]>,
  color: string = drawColor(tool),
  width: number = drawWidth(tool),
): WhiteboardStroke {
  return {
    id: newId(),
    kind: 'stroke',
    tool,
    color,
    width,
    thinning: THINNING,
    points,
  };
}

/** A gesture only commits when it produced at least two points (schema min). */
export function shouldCommitStroke(points: readonly [number, number][]): boolean {
  return points.length >= 2;
}

export function buildSticky(x: number, y: number, color: string = STICKY_COLOR, textColor: string | null = null): WhiteboardSticky {
  return { id: newId(), kind: 'sticky', x, y, w: STICKY_W, h: STICKY_H, color, text: '', textColor };
}

export function buildText(x: number, y: number, color: string = TEXT_COLOR): WhiteboardText {
  return { id: newId(), kind: 'text', x, y, color, fontSize: TEXT_FONT_SIZE, text: '' };
}

export function buildShape(
  x: number,
  y: number,
  color: string = SHAPE_COLOR,
  shapeType: WhiteboardShape['shapeType'] = 'rect',
  labelColor: string | null = null,
): WhiteboardShape {
  return {
    id: newId(),
    kind: 'shape',
    shapeType,
    x,
    y,
    w: SHAPE_W,
    h: SHAPE_H,
    color,
    fill: false,
    strokeWidth: SHAPE_STROKE_WIDTH,
    label: '',
    labelColor,
  };
}

export function buildRef(x: number, y: number, entity: WhiteboardRefEntity, entityId: string): WhiteboardRef {
  return { id: newId(), kind: 'ref', entity, entityId, x, y };
}

export function buildBoundary(x: number, y: number, w: number, h: number, color: string = BOUNDARY_COLOR): WhiteboardBoundary {
  return { id: newId(), kind: 'boundary', x, y, w, h, color, label: '' };
}