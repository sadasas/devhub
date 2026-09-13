/** Consent Mode v2 + GA lazy-inject — Tier 2 Must.
 * - Default `denied` SEBELUM gtag.js ada (panggil ensureConsentDefaults() di main.tsx paling awal).
 * - gtag.js JANGAN di-inject jika tolak; lazy inject hanya setelah setuju + update granted.
 * - Simpan localStorage `devhub_consent_v1` {status,analytics,timestamp,policyVersion,bannerVersion}.
 * - page_view HANYA pasca-consent via sendPageView(): config memakai
 *   send_page_view:false + event manual sekali per load + tiap navigasi SPA.
 *   Tanpa PII: path dinamis dinormalisasi, query di-strip.
 * - JANGAN pasang Measurement ID asli — pakai placeholder + env VITE_GA_MEASUREMENT_ID.
 */

export const CONSENT_STORAGE_KEY = 'devhub_consent_v1';
export const CONSENT_POLICY_VERSION = '2026-09-01';
export const CONSENT_BANNER_VERSION = 1;
export const GA_PLACEHOLDER_ID = 'G-XXXXXXX';

export type ConsentStatus = 'accepted' | 'rejected' | 'custom';

export interface ConsentState {
  status: ConsentStatus;
  analytics: boolean;
  timestamp: string;
  policyVersion: string;
  bannerVersion: number;
}

export const CONSENT_OPEN_EVENT = 'devhub:open-consent';

export function openConsentSettings(): void {
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
  } catch {
    /* ignore */
  }
}

/** Pure resolver (diuji langsung) — pisahkan dari import.meta agar testable. */
export function resolveGaMeasurementId(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed && /^G-[A-Z0-9]{4,}$/.test(trimmed)) return trimmed;
  return GA_PLACEHOLDER_ID;
}

export function getGaMeasurementId(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_GA_MEASUREMENT_ID;
    return resolveGaMeasurementId(env);
  } catch {
    return GA_PLACEHOLDER_ID;
  }
}

export function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.status !== 'accepted' && parsed.status !== 'rejected' && parsed.status !== 'custom') return null;
    return {
      status: parsed.status,
      analytics: parsed.analytics === true,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date(0).toISOString(),
      policyVersion: typeof parsed.policyVersion === 'string' ? parsed.policyVersion : CONSENT_POLICY_VERSION,
      bannerVersion: typeof parsed.bannerVersion === 'number' ? parsed.bannerVersion : CONSENT_BANNER_VERSION,
    };
  } catch {
    return null;
  }
}

export function writeConsent(status: ConsentStatus, analytics: boolean): ConsentState {
  const next: ConsentState = {
    status,
    analytics,
    timestamp: new Date().toISOString(),
    policyVersion: CONSENT_POLICY_VERSION,
    bannerVersion: CONSENT_BANNER_VERSION,
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __devhubGtagInjected?: boolean;
  }
}

function gtagStub(...args: unknown[]): void {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(args);
}

/** WAJIB dipanggil sebelum render — set default denied SEBELUM gtag.js ada. */
export function ensureConsentDefaults(): void {
  try {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer ?? [];
    if (typeof window.gtag !== 'function') {
      window.gtag = gtagStub;
    }
    // Consent Mode v2 defaults — selalu denied saat boot.
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'denied',
      personalization_storage: 'denied',
      security_storage: 'granted',
    });
    // Jika user sebelumnya sudah setuju, upgrade ke granted + lazy inject
    // (page_view pertama menyusul pasca-config di dalam inject).
    const saved = readConsent();
    if (saved?.analytics) {
      updateConsentGranted();
      void injectGtagIfGranted();
    }
  } catch {
    /* never block boot */
  }
}

export function updateConsentGranted(): void {
  try {
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
    });
  } catch {
    /* ignore */
  }
}

