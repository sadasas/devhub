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

  it('emits readable label colors (dark labelColor, darkened pastel lines)', () => {
    const layout = layoutSequence({
      participants: ['A', 'B', 'C'],
      messages: [
        { from: 0, to: 1, label: 'dark call' },
        { from: 1, to: 2, label: 'pastel call' },
        { from: 2, to: 1, label: 'back', variant: 'return' },
      ],
    });
    const boxes = layout.elements.filter((e) => e.kind === 'shape') as Array<{ labelColor?: string; label?: string }>;
    for (const b of boxes.filter((b) => b.label)) {
      expect(b.labelColor).toBe('#0f172a');
    }
    const msgs = layout.elements.filter(
      (e) => e.kind === 'edge' && (e as { label: string }).label !== '' && (e as { dash: string }).dash !== 'dashed',
    ) as Array<{ color: string; label: string }>;
    // Participant 2 (index 1) uses pastel #e8b955 → its call line must be darkened.
    const pastelCall = msgs.find((m) => m.label === 'pastel call')!;
    expect(pastelCall.color).toBe('#0f172a');
    const darkCall = msgs.find((m) => m.label === 'dark call')!;
    expect(darkCall.color).toBe('#2563eb');
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

  it('fails closed saat label pesan biasa lebih lebar dari bentang panah', () => {
    // Span kolom tetangga = 200; label 28+ char ≈ 278px > 200 + 40 → harus fail.
    const longLabel = 'POST /scrape (query, platform)';
    expect(longLabel.length).toBeGreaterThanOrEqual(28);
    let err: unknown = null;
    try {
      layoutSequence({
        participants: ['A', 'B'],
        messages: [{ from: 0, to: 1, label: longLabel }],
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SequenceLayoutError);
    const msg = (err as Error).message;
    // Pesan menyebut label mana, perkiraan lebar px, span px, dan saran.
    expect(msg).toContain(longLabel);
    expect(msg).toMatch(/~\d+px/);
    expect(msg).toMatch(/span 200px/);
    expect(msg).toMatch(/POST \/scrape/);
    // Self-message dikecualikan — loop-nya sudah melebarkan diri.
    expect(() =>
      layoutSequence({
        participants: ['A', 'B'],
        messages: [{ from: 0, to: 0, label: longLabel }],
      }),
    ).not.toThrow();
  });

  it('mengizinkan label lebar yang muat di multi-span', () => {
    // Label yang sama (≈278px) muat di span 2 kolom = 400 (400 + 40 = 440).
    const longLabel = 'POST /scrape (query, platform)';
    expect(() =>
      layoutSequence({
        participants: ['A', 'B', 'C'],
        messages: [{ from: 0, to: 2, label: longLabel }],
      }),
    ).not.toThrow();
  });

  it('tidak lagi memancarkan #8b5cf6 (semua garis ungu kini #7c3aed)', () => {
    const layout = layoutSequence({
      participants: ['A', 'B', 'C', 'D'],
      messages: [
        { from: 0, to: 1, label: 'call' },
        { from: 1, to: 0, label: 'back', variant: 'return' },
        { from: 2, to: 3, label: 'trace', variant: 'async' },
      ],
    });
    const dump = JSON.stringify(layout.elements).toLowerCase();
    expect(dump).not.toContain('#8b5cf6');
    expect(dump).toContain('#7c3aed');
    const lifelines = layout.elements.filter(
      (e) => e.kind === 'edge' && (e as { dash: string }).dash === 'dashed',
    ) as Array<{ color: string }>;
    expect(lifelines.length).toBeGreaterThan(0);
    for (const l of lifelines) expect(l.color).toBe('#7c3aed');
  });

  it('board n=2 memuat entri legend terakhir tanpa overflow', () => {
    const layout = layoutSequence({
      participants: ['A', 'B'],
      messages: [{ from: 0, to: 1, label: 'call' }],
    });
    // Entri terakhir: x garis 80 + 3*220 = 740, garis 60px, teks di x + 70.
    const lastX = 80 + 3 * 220;
    const longest = 'default message'.length;
    const textEst = longest * 14 * 0.62;
    const textX = lastX + 70;
    expect(layout.width).toBeGreaterThanOrEqual(lastX + 60);
    expect(layout.width).toBeGreaterThanOrEqual(Math.ceil(textX + textEst));
    expect(layout.width).toBeGreaterThanOrEqual(Math.ceil(lastX + 60 + 70 + textEst + 40));
  });

  it('merender judul dan label legend pada fontSize 14', () => {
    const layout = layoutSequence({
      participants: ['A', 'B'],
      messages: [{ from: 0, to: 1, label: 'call' }],
    });
    const texts = layout.elements.filter((e) => e.kind === 'text') as Array<{ fontSize: number; text: string }>;
    expect(texts).toHaveLength(5);
    for (const t of texts) expect(t.fontSize).toBe(14);
  });

  it('memakai ekor lifeline +32 dan jeda legend +32 (geometri baru)', () => {
    // Kasus 3-partisipan-3-pesan: cursor 180 → 300, lifelineBottom 292,
    // legendY 324, height 364.
    const layout = layoutSequence({
      participants: ['Browser', 'API', 'DB'],
      messages: [
        { from: 0, to: 1, label: 'POST /mcp' },
        { from: 1, to: 2, label: 'query' },
        { from: 2, to: 1, label: 'rows', variant: 'return' },
      ],
    });
    const lifelines = layout.elements.filter(
      (e) => e.kind === 'edge' && (e as { dash: string }).dash === 'dashed',
    ) as Array<{ y2: number }>;
    for (const l of lifelines) expect(l.y2).toBe(292);
    expect(layout.legendY).toBe(324);
    expect(layout.height).toBe(364);
  });
});
