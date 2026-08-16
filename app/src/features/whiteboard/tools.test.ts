import { describe, expect, it } from 'vitest';
import {
  ERASER_COLOR,
  ERASER_WIDTH,
  PEN_COLOR,
  PEN_WIDTH,
  SHAPE_COLOR,
  SHAPE_H,
  SHAPE_STROKE_WIDTH,
  SHAPE_W,
  STICKY_COLOR,
  STICKY_H,
  STICKY_W,
  TEXT_COLOR,
  TEXT_FONT_SIZE,
  THINNING,
  buildShape,
  buildSticky,
  buildStroke,
  buildText,
  drawColor,
  drawWidth,
  shouldCommitStroke,
} from './tools';

describe('whiteboard tools', () => {
  it('builds a pen stroke with fixed styling and a generated id', () => {
    const points: Array<[number, number]> = [
      [0, 0],
      [10, 20],
      [40, 20],
    ];
    const stroke = buildStroke('pen', points);
    expect(stroke.kind).toBe('stroke');
    expect(stroke.tool).toBe('pen');
    expect(stroke.color).toBe(PEN_COLOR);
    expect(stroke.width).toBe(PEN_WIDTH);
    expect(stroke.thinning).toBe(THINNING);
    expect(stroke.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stroke.points).toEqual(points);
  });

  it('builds an eraser stroke with its own styling', () => {
    const stroke = buildStroke('eraser', [
      [1, 1],
      [2, 2],
    ]);
    expect(stroke.tool).toBe('eraser');
    expect(stroke.color).toBe(ERASER_COLOR);
    expect(stroke.width).toBe(ERASER_WIDTH);
  });

  it('maps tool to color and width', () => {
    expect(drawColor('pen')).toBe(PEN_COLOR);
    expect(drawColor('eraser')).toBe(ERASER_COLOR);
    expect(drawWidth('pen')).toBe(PEN_WIDTH);
    expect(drawWidth('eraser')).toBe(ERASER_WIDTH);
  });

  it('commits only gestures with at least two points', () => {
    expect(shouldCommitStroke([])).toBe(false);
    expect(shouldCommitStroke([[0, 0]])).toBe(false);
    expect(shouldCommitStroke([[0, 0], [1, 1]])).toBe(true);
    expect(shouldCommitStroke([[0, 0], [1, 1], [2, 2]])).toBe(true);
  });

  it('builds a sticky with schema defaults', () => {
    const sticky = buildSticky(10, 20);
    expect(sticky.kind).toBe('sticky');
    expect(sticky).toMatchObject({ x: 10, y: 20, w: STICKY_W, h: STICKY_H, color: STICKY_COLOR, text: '' });
  });

  it('builds a text element with schema defaults', () => {
    const text = buildText(5, 6);
    expect(text.kind).toBe('text');
    expect(text).toMatchObject({ x: 5, y: 6, color: TEXT_COLOR, fontSize: TEXT_FONT_SIZE, text: '' });
  });

  it('builds a shape with schema defaults', () => {
    const shape = buildShape(1, 2);
    expect(shape.kind).toBe('shape');
    expect(shape).toMatchObject({
      shapeType: 'rect',
      x: 1,
      y: 2,
      w: SHAPE_W,
      h: SHAPE_H,
      color: SHAPE_COLOR,
      fill: false,
      strokeWidth: SHAPE_STROKE_WIDTH,
      label: '',
    });
  });

  it('buildStroke accepts explicit color and width', () => {
    const stroke = buildStroke('pen', [[0, 0], [1, 1]], '#f4706d', 5);
    expect(stroke.color).toBe('#f4706d');
    expect(stroke.width).toBe(5);
  });
});