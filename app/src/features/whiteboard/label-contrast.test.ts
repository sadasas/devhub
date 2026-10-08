import { describe, expect, it } from 'vitest';
import { contrastRatio, isLowContrastLabel, MIN_LABEL_CONTRAST } from './label-contrast';
import type { WhiteboardElement } from '../../lib/types';

const el = (o: Record<string, unknown>) => o as unknown as WhiteboardElement;

describe('isLowContrastLabel (client mirror)', () => {
  it('flags fill:none shape with pastel stroke', () => {
    const hit = isLowContrastLabel(
      el({ kind: 'shape', fill: 'none', color: '#e8b955', label: '1 · Pahami Brief' }),
    );
    expect(hit).not.toBeNull();
    expect(hit!.field).toBe('color');
    expect(hit!.ratio).toBeLessThan(MIN_LABEL_CONTRAST);
  });
  it('matches renderer: transparent light fill uses dark label (passes)', () => {
    expect(
      isLowContrastLabel(el({ kind: 'shape', fill: 'transparent', color: '#6ea8fe', label: 'x' })),
    ).toBeNull();
  });
  it('matches renderer: solid fills pass either way', () => {
    expect(
      isLowContrastLabel(el({ kind: 'shape', fill: 'solid', color: '#e8b955', label: 'x' })),
    ).toBeNull();
    expect(
      isLowContrastLabel(el({ kind: 'shape', fill: 'solid', color: '#0f172a', label: 'x' })),
    ).toBeNull();
  });
  it('explicit dark labelColor suppresses the warning', () => {
    expect(
      isLowContrastLabel(
        el({ kind: 'shape', fill: 'none', color: '#e8b955', label: 'x', labelColor: '#0f172a' }),
      ),
    ).toBeNull();
  });
  it('flags default text color and pastel edge labels', () => {
    expect(isLowContrastLabel(el({ kind: 'text', color: '#e4e4e7', text: 'caption' }))).not.toBeNull();
    expect(
      isLowContrastLabel(el({ kind: 'edge', color: '#e4e4e7', label: 'iterasi' })),
    ).not.toBeNull();
  });
  it('sanity: black-on-white ratio is high', () => {
    expect(contrastRatio('#000000', '#ffffff')!).toBeGreaterThan(15);
  });
});
