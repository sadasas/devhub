import { describe, expect, it } from 'vitest';
import { WHITEBOARD_TEMPLATES } from './templates';

describe('whiteboard templates', () => {
  it('exposes a blank default plus presets', () => {
    expect(WHITEBOARD_TEMPLATES.map((t) => t.id)).toEqual([
      'blank',
      'kanban',
      'ci-cd',
      'architecture',
      'workflow',
      'sequence',
      'dataflow',
      'lifecycle',
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

  it('sizes the workflow preset with four lanes', () => {
    const workflow = WHITEBOARD_TEMPLATES.find((t) => t.id === 'workflow')!;
    const boundaries = workflow.build().filter((e) => e.kind === 'boundary');
    expect(boundaries.map((b) => (b as { label: string }).label)).toEqual([
      'Developer',
      'AI Agent',
      'CLI / Validator',
      'Artifact',
    ]);
  });

  it('keeps the architecture preset under 20 elements', () => {
    const arch = WHITEBOARD_TEMPLATES.find((t) => t.id === 'architecture')!;
    expect(arch.build().length).toBeLessThan(20);
  });

  it('WB-9: builds an honest kanban with four columns and starter cards', () => {
    const els = WHITEBOARD_TEMPLATES.find((t) => t.id === 'kanban')!.build();
    const boundaries = els.filter((e) => e.kind === 'boundary');
    expect(boundaries.map((b) => (b as { label: string }).label)).toEqual([
      'Todo',
      'In Progress',
      'Review',
      'Done',
    ]);
    expect(els.filter((e) => e.kind === 'shape').length).toBeGreaterThanOrEqual(4);
  });

  it('WB-9: builds an honest CI/CD pipeline Commit to Deploy with linked edges', () => {
    const els = WHITEBOARD_TEMPLATES.find((t) => t.id === 'ci-cd')!.build();
    const shapes = els.filter((e) => e.kind === 'shape');
    expect(shapes.map((s) => (s as { label: string }).label)).toEqual([
      'Commit',
      'Build',
      'Test',
      'Approval',
      'Deploy',
    ]);
    const edges = els.filter((e) => e.kind === 'edge');
    expect(edges).toHaveLength(4);
    const ids = new Set(els.map((e) => e.id));
    for (const e of edges) {
      const edge = e as { sourceNodeId: string | null; targetNodeId: string | null };
      expect(ids.has(edge.sourceNodeId!)).toBe(true);
      expect(ids.has(edge.targetNodeId!)).toBe(true);
    }
  });
});