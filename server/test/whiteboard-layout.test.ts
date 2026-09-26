import { describe, expect, it } from 'vitest';
import { layoutSequence, SequenceLayoutError } from '../src/modules/projects/domain/whiteboard-layout.js';
import { whiteboardElementSchema } from '../src/modules/projects/domain/state.js';

describe('layoutSequence', () => {
  it('places participants, lifelines, messages and a fixed 4-entry legend', () => {
    const layout = layoutSequence({
      participants: ['Browser', 'API', 'DB'],
      messages: [
        { from: 0, to: 1, label: 'POST /mcp' },
        { from: 1, to: 2, label: 'query' },
        { from: 2, to: 1, label: 'rows', variant: 'return' },
      ],
    });
    // 3 participants + 3 lifelines + 3 messages + legend title + 8 legend.
    expect(layout.elements).toHaveLength(3 + 3 + 3 + 1 + 8);
    const parsed = whiteboardElementSchema.array().safeParse(layout.elements);
    expect(parsed.success).toBe(true);

    const boxes = layout.elements.filter((e) => e.kind === 'shape');
    expect(boxes.map((b) => (b as { x: number }).x)).toEqual([80, 280, 480]);
    expect(boxes[0]).toMatchObject({ y: 80, w: 150, h: 56 });

    const lifelines = layout.elements.filter((e) => e.kind === 'edge' && (e as { dash: string }).dash === 'dashed');
    expect(lifelines).toHaveLength(3);
    expect(lifelines[0]).toMatchObject({ x1: 155, y1: 136 });

    const msgs = layout.elements.filter(
      (e) => e.kind === 'edge' && (e as { dash: string }).dash !== 'dashed' && (e as { label: string }).label !== '',
    );
    expect(msgs.map((m) => (m as { y1: number }).y1)).toEqual([180, 220, 260]);
    expect(msgs[2]).toMatchObject({ dash: 'dotted' });
    expect(layout.width).toBeGreaterThan(480 + 150);
    expect(layout.height).toBeGreaterThan(260);
  });

  it('rejects bad graphs with clear messages', () => {
    expect(() => layoutSequence({ participants: ['Solo'], messages: [] })).toThrow(SequenceLayoutError);
    expect(() =>
      layoutSequence({ participants: ['A', 'B'], messages: [{ from: 0, to: 1, label: '' }] }),
    ).toThrow(/label.*required/);
    expect(() =>
      layoutSequence({ participants: ['A', 'B'], messages: [{ from: 0, to: 5, label: 'x' }] }),
    ).toThrow(/participant index/);
    expect(() =>
      layoutSequence({ participants: ['A', 'B'], messages: [{ from: 0, to: 0, label: 'self' }] }),
    ).not.toThrow();
    expect(() =>
      layoutSequence({ participants: [...Array(13)].map((_, i) => `P${i}`), messages: [] }),
    ).toThrow(/Too many participants/);
  });

  it('always emits the fixed 4-entry legend with a title', () => {
    const layout = layoutSequence({
      participants: ['A', 'B'],
      messages: [{ from: 0, to: 1, label: 'call' }],
    });
    const texts = layout.elements.filter((e) => e.kind === 'text').map((e) => (e as { text: string }).text);
    expect(texts).toEqual(['Legend', 'request', 'return', 'async trace', 'default message']);
  });

  it('separates phase bands with a gap instead of overlapping', () => {
    const layout = layoutSequence({
      participants: ['A', 'B'],
      messages: [
        { from: 0, to: 1, label: 'one' },
        { from: 1, to: 0, label: 'two' },
        { from: 0, to: 1, label: 'three' },
      ],
      phases: [
        { label: 'First', fromMessage: 0, toMessage: 1 },
        { label: 'Second', fromMessage: 2, toMessage: 2 },
      ],
    });
    const bands = layout.elements.filter((e) => e.kind === 'boundary') as Array<{ y: number; h: number }>;
    expect(bands).toHaveLength(2);
    expect(bands[1]!.y - (bands[0]!.y + bands[0]!.h)).toBeGreaterThanOrEqual(28);
    expect(bands[0]!.y).toBe(60);
  });

  it('supports sublabels, activations, phases and self-messages', () => {
    const layout = layoutSequence({
      participants: [{ name: 'Client', sub: 'mobile app' }, 'API'],
      messages: [
        { from: 0, to: 1, label: 'POST /jobs' },
        { from: 0, to: 0, label: 'retry' },
      ],
      activations: [{ participant: 1, fromMessage: 0, toMessage: 0 }],
      phases: [{ label: 'Accept', fromMessage: 0, toMessage: 1 }],
    });
    const parsed = whiteboardElementSchema.array().safeParse(layout.elements);
    expect(parsed.success).toBe(true);

    const boxes = layout.elements.filter((e) => e.kind === 'shape' && (e as { w: number }).w === 150);
    expect(boxes[0]).toMatchObject({ label: 'Client\nmobile app' });

    // Self-message renders an out-and-back pair sized to its label, clear of
    // the lifeline bar ('retry' = 5 chars -> w 98 at x0 = 155 + 10).
    const selfEdges = layout.elements.filter(
      (e) => e.kind === 'edge' && (e as { x1: number }).x1 === 165 && (e as { x2: number }).x2 === 263,
    );
    expect(selfEdges).toHaveLength(1);
    const backEdges = layout.elements.filter(
      (e) => e.kind === 'edge' && (e as { x1: number }).x1 === 263 && (e as { x2: number }).x2 === 165,
    );
    expect(backEdges).toHaveLength(1);
    expect(backEdges[0]).toMatchObject({ label: '' });

    // Activation bar centered on API lifeline; phase band covers participants.
    const bars = layout.elements.filter((e) => e.kind === 'shape' && (e as { w: number }).w === 14);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ x: 355 - 7 });
    const bands = layout.elements.filter((e) => e.kind === 'boundary');
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ x: 30, y: 60, label: 'Accept' });
  });
});
