import type { GitHubLink } from './types';

/**
 * Helper murni integrasi GitHub (tanpa DOM/fetch) — mirror server
 * domain/github.ts agar format branch konsisten di kedua sisi.
 */

export interface BadgeSummary {
  label: string;
  tone: 'info' | 'success' | 'warn' | 'danger' | 'muted';
  url: string;
  title: string;
}

/**
 * Agregat 1 baris untuk kartu: PR open/draft terbaru menang atas merged,
 * CI gagal menaikkan urgensi. Null bila tidak ada link PR.
 */
export function aggregatePrBadge(links: GitHubLink[] | undefined): BadgeSummary | null {
  const prs = (links ?? []).filter((l) => l.kind === 'pr');
  if (prs.length === 0) return null;
  const rank = (s: GitHubLink['status']) =>
    s === 'open' || s === 'draft' ? 0 : s === 'unknown' ? 1 : 2;
  const pr = [...prs].sort((a, b) => rank(a.status) - rank(b.status))[0]!;
  const parts: string[] = [`PR #${pr.ref} ${pr.status === 'draft' ? 'Draft' : pr.status === 'open' ? 'Open' : pr.status === 'merged' ? 'Merged' : pr.status}`];
  if (pr.reviewState === 'approved') parts.push('Approved');
  else if (pr.reviewState === 'changes_requested') parts.push('Changes requested');
  if (pr.ciState === 'fail') parts.push('CI failing');
  else if (pr.ciState === 'pending') parts.push('CI running');
  const tone =
    pr.ciState === 'fail' ? 'danger' : pr.status === 'merged' ? 'success' : pr.status === 'open' || pr.status === 'draft' ? 'info' : 'muted';
  return {
    label: parts.join(' · '),
    tone,
    url: pr.url || `https://github.com/${pr.repo}/pull/${pr.ref}`,
    title: pr.title ? `${pr.title} (${pr.repo})` : pr.repo,
  };
}

/** PR merged tapi task belum done -> banner suggest (keputusan: suggest, bukan auto). */
export function hasMergedUnresolved(links: GitHubLink[] | undefined, taskStatus: string): boolean {
  if (taskStatus === 'done') return false;
  return (links ?? []).some((l) => l.kind === 'pr' && l.status === 'merged');
}

export function shortTaskKey(taskId: string): string {
  return taskId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Project asal tombol Connect (pengganti `state` OAuth — Setup URL statis). */
export const GITHUB_PENDING_PROJECT_KEY = 'devhub:github:pendingProject';

export function readPendingProject(): string | null {
  try {
    return window.localStorage.getItem(GITHUB_PENDING_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function clearPendingProject(): void {
  try {
    window.localStorage.removeItem(GITHUB_PENDING_PROJECT_KEY);
  } catch {
    // abaikan — flow tetap jalan via picker manual.
  }
}

/** Mirror server formatBranchName: `feat/<short8>-<slug>` (max 80). */
export function formatBranchName(taskId: string, title: string, prefix = 'feat'): string {
  const short = taskId.replace(/-/g, '').slice(0, 8).toLowerCase();
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '');
  return `${prefix}/${short}${slug ? `-${slug}` : ''}`.slice(0, 80);
}
