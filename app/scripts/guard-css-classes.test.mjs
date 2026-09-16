import { describe, expect, it } from 'vitest';
import {
  ALLOWLIST,
  DENYLIST,
  extractFontSizes,
  extractGhostVars,
  extractHardcodedHex,
  extractOffScaleSpacing,
  extractTitleLabelClasses,
  extractTsxGhostVars,
  extractTsxHexFiles,
  extractTsxInlineStyles,
  findTokenWarnings,
  findViolations,
  extractOffScaleRadius,
  extractOffWidthBorder,
  extractRawBorderColor,
  extractUnsizedButtons,
  FONT_SIZE_ALLOWLIST,
  HEX_FILE_ALLOWLIST,
  HEX_VALUE_ALLOWLIST,
  SPACING_SCALE,
} from './guard-css-classes.mjs';

describe('guard-css-classes', () => {
  it('menerima kelas lama yang ada di allowlist', () => {
    const css = [
      '.profile-panel-title { color: red; }',
      '.task-card-title, .foo { color: blue; }',
      '.theme-segmented {}',
      '.theme-segmented-btn {}',
      '.btn-sm.btn-icon {}',
      '.settings-row-group {}',
      '.btn.btn-icon svg {}',
    ].join('\n');
    // .foo bukan title/label → diabaikan; yang lain ada di allowlist
    expect(findViolations(css)).toEqual([]);
  });

  it('menolak kelas *-title baru di luar allowlist', () => {
    const css = '.profile-panel-title {}\n.my-fancy-title { font-size: 99px; }';
    const violations = findViolations(css);
    expect(violations.some((v) => v.includes('.my-fancy-title'))).toBe(true);
  });

  it('menolak pola denylist yang bangkit lagi', () => {
    const css = '.profile-panel-title {}\n.profile-panel--secondary { background: white; }';
    const violations = findViolations(css);
    expect(violations.some((v) => v.includes('profile-panel--secondary'))).toBe(true);
  });

  it('menolak bila jangkar kanonis hilang', () => {
    const violations = findViolations('.profile-panel-title {}');
    expect(violations.some((v) => v.includes('.theme-segmented'))).toBe(true);
  });

  it('mengabaikan kemunculan di dalam komentar CSS', () => {
    const css = '/* .someday-title { } */\n.profile-panel-title {}';
    expect(extractTitleLabelClasses(css).has('someday-title')).toBe(false);
  });

  it('allowlist mencakup semua kelas existing (tidak boleh kosong melompong)', () => {
    expect(ALLOWLIST.size).toBeGreaterThan(100);
    expect(DENYLIST.length).toBeGreaterThan(0);
  });

  it('menerima font-size px yang ada di allowlist, termasuk di dalam clamp()', () => {
    const css = [
      '.a { font-size: 13px; }',
      '.b { font-size: clamp(18px, 5vw, 22px); }',
      '.profile-panel-title {}',
      '.theme-segmented {}',
      '.theme-segmented-btn {}',
      '.btn-sm.btn-icon {}',
      '.settings-row-group {}',
      '.btn.btn-icon svg {}',
    ].join('\n');
    expect(findViolations(css)).toEqual([]);
  });

  it('menolak font-size px baru di luar tangga token', () => {
    const css = '.a { font-size: 13px; }\n.b { font-size: 13.75px; }';
    const violations = findViolations(css);
    expect(violations.some((v) => v.includes('13.75px'))).toBe(true);
  });

  it('extractFontSizes mengabaikan komentar dan menangkap semua nilai px deklarasi', () => {
    expect(extractFontSizes('/* font-size: 99px; */\n.a { font-size: 12px; }')).toEqual(new Set(['12']));
    expect(extractFontSizes('.a { font-size: clamp(18px, 5vw, 22px); }')).toEqual(new Set(['18', '22']));
  });

  it('allowlist font-size mencakup 25 nilai existing (termasuk batas clamp fluid 26/30px)', () => {
    expect(FONT_SIZE_ALLOWLIST.size).toBe(25);
  });
});

describe('guard-css-classes hex/spacing (pasal 7/8)', () => {
  it('SPACING_SCALE = tangga kanonis pasal 7', () => {
    expect(SPACING_SCALE).toEqual(
      new Set(['0', '2', '4', '6', '8', '10', '12', '16', '20', '24', '32', '48']),
    );
  });

  it('extractHardcodedHex: tangkap 3/6-digit, abaikan komentar, lowercase', () => {
    const css = '/* #ffffff */\n.a { color: #FFF; border-color: #123456; }';
    expect(extractHardcodedHex(css)).toEqual(
      new Map([
        ['#fff', 1],
        ['#123456', 1],
      ]),
    );
  });

  it('extractHardcodedHex: lewati domain sah pasal 8', () => {
    expect(extractHardcodedHex('.a{color:#111827}.b{color:#e4e4e7}')).toEqual(new Map());
    expect(HEX_VALUE_ALLOWLIST.has('#111827')).toBe(true);
    expect(HEX_VALUE_ALLOWLIST.has('#2f6df6')).toBe(true);
  });

  it('extractOffScaleSpacing: on-scale lolos, drift 14/5/7 tertangkap', () => {
    expect(extractOffScaleSpacing('.a{margin:12px;padding:0 16px;gap:8px}')).toEqual(new Map());
    expect(extractOffScaleSpacing('.a{margin-top:14px;padding-inline:5px}')).toEqual(
      new Map([
        ['14', 1],
        ['5', 1],
      ]),
    );
  });

  it('extractOffScaleSpacing: pindai row-gap/column-gap, abaikan border-width', () => {
    expect(extractOffScaleSpacing('.a{column-gap:7px;row-gap:12px}')).toEqual(new Map([['7', 1]]));
    expect(extractOffScaleSpacing('.a{border-width:1px;border:3px solid transparent}')).toEqual(
      new Map(),
    );
  });

  it('extractTsxHexFiles: semua hex per file, dedup, skip test + allowlist', () => {
    const src = [
      {
        file: 'src/features/board/X.tsx',
        src: 'const a = "#dc2626"; const b = "#DC2626"; const c = "#111827";',
      },
      { file: 'src/components/Logo.tsx', src: 'const a = "#123456";' },
      { file: 'src/foo.test.tsx', src: 'const a = "#123456";' },
    ];
    expect(extractTsxHexFiles(src)).toEqual([{ file: 'src/features/board/X.tsx', hex: '#dc2626' }]);
    expect(HEX_FILE_ALLOWLIST.has('src/components/Logo.tsx')).toBe(true);
  });

  it('findTokenWarnings: format pesan hex/spacing', () => {
    const w = findTokenWarnings('.a{color:#e5484d;margin:9px}', []);
    expect(w.some((x) => x.includes('#e5484d'))).toBe(true);
    expect(w.some((x) => x.includes('9px'))).toBe(true);
  });
});

