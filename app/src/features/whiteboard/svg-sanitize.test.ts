import { describe, expect, it } from 'vitest';
import { sanitizeSvgForRender } from './svg-sanitize';

describe('sanitizeSvgForRender (embed, lapis client)', () => {
  it('meloloskan wireframe login yang valid', () => {
    const out = sanitizeSvgForRender(
      '<g data-component="card"><rect x="10" y="10" width="340" height="500" rx="16" fill="#111214"/><text x="180" y="62" font-size="28" fill="#f5f5f5">Login</text></g>',
    );
    expect(out).toContain('<rect');
    expect(out).toContain('data-component="card"');
  });

  it('membuang script, event-handler, dan foreignObject', () => {
    const out = sanitizeSvgForRender(
      '<g onclick="evil()"><rect x="0" y="0" width="5" height="5"/><script>alert(1)</script><foreignObject><div>hi</div></foreignObject></g>',
    );
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert');
    expect(out).not.toContain('foreignObject');
    expect(out).toContain('<rect');
  });

  it('membuang javascript: dan url() non-lokal', () => {
    const out = sanitizeSvgForRender(
      '<rect x="0" y="0" width="5" height="5" fill="javascript:evil()"/><text x="0" y="0">t</text>',
    );
    expect(out).not.toContain('javascript:');
    expect(out).toContain('<text');
  });

  it('mengembalikan string kosong bila tak ada konten renderable', () => {
    expect(sanitizeSvgForRender('<script>alert(1)</script>')).toBe('');
    expect(sanitizeSvgForRender('')).toBe('');
    expect(sanitizeSvgForRender('<g></g>')).toBe('');
  });
});
