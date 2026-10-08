import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  effectiveLabel,
  isLowContrastLabel,
  MIN_LABEL_CONTRAST,
} from '../src/modules/projects/domain/color-contrast.js';
import type { WhiteboardElement } from '../src/modules/projects/domain/state.js';
import { validateWhiteboardShowcase } from '../src/modules/projects/domain/validate-whiteboard.js';

const el = (o: Record<string, unknown>) => o as unknown as WhiteboardElement;

describe('contrastRatio', () => {
  it('rates black-on-white near maximum', () => {
    expect(contrastRatio('#000000', '#ffffff')!).toBeGreaterThan(15);
  });
  it('rates pastel-on-white below threshold', () => {
    for (const pastel of ['#e8b955', '#6ea8fe', '#e4e4e7', '#f2b8c6']) {
      expect(contrastRatio(pastel, '#ffffff')!).toBeLessThan(MIN_LABEL_CONTRAST);
    }
  });
  it('rates dark-on-white above threshold', () => {
    for (const dark of ['#0f172a', '#2563eb', '#374151']) {
      expect(contrastRatio(dark, '#ffffff')!).toBeGreaterThanOrEqual(MIN_LABEL_CONTRAST);
    }
  });
  it('passes non-hex through as null', () => {
    expect(contrastRatio('red', '#ffffff')).toBeNull();
  });
});