export function updateConsentDenied(): void {
  try {
    window.gtag?.('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
  } catch {
    /* ignore */
  }
}

/** Normalisasi path agar ID dinamis tidak jadi kardinalitas liar / bocor ke GA. */
export function normalizePagePath(pathname: string): string {
  const normalized = pathname
    .replace(/^\/project\/[^/]+/, '/project/[id]')
    .replace(/^\/team\/[^/]+/, '/team/[slug]')
    .replace(/^\/p\/[^/]+/, '/p/[id]');
  return normalized || '/';
}

/**
 * True bila event analytics boleh dikirim sekarang (semua gate lolos).
 * Param `id` opsional = seam test (default baca env saat dipanggil).
 */
export function canSendAnalytics(id: string = getGaMeasurementId()): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (!readConsent()?.analytics) return false;
    if (id === GA_PLACEHOLDER_ID) return false;
    if (!window.__devhubGtagInjected) return false;
    return typeof window.gtag === 'function';
  } catch {
    return false;
  }
}

/**
 * Kirim satu GA4 page_view — HANYA pasca-consent (no-op bila gate mana pun
 * gagal). Dipanggil sekali pasca-config + tiap navigasi SPA via RouteTracker.
 * Query di-strip (bisa membawa token), path dinamis dinormalisasi.
 * Dedup modul: pengiriman beruntun untuk path sama (race inject-onload vs
 * mount RouteTracker, StrictMode dev) hanya dikirim sekali; navigasi
 * pergi-kembali tetap tercatat karena path di antaranya berbeda.
 */
let lastSentPath: string | null = null;

export function sendPageView(id: string = getGaMeasurementId()): void {
  try {
    if (!canSendAnalytics(id)) return;
    const path = normalizePagePath(window.location.pathname);
    if (lastSentPath === path) return;
    lastSentPath = path;
    window.gtag?.('event', 'page_view', {
      page_location: `${window.location.origin}${path}`,
      page_path: path,
      page_title: document.title,
    });
  } catch {
    /* analytics must never break the app */
  }
}

/** Lazy inject gtag.js HANYA setelah setuju. Resolve false jika ditolak / sudah diinject. */
export function injectGtagIfGranted(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const saved = readConsent();
      if (!saved?.analytics) {
        resolve(false);
        return;
      }
      if (window.__devhubGtagInjected) {
        resolve(true);
        return;
      }
      const id = getGaMeasurementId();
      // Placeholder tanpa network saat dev/CI — jangan inject G-XXXX ke google.
      if (id === GA_PLACEHOLDER_ID) {
        window.__devhubGtagInjected = true;
        updateConsentGranted();
        resolve(true);
        return;
      }
      const existing = document.querySelector(`script[data-devhub-gtag="${id}"]`);
      if (existing) {
        window.__devhubGtagInjected = true;
        resolve(true);
        return;
      }
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      s.setAttribute('data-devhub-gtag', id);
      s.onload = () => {
        try {
          window.__devhubGtagInjected = true;
          updateConsentGranted();
          // send_page_view mati agar TIDAK ada hit pra-consent; page_view
          // eksplisit dikirim di bawah, hanya bila consent masih granted.
          window.gtag?.('config', id, { send_page_view: false });
          sendPageView();
        } catch {
          /* ignore */
        }
        resolve(true);
      };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
      // Timeout aman: jangan gantung promise.
      window.setTimeout(() => resolve(Boolean(window.__devhubGtagInjected)), 8000);
    } catch {
      resolve(false);
    }
  });
}

/** Hapus cookie _ga* saat cabut persetujuan (path + domain best-effort). */
export function clearGaCookies(): void {
  try {
    const names = document.cookie
      .split(';')
      .map((c) => c.trim().split('=')[0] ?? '')
      .filter((n) => n === '_ga' || n.startsWith('_ga_') || n === '_gat' || n === '_gid');
    const host = window.location.hostname;
    const domains = [undefined as unknown as string, host, `.${host}`];
    for (const n of names) {
      for (const d of domains) {
        try {
          document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;${d ? ` domain=${d};` : ''}`;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

export function acceptAllConsent(): ConsentState {
  const next = writeConsent('accepted', true);
  updateConsentGranted();
  void injectGtagIfGranted();
  return next;
}

export function rejectAllConsent(): ConsentState {
  const next = writeConsent('rejected', false);
  updateConsentDenied();
  clearGaCookies();
  return next;
}

export function saveCustomConsent(analytics: boolean): ConsentState {
  const next = writeConsent('custom', analytics);
  if (analytics) {
    updateConsentGranted();
    void injectGtagIfGranted();
  } else {
    updateConsentDenied();
    clearGaCookies();
  }
  return next;
}
