import { describe, expect, it } from 'vitest';
import { WHITEBOARD_TEMPLATES } from './templates';

describe('whiteboard templates', () => {
  it('exposes a blank default plus five SDLC presets', () => {
    expect(WHITEBOARD_TEMPLATES.map((t) => t.id)).toEqual([
      'blank',
      'kanban',
      'ci-cd',
      'roadmap',
      'release-train',
      'gitflow',
    ]);
  });

  it('builds fresh elements with unique ids on every call', () => {
    const t = WHITEBOARD_TEMPLATES[1]!;
    const a = t.build();
    const b = t.build();
    expect(a).not.toEqual(b);
    expect(a.map((e) => e.id)).toEqual(Array.from(new Set(a.map((e) => e.id))));
    expect(a.length).toBeGreaterThan(0);
  });

  it('produces only valid element kinds with required geometry fields', () => {
    const kinds = new Set(['stroke', 'sticky', 'text', 'shape', 'edge', 'boundary', 'ref']);
    for (const tpl of WHITEBOARD_TEMPLATES) {
      for (const el of tpl.build()) {
        expect(kinds.has(el.kind)).toBe(true);
        expect(typeof el.id).toBe('string');
        expect(el.id).toMatch(/^[0-9a-f-]{36}$/);
        if (el.kind !== 'stroke' && el.kind !== 'edge') {
          expect(typeof (el as { x: number }).x).toBe('number');
          expect(typeof (el as { y: number }).y).toBe('number');
        }
      }
    }
  });

  it('sizes the kanban preset with four columns', () => {
    const kanban = WHITEBOARD_TEMPLATES.find((t) => t.id === 'kanban')!;
    const boundaries = kanban.build().filter((e) => e.kind === 'boundary');
    expect(boundaries.map((b) => (b as { label: string }).label)).toEqual([
      'Todo',
      'In Progress',
      'Review',
      'Done',
    ]);
  });

  it('keeps the CI/CD preset under 20 elements', () => {
    const ci = WHITEBOARD_TEMPLATES.find((t) => t.id === 'ci-cd')!;
    expect(ci.build().length).toBeLessThan(20);
  });
});