describe('isLowContrastLabel', () => {
  it('flags fill:none shape with pastel stroke (screenshot repro)', () => {
    const hit = isLowContrastLabel(
      el({ kind: 'shape', fill: 'none', color: '#e8b955', label: '1 · Pahami Brief' }),
    );
    expect(hit).not.toBeNull();
    expect(hit!.field).toBe('color');
    expect(hit!.ratio).toBeLessThan(MIN_LABEL_CONTRAST);
  });
  it('flags default text element color', () => {
    expect(isLowContrastLabel(el({ kind: 'text', color: '#e4e4e7', text: 'caption' }))).not.toBeNull();
  });
  it('flags edge label reusing pastel line color', () => {
    expect(
      isLowContrastLabel(el({ kind: 'edge', color: '#e4e4e7', label: 'iterasi → perbaikan' })),
    ).not.toBeNull();
  });
  it('passes dark stroke on white', () => {
    expect(
      isLowContrastLabel(el({ kind: 'shape', fill: 'none', color: '#0f172a', label: '3 · Wireframe' })),
    ).toBeNull();
  });
  it('passes solid fills (renderer guarantees contrast)', () => {
    expect(
      isLowContrastLabel(el({ kind: 'shape', fill: 'solid', color: '#e8b955', label: 'x' })),
    ).toBeNull();
    expect(
      isLowContrastLabel(el({ kind: 'shape', fill: 'solid', color: '#0f172a', label: 'x' })),
    ).toBeNull();
  });
  it('passes transparent light fill (renderer uses dark label)', () => {
    expect(
      isLowContrastLabel(el({ kind: 'shape', fill: 'transparent', color: '#6ea8fe', label: 'x' })),
    ).toBeNull();
  });
  it('explicit dark labelColor suppresses the warning', () => {
    expect(
      isLowContrastLabel(
        el({ kind: 'shape', fill: 'none', color: '#e8b955', label: 'x', labelColor: '#0f172a' }),
      ),
    ).toBeNull();
  });
  it('flags explicit light labelColor', () => {
    const hit = isLowContrastLabel(
      el({ kind: 'shape', fill: 'none', color: '#0f172a', label: 'x', labelColor: '#e8b955' }),
    );
    expect(hit).not.toBeNull();
    expect(hit!.field).toBe('labelColor');
  });
  it('checks sticky text against sticky fill', () => {
    expect(
      isLowContrastLabel(el({ kind: 'sticky', color: '#e8b955', text: 'note' })),
    ).toBeNull();
    const hit = isLowContrastLabel(
      el({ kind: 'sticky', color: '#e8b955', text: 'note', textColor: '#e8b955' }),
    );
    expect(hit).not.toBeNull();
  });
  it('showcase flags screenshot-style board as warnings without failing', () => {
    const result = validateWhiteboardShowcase([
      el({ id: 's1', kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', fill: 'none', label: '1 · Pahami Brief' }),
      el({ id: 't1', kind: 'text', x: 500, y: 100, color: '#e4e4e7', text: 'caption' }),
      el({ id: 'e1', kind: 'edge', x1: 210, y1: 60, x2: 400, y2: 60, color: '#e8b955', label: 'iterasi' }),
    ]);
    expect(result.ok).toBe(true);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes.filter((c) => c === 'whiteboard/low-contrast-label')).toHaveLength(3);
    expect(result.diagnostics.every((d) => d.severity === 'warning')).toBe(true);
  });

  it('showcase flags light boundary labelColor without failing', () => {
    const result = validateWhiteboardShowcase([
      el({ id: 'b1', kind: 'boundary', x: 0, y: 0, w: 1000, h: 600, color: '#2563eb', label: 'fase', labelColor: '#e8b955' }),
      el({ id: 's2', kind: 'shape', shapeType: 'rect', x: 100, y: 100, w: 200, h: 120, color: '#0f172a', fill: 'none', label: 'ok' }),
      el({ id: 'e2', kind: 'edge', x1: 110, y1: 110, x2: 150, y2: 110, color: '#0f172a', sourceNodeId: 's2', targetNodeId: 's2' }),
    ]);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toEqual(['whiteboard/low-contrast-label']);
  });

  it('ignores elements without visible text', () => {
    expect(effectiveLabel(el({ kind: 'shape', fill: 'none', color: '#e8b955', label: '' }))).toBeNull();
    expect(isLowContrastLabel(el({ kind: 'ref', x: 0, y: 0 }))).toBeNull();
  });
});

describe('advisory lifeline + small-font + purple example', () => {
  it('flags wide solid label crossing another dashed lifeline as warning without failing', () => {
    const result = validateWhiteboardShowcase([
      el({ id: 'l1', kind: 'edge', x1: 200, y1: 0, x2: 200, y2: 500, color: '#0f172a', dash: 'dashed' }),
      el({ id: 'm1', kind: 'edge', x1: 0, y1: 200, x2: 400, y2: 200, color: '#0f172a', dash: 'solid', label: 'this is a very long message label crossing lifeline' }),
    ]);
    expect(result.ok).toBe(true);
    const hits = result.diagnostics.filter((d) => d.code === 'whiteboard/label-crosses-lifeline');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.severity).toBe('warning');
    expect(hits[0]!.evidence).toMatchObject({ lifelineId: 'l1' });
    expect(hits[0]!.supportedFixes).toEqual(['shorten label', 'route via multi-span', 'split into two messages']);
  });

  it('does not flag short label inside span that touches no lifeline', () => {
    const result = validateWhiteboardShowcase([
      el({ id: 'l1', kind: 'edge', x1: 500, y1: 0, x2: 500, y2: 500, color: '#0f172a', dash: 'dashed' }),
      el({ id: 'm1', kind: 'edge', x1: 0, y1: 200, x2: 200, y2: 200, color: '#0f172a', dash: 'solid', label: 'hi' }),
    ]);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.code === 'whiteboard/label-crosses-lifeline')).toHaveLength(0);
  });

  it('flags explicit fontSize 10 as small-font warning without failing', () => {
    const result = validateWhiteboardShowcase([
      el({ id: 't1', kind: 'text', x: 0, y: 100, color: '#0f172a', fontSize: 10, text: 'hello' }),
    ]);
    expect(result.ok).toBe(true);
    const hits = result.diagnostics.filter((d) => d.code === 'whiteboard/small-font');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.severity).toBe('warning');
  });

  it('purple example edge #7c3aed with normal label has no low-contrast warning', () => {
    const result = validateWhiteboardShowcase([
      el({ id: 'e1', kind: 'edge', x1: 0, y1: 0, x2: 200, y2: 0, color: '#7c3aed', dash: 'solid', label: 'Submit' }),
    ]);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.code === 'whiteboard/low-contrast-label')).toHaveLength(0);
  });
});
