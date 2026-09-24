import { describe, expect, it } from 'vitest';
import { approxComponentBBox, reverseCompileComponent, splitSvgComponents } from './svg-components';

/** Golden sample: login form (kontrak grouping). Koordinat lokal 360x520. */
export const LOGIN_FORM_SVG = [
  '<g data-component="card"><rect x="10" y="10" width="340" height="500" rx="16" fill="#111214"/></g>',
  '<g data-component="header"><text x="180" y="62" text-anchor="middle" font-size="28" fill="#f5f5f5">Login</text><text x="180" y="88" text-anchor="middle" font-size="14" fill="#a1a1aa">Welcome back</text></g>',
  '<g data-component="input-email"><text x="40" y="130" font-size="13" fill="#d4d4d8">Email or Username</text><rect x="40" y="142" width="280" height="48" rx="10" fill="none" stroke="#3a3d44"/><text x="56" y="172" font-size="14" fill="#71717a">name@example.com</text></g>',
  '<g data-component="submit"><rect x="40" y="344" width="280" height="52" rx="10" fill="#2f6df6"/><text x="180" y="377" text-anchor="middle" font-size="16" fill="#ffffff">Login</text></g>',
].join('');

let idCounter = 0;
const newId = () => `test-id-${(idCounter += 1)}`;

describe('splitSvgComponents (kontrak grouping)', () => {
  it('memotong blob menjadi komponen per data-component', () => {
    const parts = splitSvgComponents(LOGIN_FORM_SVG);
    expect(parts.map((p) => p.name)).toEqual(['card', 'header', 'input-email', 'submit']);
    expect(parts[1]?.svg).toContain('Login');
  });

  it('menggabungkan sisa tanpa grup menjadi satu chunk', () => {
    const parts = splitSvgComponents('<rect x="0" y="0" width="5" height="5"/>' + LOGIN_FORM_SVG);
    expect(parts[parts.length - 1]?.name).toBe('');
  });

  it('mengembalikan kosong untuk markup jahat/kosong', () => {
    expect(splitSvgComponents('<script>alert(1)</script>')).toEqual([]);
  });
});

describe('approxComponentBBox', () => {
  it('menghitung bbox input-email', () => {
    const box = approxComponentBBox(
      '<text x="40" y="130" font-size="13" fill="#d4d4d8">Email or Username</text><rect x="40" y="142" width="280" height="48" rx="10" fill="none" stroke="#3a3d44"/>',
    );
    expect(box).not.toBeNull();
    expect(box?.x).toBe(40);
    expect(box?.y).toBeLessThanOrEqual(130);
    expect(box?.w).toBe(280);
  });
});

describe('reverseCompileComponent', () => {
  it('mengubah grup submit menjadi shape + text natif', () => {
    const comp = splitSvgComponents(LOGIN_FORM_SVG).find((p) => p.name === 'submit');
    expect(comp).toBeDefined();
    const res = reverseCompileComponent(comp!.svg, { x: 100, y: 200 }, newId);
    expect(res.kind).toBe('native');
    if (res.kind !== 'native') return;
    expect(res.elements).toHaveLength(2);
    const shape = res.elements.find((e) => e.kind === 'shape');
    const text = res.elements.find((e) => e.kind === 'text');
    expect(shape).toMatchObject({ shapeType: 'roundedRect', x: 140, y: 544, w: 280, h: 52, fill: true });
    expect(text).toMatchObject({ x: 280, text: 'Login' });
  });

  it('mengembalikan embed utuh bila ada path/gradien', () => {
    const res = reverseCompileComponent(
      '<path d="M0 0 L10 10"/><rect x="0" y="0" width="5" height="5"/>',
      { x: 0, y: 0 },
      newId,
    );
    expect(res.kind).toBe('embed');
  });

  it('seluruh grup golden sample ter-compile natif', () => {
    for (const comp of splitSvgComponents(LOGIN_FORM_SVG)) {
      const res = reverseCompileComponent(comp.svg, { x: 0, y: 0 }, newId);
      expect(res.kind).toBe('native');
    }
  });
});
