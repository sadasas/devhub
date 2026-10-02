import { useEffect, useState } from 'react';
import posthog from 'posthog-js';

/** Kill-switch for focus mode. Fail-open: anything !== false behaves ON. */
export const FOCUS_MODE_FLAG = 'focus-mode-enabled';

let inited = false;
let healthProbe: ReturnType<typeof setTimeout> | null = null;
const reportedFlagIssues = new Set<string>();

/**
 * How long to wait after init before checking that flags actually loaded.
 * SDK flag request times out at 3s, so 8s is well past a normal load.
 */
const FLAG_HEALTH_PROBE_MS = 8000;

/**
 * Fail-open makes "flags never loaded" look identical to "flag is off", so a
 * dead `/flags` request (bad key, wrong region, network) is invisible in the
 * UI. Log it once per key instead of staying silent.
 */
function reportFlagIssue(detail: string): void {
  if (reportedFlagIssues.has(FOCUS_MODE_FLAG)) return;
  reportedFlagIssues.add(FOCUS_MODE_FLAG);
  console.warn(`[analytics] feature flag "${FOCUS_MODE_FLAG}": ${detail}`);
}

function scheduleFlagHealthProbe(): void {
  try {
    healthProbe = setTimeout(() => {
      healthProbe = null;
      if (!inited) return;
      try {
        const all = posthog.getAllFeatureFlags?.() ?? [];
        if (all.length === 0) {
          reportFlagIssue(
            'no flags loaded — check VITE_POSTHOG_KEY, VITE_POSTHOG_HOST region and the /flags response. Kill-switch is inert (running on fallback).',
          );
        } else if (!all.some((flag) => flag.key === FOCUS_MODE_FLAG)) {
          reportFlagIssue(
            'flags loaded but this key is absent — flag missing, misspelled or rolled out to 0%. Running on fallback.',
          );
        }
      } catch {
        /* analytics must never break the app */
      }
    }, FLAG_HEALTH_PROBE_MS);
    // Node test runner: don't let the pending probe hold the process open.
    (healthProbe as unknown as { unref?: () => void }).unref?.();
  } catch {
    /* ignore */
  }
}

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
    const host = readEnv('VITE_POSTHOG_HOST') || 'https://us.i.posthog.com';
    posthog.init(key, {
      api_host: host,
      persistence: 'memory',
      autocapture: false,
      disable_session_recording: true,
    });
    inited = true;
    scheduleFlagHealthProbe();
  } catch {
    /* analytics must never break the app */
  }
}

/** Test seam: reset module init state (and cancel a pending flag health probe). */
export function __resetAnalyticsForTests(): void {
  inited = false;
  if (healthProbe != null) {
    clearTimeout(healthProbe);
    healthProbe = null;
  }
  reportedFlagIssues.clear();
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
