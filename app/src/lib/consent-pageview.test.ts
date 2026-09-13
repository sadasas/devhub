import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  GA_PLACEHOLDER_ID,
  normalizePagePath,
  resolveGaMeasurementId,
} from './consent';

// consent.ts menyimpan dedup page_view di state modul — tiap test gating
// memakai import segar agar tidak saling memengaruhi. ID di-inject via param
// (bukan stubEnv: snapshot import.meta di modul kebal stubEnv — terverifikasi).
async function freshConsent() {
  vi.resetModules();
  return await import('./consent');
}

const REAL_ID = 'G-TEST1234ABCD';

function setConsent(analytics: boolean): void {
  window.localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({
      status: 'custom',
      analytics,
      timestamp: new Date(0).toISOString(),
      policyVersion: '2026-09-01',
      bannerVersion: 1,
    }),
  );
}

type GtagFn = NonNullable<Window['gtag']>;

describe('resolveGaMeasurementId', () => {
  it('accepts valid IDs, trims, rejects garbage', () => {
    expect(resolveGaMeasurementId('G-8GTD1D4ZCM')).toBe('G-8GTD1D4ZCM');
    expect(resolveGaMeasurementId('  G-ABC12  ')).toBe('G-ABC12');
    expect(resolveGaMeasurementId('')).toBe(GA_PLACEHOLDER_ID);
    expect(resolveGaMeasurementId(undefined)).toBe(GA_PLACEHOLDER_ID);
    expect(resolveGaMeasurementId('G-12')).toBe(GA_PLACEHOLDER_ID);
    expect(resolveGaMeasurementId('g-lowercase1')).toBe(GA_PLACEHOLDER_ID);
    expect(resolveGaMeasurementId('https://evil.example/x')).toBe(GA_PLACEHOLDER_ID);
  });
});

describe('normalizePagePath', () => {
  it('masks dynamic segments, keeps static routes', () => {
    expect(normalizePagePath('/project/550e8400-e29b-41d4-a716-446655440000')).toBe('/project/[id]');
    expect(normalizePagePath('/team/acme')).toBe('/team/[slug]');
    expect(normalizePagePath('/p/abc123')).toBe('/p/[id]');
    expect(normalizePagePath('/pricing')).toBe('/pricing');
    expect(normalizePagePath('/')).toBe('/');
    expect(normalizePagePath('')).toBe('/');
  });
});

describe('sendPageView gating (consent-gated, no PII)', () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    window.__devhubGtagInjected = false;
    gtag = vi.fn();
    window.gtag = gtag as unknown as GtagFn;
  });

  it('no-op when consent denied', async () => {
    const m = await freshConsent();
    setConsent(false);
    window.__devhubGtagInjected = true;
    m.sendPageView(REAL_ID);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('no-op when measurement ID is placeholder (dev/CI)', async () => {
    const m = await freshConsent();
    setConsent(true);
    window.__devhubGtagInjected = true;
    m.sendPageView(GA_PLACEHOLDER_ID);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('no-op when gtag.js not injected yet', async () => {
    const m = await freshConsent();
    setConsent(true);
    window.__devhubGtagInjected = false;
    m.sendPageView(REAL_ID);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('sends one page_view with normalized path when all gates pass', async () => {
    const m = await freshConsent();
    setConsent(true);
    window.__devhubGtagInjected = true;
    m.sendPageView(REAL_ID);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({ page_path: '/' }),
    );
    const payload = (gtag.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
    expect(String(payload['page_location'] ?? '')).not.toContain('?');
  });

  it('dedupes consecutive sends for the same path', async () => {
    const m = await freshConsent();
    setConsent(true);
    window.__devhubGtagInjected = true;
    m.sendPageView(REAL_ID);
    m.sendPageView(REAL_ID);
    expect(gtag).toHaveBeenCalledTimes(1);
  });
});
