import { describe, expect, it } from 'vitest';
import { layoutSequence, SequenceLayoutError } from '../src/modules/projects/domain/whiteboard-layout.js';
import { validateWhiteboardShowcase } from '../src/modules/projects/domain/validate-whiteboard.js';

/**
 * E2E pipeline MCP: layout_board → validate_whiteboard/showcase → create.
 * Merekonstruksi board audit "Web Dashboard" (5 partisipan, 9 pesan,
 * 3 fase) dengan label yang sudah dipendekkan agar memenuhi kriteria:
 * - layout tidak melempar (label muat di span),
 * - showcase ok:true TANPA satu pun warning (kontras, lifeline, spacing, font),
 * - legend muat di dalam width, tak ada warna #8b5cf6.
 */
export const INPUT = {
  participants: [
    { name: 'Browser', sub: 'klik user' },
    { name: 'Flask', sub: 'penerjemah' },
    { name: 'Worker', sub: 'thread latar' },
    { name: 'Engine', sub: 'sources + db' },
    { name: 'SQLite', sub: 'scrape.db' },
  ],
  messages: [
    { from: 0, to: 1, label: 'POST /scrape' },
    { from: 1, to: 2, label: 'enqueue job' },
    { from: 1, to: 0, label: '202 (job_id)', variant: 'return' as const },
    { from: 0, to: 1, label: 'poll jobs' },
    { from: 2, to: 3, label: 'Github.search()' },
    { from: 3, to: 4, label: 'spawn Chromium' },
    { from: 4, to: 3, label: 'upsert (WAL)' },
    { from: 3, to: 2, label: 'return hasil', variant: 'return' as const },
    { from: 1, to: 0, label: 'done + ringkasan' },
  ],
  phases: [
    { label: 'Submit', fromMessage: 0, toMessage: 2 },
    { label: 'Eksekusi', fromMessage: 3, toMessage: 7 },
    { label: 'Hasil', fromMessage: 8, toMessage: 8 },
  ],
};

describe('sequence e2e (layout → showcase)', () => {
  it('label panjang gaya board audit ditolak dengan pesan perbaikan', () => {
    expect(() =>
      layoutSequence({
        participants: ['Browser', 'Flask'],
        messages: [{ from: 0, to: 1, label: 'POST /scrape (query, platform)' }],
      }),
    ).toThrow(SequenceLayoutError);
    expect(() =>
      layoutSequence({
        participants: ['Browser', 'Flask'],
        messages: [{ from: 0, to: 1, label: 'POST /scrape (query, platform)' }],
      }),
    ).toThrow(/pendekkan kata/);
  });

  it('board rekonstruksi lolos showcase tanpa satu pun diagnostic', () => {
    const layout = layoutSequence(INPUT);
    const result = validateWhiteboardShowcase(layout.elements);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('legend muat di width, garis ungu lama hilang, ekor lifeline pendek', () => {
    const layout = layoutSequence(INPUT);
    const dump = JSON.stringify(layout.elements);
    expect(dump).not.toContain('#8b5cf6');
    const texts = layout.elements.filter((e) => e.kind === 'text') as Array<{ x: number; text: string; fontSize?: number | null }>;
    for (const t of texts) {
      expect(t.x).toBeLessThan(layout.width);
      if (t.text !== 'Legend') expect(t.fontSize).toBe(14);
    }
    const lifelines = layout.elements.filter(
      (e) => e.kind === 'edge' && (e as { dash: string }).dash === 'dashed',
    ) as Array<{ y1: number; y2: number }>;
    const lastMsgY = Math.max(
      ...layout.elements
        .filter((e) => e.kind === 'edge' && (e as { dash: string }).dash !== 'dashed')
        .map((e) => (e as { y1: number }).y1),
    );
    for (const l of lifelines) {
      expect(l.y2 - lastMsgY).toBeLessThanOrEqual(60);
    }
  });
});
