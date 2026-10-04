/**
 * ADR-067: actualHours full-otomatis dari akumulasi interval inProgress.
 * - masuk inProgress dari status lain: inProgressAt = now bila null.
 * - keluar dari inProgress ke status APAPUN: activeMs += now - inProgressAt,
 *   inProgressAt = null, actualHours = round1(activeMs/3.6e6).
 * - masuk done tanpa pernah inProgress (activeMs==0, inProgressAt null,
 *   belum ada actualHours): fallback round1((doneAt - createdAt)/3.6e6).
 * - data lama: activeMs undefined + actualHours != null → seed sekali.
 * State = JSONB (projects.data), jadi tanpa migrasi SQL.
 */

export function round1HoursFromMs(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round((ms / 3.6e6) * 10) / 10);
}

export function activeMsFromHours(h: number): number {
  if (!Number.isFinite(h)) return 0;
  return Math.max(0, Math.round(h * 3.6e6));
}

export interface TaskHoursSnapshot {
  status: string;
  createdAt: string;
  inProgressAt?: string | null;
  activeMs?: number;
  actualHours?: number;
}

function normalizedActiveMs(before: TaskHoursSnapshot): number | undefined {
  if (typeof before.activeMs === 'number' && Number.isFinite(before.activeMs) && before.activeMs >= 0) {
    return Math.round(before.activeMs);
  }
  if (
    before.actualHours != null &&
    typeof before.actualHours === 'number' &&
    Number.isFinite(before.actualHours)
  ) {
    return activeMsFromHours(before.actualHours);
  }
  return undefined;
}

function prevInProgressAt(before: TaskHoursSnapshot): string | null {
  return typeof before.inProgressAt === 'string' && before.inProgressAt ? before.inProgressAt : null;
}

/**
 * Hitung patch jam untuk transisi status. Kembalikan partial kosong bila
 * tidak ada perubahan jam (status sama / tanpa seed legacy).
 */
export function applyActiveHoursTransition(
  before: TaskHoursSnapshot,
  nextStatus: string,
  now: string,
  doneAt?: string | null,
): Partial<Pick<TaskHoursSnapshot, 'inProgressAt' | 'activeMs' | 'actualHours'>> {
  const prevStatus = before.status;
  if (nextStatus === prevStatus) {
    if (before.activeMs === undefined && before.actualHours != null) {
      const seeded = normalizedActiveMs(before);
      if (seeded !== undefined) return { activeMs: seeded };
    }
    return {};
  }
  const seeded = normalizedActiveMs(before);
  const baseMs = seeded ?? 0;
  const prevAt = prevInProgressAt(before);

  // Masuk inProgress: buka interval bila belum ada.
  if (nextStatus === 'inProgress' && prevStatus !== 'inProgress') {
    const patch: Partial<Pick<TaskHoursSnapshot, 'inProgressAt' | 'activeMs' | 'actualHours'>> = {
      inProgressAt: prevAt ?? now,
    };
    if (before.activeMs === undefined) patch.activeMs = baseMs;
    return patch;
  }
  // Keluar dari inProgress ke APAPUN: tutup interval + recompute.
  if (prevStatus === 'inProgress' && nextStatus !== 'inProgress') {
    if (prevAt) {
      const nowMs = Date.parse(now);
      const startMs = Date.parse(prevAt);
      const diff =
        Number.isFinite(nowMs) && Number.isFinite(startMs) ? Math.max(0, Math.round(nowMs - startMs)) : 0;
      const nextActiveMs = baseMs + diff;
      return { inProgressAt: null, activeMs: nextActiveMs, actualHours: round1HoursFromMs(nextActiveMs) };
    }
    if (before.activeMs === undefined) return { inProgressAt: null, activeMs: baseMs };
    return { inProgressAt: null };
  }
  // Masuk done tanpa pernah inProgress: fallback createdAt → doneAt.
  if (nextStatus === 'done' && prevStatus !== 'done') {
    if (baseMs === 0 && !prevAt && before.actualHours == null) {
      const createdMs = Date.parse(before.createdAt);
      const doneMs = Date.parse(doneAt ?? now);
      const diff =
        Number.isFinite(createdMs) && Number.isFinite(doneMs)
          ? Math.max(0, Math.round(doneMs - createdMs))
          : 0;
      return { inProgressAt: null, activeMs: diff, actualHours: round1HoursFromMs(diff) };
    }
    if (before.activeMs === undefined && seeded !== undefined) {
      return { activeMs: seeded };
    }
  }
  if (before.activeMs === undefined && seeded !== undefined) {
    return { activeMs: seeded };
  }
  return {};
}

/** Nilai jam awal untuk task baru (client-supplied jam selalu diabaikan). */
export function initTaskHoursOnCreate(
  status: string,
  createdAt: string,
  now: string,
  doneAt?: string | null,
): { inProgressAt: string | null; activeMs: number; actualHours?: number } {
  if (status === 'inProgress') {
    return { inProgressAt: now, activeMs: 0, actualHours: undefined };
  }
  if (status === 'done') {
    const createdMs = Date.parse(createdAt);
    const doneMs = Date.parse(doneAt ?? now);
    const diff =
      Number.isFinite(createdMs) && Number.isFinite(doneMs)
        ? Math.max(0, Math.round(doneMs - createdMs))
        : 0;
    return { inProgressAt: null, activeMs: diff, actualHours: round1HoursFromMs(diff) };
  }
  return { inProgressAt: null, activeMs: 0, actualHours: undefined };
}