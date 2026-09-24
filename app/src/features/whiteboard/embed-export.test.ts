import { describe, expect, it } from 'vitest';
import type { WhiteboardElement } from '../../lib/types';
import { serializeWhiteboard } from './export';

function embed(id: string, svg: string, title = 'Login form'): WhiteboardElement {
  return { id, kind: 'embed', x: 0, y: 0, w: 360, h: 520, svg, title };
}

describe('serializeWhiteboard embed', () => {
  it('menyarangkan SVG AI dengan viewport w/h elemen', () => {
    const svg = serializeWhiteboard([
      embed('e1', '<rect x="10" y="10" width="340" height="500" rx="16" fill="#111214"/><text x="180" y="62" font-size="28" fill="#f5f5f5">Login</text>'),
    ]);
    expect(svg).toContain('<svg x="0" y="0" width="360" height="520" viewBox="0 0 360 520" overflow="hidden">');
    expect(svg).toContain('fill="#111214"');
    expect(svg).toContain('>Login</text>');
  });

  it('membuang script saat export', () => {
    const svg = serializeWhiteboard([
      embed('e1', '<rect x="0" y="0" width="10" height="10"/><script>alert(1)</script>'),
    ]);
    expect(svg).not.toContain('alert');
    expect(svg).toContain('<rect');
  });

  it('fallback box bila svg kosong', () => {
    const svg = serializeWhiteboard([embed('e1', '<script>x()</script>', 'Kartu')]);
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(svg).toContain('Kartu');
  });
});
