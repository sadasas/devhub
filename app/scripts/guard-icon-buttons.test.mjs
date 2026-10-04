import { describe, expect, it } from 'vitest';
import { ALLOWLIST, buttonTags, findViolations, inRanges, tooltipRanges } from './guard-icon-buttons.mjs';

function sources(files) {
  return files.map(([file, src]) => ({ file, src }));
}

describe('guard-icon-buttons', () => {
  it('menandai <button> btn-icon di luar Tooltip', () => {
    const v = findViolations(
      sources([
        ['src/a.tsx', '<button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="X"><X /></button>'],
      ]),
    );
    expect(v).toHaveLength(1);
    expect(v[0].hasTitle).toBe(false);
  });

  it('menandai komponen <Button> btn-icon di luar Tooltip (celah 2026-10-04)', () => {
    const v = findViolations(
      sources([
        [
          'src/b.tsx',
          '<Button variant="ghost" size="sm" className="btn-icon" aria-label="Y"><X /></Button>',
        ],
      ]),
    );
    expect(v).toHaveLength(1);
  });

  it('meloloskan tombol di dalam rentang <Tooltip> seimbang (button maupun Button)', () => {
    const v = findViolations(
      sources([
        [
          'src/c.tsx',
          '<Tooltip title="X"><button type="button" className="btn btn-icon" aria-label="X"><X /></button></Tooltip><Tooltip title="Y"><Button className="btn-icon" aria-label="Y"><X /></Button></Tooltip>',
        ],
      ]),
    );
    expect(v).toEqual([]);
  });

  it('menandai title= telanjang dengan hasTitle', () => {
    const v = findViolations(
      sources([
        [
          'src/d.tsx',
          '<button type="button" className="btn btn-icon" aria-label="Pin" title="Pin"><X /></button>',
        ],
      ]),
    );
    expect(v).toHaveLength(1);
    expect(v[0].hasTitle).toBe(true);
  });

  it('meloloskan entri ALLOWLIST tutup/dismiss', () => {
    const v = findViolations(
      sources([
        [
          'src/features/project/ArchiveUndoToast.tsx',
          `<button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('archiveToast.dismiss')}><X /></button>`,
        ],
      ]),
    );
    expect(v).toEqual([]);
    expect(ALLOWLIST.length).toBeGreaterThan(0);
  });

  it('buttonTags memindai tag <Button> multi-baris penuh', () => {
    const src = '<Button\n  variant="ghost"\n  className="btn-icon"\n  aria-label="Z"\n>';
    const tags = buttonTags(src);
    expect(tags).toHaveLength(1);
    expect(tags[0].tag).toContain('btn-icon');
  });

  it('tooltipRanges mengabaikan <TooltipCard dan self-closing', () => {
    const src = '<TooltipCard title="x" /><Tooltip title="y"><button className="btn-icon" /></Tooltip>';
    expect(tooltipRanges(src)).toHaveLength(1);
    expect(inRanges(tooltipRanges(src), src.indexOf('<button'))).toBe(true);
  });
});
