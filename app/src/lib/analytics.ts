import { useEffect, useState } from 'react';
import posthog from 'posthog-js';

/** Kill-switch for focus mode. Fail-open: anything !== false behaves ON. */
export const FOCUS_MODE_FLAG = 'focus-mode-enabled';

let inited = false;

function readEnv(key: string): string {
  try {
    const metaVal = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key];
    if (metaVal != null && metaVal !== '') return metaVal.trim();
  } catch {
    /* ignore */
  }
  // Test seam: vitest vi.stubEnv writes process.env (via globalThis — no node types needed).
  try {
    const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
    return (proc?.env?.[key] ?? '').trim();
  } catch {
    return '';
  }
}

/**
 * Init PostHog once (call from app entry). Dev-safe: SKIP entirely when
 * VITE_POSTHOG_KEY is empty. Idempotent.
 */
export function initAnalytics(): void {
  if (inited) return;
  try {
    const key = readEnv('VITE_POSTHOG_KEY');
    if (!key) return;
    const host = readEnv('VITE_POSTHOG_HOST') || 'https://eu.i.posthog.com';
    posthog.init(key, {
      api_host: host,
      persistence: 'memory',
      autocapture: false,
      disable_session_recording: true,
    });
    inited = true;
  } catch {
    /* analytics must never break the app */
  }
}

/** Test seam: reset module init state. */
export function __resetAnalyticsForTests(): void {
  inited = false;
}

/** Track a custom event. No-op when uninit (missing key / SDK down). */
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    if (!inited) return;
    posthog.capture(event, props);
  } catch {
    /* ignore */
  }
}

/** Report an error via PostHog exception capture. No-op when uninit. */
export function reportError(err: unknown, props?: Record<string, unknown>): void {
  try {
    if (!inited) return;
    posthog.captureException(err, props);
  } catch {
    /* ignore */
  }
}

/**
 * Boolean feature flag with fail-open fallback. Returns `fallback` until
 * flags arrive; missing key / SDK-down / pending all behave ON when
 * fallback is true. No banner.
 */
export function useFeatureFlag(key: string, fallback: boolean): boolean {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    let cancelled = false;
    try {
      const current = posthog.isFeatureEnabled?.(key);
      if (typeof current === 'boolean' && !cancelled) setValue(current);
      const unsub = posthog.onFeatureFlags?.(() => {
        try {
          const next = posthog.isFeatureEnabled?.(key);
          if (typeof next === 'boolean' && !cancelled) setValue(next);
        } catch {
          /* keep fallback */
        }
      });
      return () => {
        cancelled = true;
        try {
          if (typeof unsub === 'function') (unsub as () => void)();
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* keep fallback */
    }
    return () => {
      cancelled = true;
    };
  }, [key]);
  return value;
}
