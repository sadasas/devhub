import { describe, expect, it } from 'vitest';
import { compareVersions } from './compare-version';

describe('compareVersions', () => {
  it('compares numerically per segment (0.10 > 0.2)', () => {
    expect(compareVersions('0.2.0', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('0.10.0', '0.2.0')).toBeGreaterThan(0);
  });

  it('orders a realistic release sequence', () => {
    const versions = ['v0.20.1', 'v0.9.0', 'v0.20.0', '0.10.0', '0.2.0'];
    expect([...versions].sort(compareVersions)).toEqual(['0.2.0', 'v0.9.0', '0.10.0', 'v0.20.0', 'v0.20.1']);
  });

  it('strips a leading v prefix', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('V1.2.3', '1.2.4')).toBeLessThan(0);
  });

  it('treats missing segments as zero (1.0 < 1.0.1)', () => {
    expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('1.0.1', '1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });

  it('is equal for identical strings', () => {
    expect(compareVersions('0.20.0', '0.20.0')).toBe(0);
  });
});