/**
 * Integration announce sheet — once-per-version dismissal.
 * Key `devhub_announce_integrations_v1`: bumping the version suffix
 * re-shows the sheet once (new announcement), tanpa migrasi data lama.
 * State lives in localStorage only (no backend, no activity_log).
 */

export const ANNOUNCE_INTEGRATIONS_KEY = 'devhub_announce_integrations_v1';

export function isAnnounceDismissed(): boolean {
  try {
    return localStorage.getItem(ANNOUNCE_INTEGRATIONS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissAnnounce(): void {
  try {
    localStorage.setItem(ANNOUNCE_INTEGRATIONS_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}