describe('guard-css-classes radius/border/btn (pasal 7/9)', () => {
  it('extractOffScaleRadius: var() dan 0 lolos, mentah tertangkap', () => {
    expect(extractOffScaleRadius('.a{border-radius:var(--radius-card)}')).toEqual(new Map());
    expect(extractOffScaleRadius('.a{border-radius:0}')).toEqual(new Map());
    expect(extractOffScaleRadius('.a{border-radius:50%}.b{border-radius:10px}')).toEqual(
      new Map([
        ['50%', 1],
        ['10px', 1],
      ]),
    );
  });

  it('extractOffWidthBorder: 1px lolos, selain itu tertangkap', () => {
    expect(extractOffWidthBorder('.a{border:1px solid red}')).toEqual(new Map());
    expect(extractOffWidthBorder('.a{border-top:3px dashed red}')).toEqual(new Map([['3', 1]]));
    expect(extractOffWidthBorder('.a{border-width:1px}')).toEqual(new Map());
  });

  it('extractRawBorderColor: rgba tertangkap, var() lolos', () => {
    expect(extractRawBorderColor('.a{border:1px solid var(--border-hairline)}')).toEqual(new Map());
    expect(extractRawBorderColor('.a{border:1px solid rgba(52, 195, 142, 0.3)}')).toEqual(
      new Map([['rgba(52,195,142,0.3)', 1]]),
    );
  });

  it('extractUnsizedButtons: statis tanpa size tertangkap, bersize dan dinamis lolos', () => {
    const src = [
      { file: 'src/a.tsx', src: '<button className="btn btn-secondary">x</button>' },
      { file: 'src/b.tsx', src: '<button className="btn btn-ghost btn-sm">x</button>' },
      { file: 'src/c.tsx', src: '<button className={cx}>x</button>' },
      { file: 'src/d.test.tsx', src: '<button className="btn">x</button>' },
    ];
    expect(extractUnsizedButtons(src)).toEqual([{ file: 'src/a.tsx', cls: 'btn btn-secondary' }]);
  });

  it('findTokenWarnings: pesan radius 50% menuntut pill', () => {
    const w = findTokenWarnings('.a{border-radius:50%}', []);
    expect(w.some((x) => x.includes('50%') && x.includes('pill'))).toBe(true);
  });
});

describe('guard-css-classes ghost var + inline style (pasal 7/8)', () => {
  it('extractGhostVars: var(--danger|--warning) tertangkap, status-* lolos', () => {
    expect(extractGhostVars('.a{color:var(--danger)}')).toEqual(new Map([['var(--danger)', 1]]));
    expect(extractGhostVars('.a{color:var(--warning)}')).toEqual(new Map([['var(--warning)', 1]]));
    expect(extractGhostVars('.a{color:var(--status-danger);background:var(--status-warn-dim)}')).toEqual(
      new Map(),
    );
  });

  it('extractTsxGhostVars: TSX ghost tertangkap per file, test diskip', () => {
    const src = [
      { file: 'src/features/keys/X.tsx', src: "style={{ color: 'var(--danger)' }}" },
      { file: 'src/y.test.tsx', src: 'var(--warning)' },
    ];
    expect(extractTsxGhostVars(src)).toEqual([{ file: 'src/features/keys/X.tsx', name: 'var(--danger)' }]);
  });

  it('extractTsxInlineStyles: inline terhitung, btn-icon-wrap tersanksi dikecualikan', () => {
    const src = [
      {
        file: 'src/features/keys/KeysPage.tsx',
        src: '<div className="auth-banner" style={{ marginTop: 24 }} />',
      },
      {
        file: 'src/components/Button.tsx',
        src: '<span className="btn-icon-wrap" style={{ display: \'inline-flex\' }}>x</span>',
      },
      { file: 'src/z.test.tsx', src: '<div style={{ marginTop: 1 }} />' },
    ];
    expect(extractTsxInlineStyles(src)).toEqual([{ file: 'src/features/keys/KeysPage.tsx', count: 1 }]);
  });

  it('findTokenWarnings: inline style masuk warn-first', () => {
    const w = findTokenWarnings('.a{}', [{ file: 'src/q.tsx', src: '<div style={{ marginTop: 1 }} />' }]);
    expect(w.some((x) => x.includes('style={{}}') && x.includes('src/q.tsx'))).toBe(true);
  });
});
