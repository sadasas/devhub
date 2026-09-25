import { describe, expect, it } from 'vitest';
import { embedGroupingHints, hasDataComponents, sanitizeSvgEmbed, sanitizeStateEmbeds, EmbedSanitizerError } from '../src/modules/projects/domain/sanitize-svg.js';
import { LIMITS, whiteboardElementSchema } from '../src/modules/projects/domain/state.js';

const LOGIN_SVG = [
  '<g data-component="card">',
  '<rect x="10" y="10" width="340" height="500" rx="16" fill="#111214"/>',
  '<text x="180" y="62" text-anchor="middle" font-size="28" fill="#f5f5f5">Login</text>',
  '</g>',
  '<g data-component="submit">',
  '<rect x="40" y="344" width="280" height="52" rx="10" fill="#2f6df6"/>',
  '<text x="180" y="377" text-anchor="middle" font-size="16" fill="#ffffff">Login</text>',
  '</g>',
].join('');

describe('sanitizeSvgEmbed (kind embed)', () => {
  it('meloloskan wireframe login yang valid apa adanya', () => {
    const res = sanitizeSvgEmbed(LOGIN_SVG);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.svg).toContain('<rect');
    expect(res.result.svg).toContain('data-component="submit"');
    expect(res.result.removed).toEqual([]);
  });

  it('membuang script beserta isinya, struktur gambar dipertahankan', () => {
    const res = sanitizeSvgEmbed('<rect x="0" y="0" width="10" height="10"/><script>alert(1)</script>');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.svg).not.toContain('alert');
    expect(res.result.svg).toContain('<rect');
    expect(res.result.removed).toContain('script');
  });

  it('membuang event-handler, href, style inline, dan foreignObject', () => {
    const res = sanitizeSvgEmbed(
      '<g onclick="evil()" data-component="x"><rect x="0" y="0" width="10" height="10" style="fill:red"/><a href="https://evil.example"><circle cx="5" cy="5" r="4"/></a><foreignObject><div>hi</div></foreignObject></g>',
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.svg).not.toContain('onclick');
    expect(res.result.svg).not.toContain('style=');
    expect(res.result.svg).not.toContain('<a');
    expect(res.result.svg).not.toContain('foreignObject');
    expect(res.result.svg).toContain('<circle');
    expect(res.result.removed).toContain('event-handler');
  });

  it('membuang javascript: dan url() non-lokal', () => {
    const res = sanitizeSvgEmbed(
      '<rect x="0" y="0" width="10" height="10" fill="javascript:alert(1)"/><rect x="0" y="0" width="10" height="10" fill="url(http://evil.example/x)"/><text x="0" y="0">t</text>',
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.svg).not.toContain('javascript:');
    expect(res.result.svg).not.toContain('http://evil.example');
  });

  it('mempertahankan clip-path lokal url(#id)', () => {
    const res = sanitizeSvgEmbed(
      '<clipPath id="c"><rect x="0" y="0" width="10" height="10"/></clipPath><g clip-path="url(#c)"><rect x="0" y="0" width="10" height="10"/></g>',
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.svg).toContain('url(#c)');
  });

  it('hard-fail bila tak ada konten renderable tersisa', () => {
    expect(sanitizeSvgEmbed('<script>alert(1)</script>').ok).toBe(false);
    expect(sanitizeSvgEmbed('').ok).toBe(false);
    expect(sanitizeSvgEmbed('<g></g>').ok).toBe(false);
  });

  it('meng-unwrap outer svg tunggal', () => {
    const res = sanitizeSvgEmbed('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10"/></svg>');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.svg).not.toMatch(/<svg\b/);
    expect(res.result.svg).toContain('<rect');
  });

  it('me-namespace id dan referensi url(#id) per elemen', () => {
    const src = '<clipPath id="c"><rect x="0" y="0" width="10" height="10"/></clipPath><g clip-path="url(#c)"><rect x="0" y="0" width="10" height="10"/></g>';
    const res = sanitizeSvgEmbed(src, 'e12345678');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.svg).toContain('id="e12345678-c"');
    expect(res.result.svg).toContain('url(#e12345678-c)');
    // Idempoten: save berulang tidak menumpuk prefix.
    const again = sanitizeSvgEmbed(res.result.svg, 'e12345678');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.result.svg).toBe(res.result.svg);
  });
});

describe('whiteboardEmbedSchema', () => {
  it('menerima elemen embed valid', () => {
    const parsed = whiteboardElementSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'embed',
      x: 0,
      y: 0,
      w: 360,
      h: 520,
      svg: '<rect x="0" y="0" width="10" height="10"/>',
      title: 'Login form',
    });
    expect(parsed.success).toBe(true);
  });

  it('menolak w/h di luar batas', () => {
    const parsed = whiteboardElementSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'embed',
      x: 0,
      y: 0,
      w: 5,
      h: 520,
      svg: '<rect x="0" y="0" width="10" height="10"/>',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('kontrak grouping (hasDataComponents + embedGroupingHints)', () => {
  it('mendeteksi grup data-component', () => {
    expect(hasDataComponents('<g data-component="card"><rect x="0" y="0" width="5" height="5"/></g>')).toBe(true);
    expect(hasDataComponents('<rect x="0" y="0" width="5" height="5"/>')).toBe(false);
  });

  it('memberi hint untuk embed tanpa grup', () => {
    const hints = embedGroupingHints([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'embed', title: 'Form', svg: '<rect x="0" y="0" width="5" height="5"/>' },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kind: 'embed', title: 'OK', svg: '<g data-component="x"><rect x="0" y="0" width="5" height="5"/></g>' },
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', kind: 'sticky' } as any,
    ]);
    expect(hints).toHaveLength(1);
    expect(hints[0]?.elementId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(hints[0]?.message).toContain('data-component');
  });
});

describe('sanitizeStateEmbeds', () => {
  function stateWithEmbeds(n: number) {
    return {
      tasks: [],
      issues: [],
      testCases: [],
      techEntries: [],
      tables: [],
      relations: [],
      schemaVersions: [],
      decisions: [],
      milestones: [],
      apiCollections: [],
      apiEndpoints: [],
      whiteboards: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: 'B',
          description: '',
          elements: Array.from({ length: n }, (_, i) => ({
            id: `33333333-3333-4333-8333-3333333333${String(i).padStart(2, '0').slice(-2)}`,
            kind: 'embed',
            x: i * 400,
            y: 0,
            w: 360,
            h: 520,
            svg: '<rect x="0" y="0" width="10" height="10"/><script>evil()</script>',
            title: `E${i}`,
          })),
        },
      ],
      labelDefs: [],
      erdGroups: [],
      timelineOrder: {},
      timelineRow: {},
      erdLayout: {},
    } as any;
  }

  it('membersihkan svg in-place dan melaporkan stripped', () => {
    const state = stateWithEmbeds(1);
    const { stripped } = sanitizeStateEmbeds(state);
    expect(stripped).toContain('script');
    expect(state.whiteboards[0].elements[0].svg).not.toContain('evil');
  });

  it(`menolak di atas cap ${LIMITS.WHITEBOARD_EMBEDS_PER_BOARD} embed per board`, () => {
    const state = stateWithEmbeds(LIMITS.WHITEBOARD_EMBEDS_PER_BOARD + 1);
    expect(() => sanitizeStateEmbeds(state)).toThrow(EmbedSanitizerError);
  });
});
