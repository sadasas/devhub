import type { WhiteboardShape } from '../../lib/types';
import { shapePath } from './geometry';

interface ShapeThumbProps {
  shapeType: WhiteboardShape['shapeType'];
  size?: number;
}

/**
 * Shared shape thumbnail (P11a): padded square box + visible overflow so
 * decorated geometries (actor head, antennas, seal spikes, doc folds) are
 * never clipped by the 40x40 viewport. Used by the library, primer strip
 * and floating-bar type grid alike.
 */
export function ShapeThumb({ shapeType, size = 40 }: ShapeThumbProps) {
  const thumb: WhiteboardShape = {
    id: `thumb-${shapeType}`,
    kind: 'shape',
    shapeType,
    x: 6,
    y: 6,
    w: 28,
    h: 28,
    color: '#6ea8fe',
    fill: false,
    strokeWidth: 2,
    label: '',
  };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" style={{ overflow: 'visible' }}>
      <path d={shapePath(thumb)} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

/** The exact box ShapeThumb renders — reused by the bounds test. */
export const SHAPE_THUMB_BOX = { x: 6, y: 6, w: 28, h: 28 } as const;
