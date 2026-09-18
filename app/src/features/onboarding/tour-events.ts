/**
 * Tour shared state + tracking stub.
 * State lives in localStorage only (no backend, no activity_log).
 * Keys: devhub:tour:skipped / devhub:tour:finished / devhub:tour:step
 */

export const TOUR_SKIPPED_KEY = 'devhub:tour:skipped';
export const TOUR_FINISHED_KEY = 'devhub:tour:finished';
export const TOUR_STEP_KEY = 'devhub:tour:step';

export const TOUR_TOTAL = 13;

let tourActiveFlag = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeTour(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setTourActiveFlag(v: boolean): void {
  tourActiveFlag = v;
  try {
    if (v) document.body.dataset.tourActive = 'true';
    else delete document.body.dataset.tourActive;
  } catch {
    /* DOM unavailable (SSR/test without body) */
  }
  emit();
}

/** True while the wizard is on screen. Used to pause N and keep Alt+digits alive. */
export function isTourActive(): boolean {
  if (tourActiveFlag) return true;
  try {
    return document.body?.dataset.tourActive === 'true';
  } catch {
    return false;
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, v: boolean): void {
  try {
    if (v) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function isTourSkipped(): boolean {
  return readFlag(TOUR_SKIPPED_KEY);
}

export function isTourFinished(): boolean {
  return readFlag(TOUR_FINISHED_KEY);
}

export function setTourSkipped(v = true): void {
  writeFlag(TOUR_SKIPPED_KEY, v);
}

export function setTourFinished(v = true): void {
  writeFlag(TOUR_FINISHED_KEY, v);
}

/** True when a tour was started (persists across reloads/routes). */
export function hasTourStep(): boolean {
  try {
    return localStorage.getItem(TOUR_STEP_KEY) !== null;
  } catch {
    return false;
  }
}

export function readTourStep(): number {
  try {
    const raw = Number(localStorage.getItem(TOUR_STEP_KEY));
    if (Number.isInteger(raw) && raw >= 0 && raw < TOUR_TOTAL) return raw;
  } catch {
    /* ignore */
  }
  return 0;
}

export function writeTourStep(step: number): void {
  try {
    localStorage.setItem(TOUR_STEP_KEY, String(step));
  } catch {
    /* storage unavailable */
  }
  emit();
}

export function clearTourStep(): void {
  try {
    localStorage.removeItem(TOUR_STEP_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export type TourEvent =
  | 'tour_started'
  | 'tour_step'
  | 'tour_skipped'
  | 'tour_finished';
/**
 * Tracking stub — no-op by design (no backend yet).
 * Kept as console.debug so future analytics can hook in one place.
 */
export function trackTourEvent(event: TourEvent, data?: Record<string, unknown>): void {
  console.debug('[tour]', event, data ?? {});
}
