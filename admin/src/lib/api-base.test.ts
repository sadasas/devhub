import { describe, expect, it } from 'vitest';
import { forceRelativeApiBase } from './api';

// Guard test (runbook §7): VITE_API_URL absolut cross-site TIDAK BOLEH lolos
// menjadi API_BASE runtime — harus dipaksa '/api/v1' same-origin via Worker
// proxy agar cookie sesi (first-party Lax, shared parent-domain ADR-051)
// tetap terkirim. Mirror app/src/lib/api-base.test.ts.
// Lihat admin/scripts/guard-vite-api-url.mjs (gagalkan build bila logika hilang).
describe('forceRelativeApiBase (same-origin guard)', () => {
  it('forces relative when env is absolute cross-site', () => {
    expect(
      forceRelativeApiBase('https://abc123.suga.run/api/v1', 'https://admin.nrawangbatin.my.id'),
    ).toBe('/api/v1');
  });

  it('keeps absolute when same-origin', () => {
    expect(
      forceRelativeApiBase(
        'https://admin.nrawangbatin.my.id/api/v1',
        'https://admin.nrawangbatin.my.id',
      ),
    ).toBe('https://admin.nrawangbatin.my.id/api/v1');
  });

  it('defaults empty/relative sentinel to /api/v1', () => {
    expect(forceRelativeApiBase(undefined, 'https://admin.nrawangbatin.my.id')).toBe('/api/v1');
    expect(forceRelativeApiBase('', 'https://admin.nrawangbatin.my.id')).toBe('/api/v1');
    expect(forceRelativeApiBase('/api/v1', 'https://admin.nrawangbatin.my.id')).toBe('/api/v1');
  });

  it('falls back to /api/v1 on malformed absolute', () => {
    expect(forceRelativeApiBase('https://', 'https://admin.nrawangbatin.my.id')).toBe('/api/v1');
  });
});
