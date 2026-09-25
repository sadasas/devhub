/**
 * Install service GitHub (application, ADR-041): orkestrasi instalasi App +
 * token instalasi (refresh lazy on-use). Tanpa express — dipanggil handlers.
 */

import { ApiError } from "../../../../shared/errors.js";
import {
  createInstallationToken,
  getInstallationInfo,
  isGithubAppConfigured,
  listInstallationRepos,
} from "../infrastructure/github-app.js";
import { openInstallationToken, sealInstallationToken } from "../infrastructure/token-vault.js";
import {
  getInstallation,
  markInstallationStatus,
  saveInstallationToken,
  upsertInstallation,
  type GithubInstallationRow,
} from "../infrastructure/github-repository.js";

export function assertGithubConfigured(): void {
  if (!isGithubAppConfigured()) {
    throw new ApiError(503, "GITHUB_NOT_CONFIGURED", "GitHub App is not configured");
  }
}

/** Callback Setup URL GitHub: catat/refresh baris instalasi (tanpa token dulu — lazy). */
export async function handleSetupCallback(installationId: number): Promise<GithubInstallationRow> {
  assertGithubConfigured();
  const info = await getInstallationInfo(installationId);
  return upsertInstallation({
    installationId,
    accountLogin: info.accountLogin,
    accountType: info.accountType,
  });
}

/**
 * Token instalasi siap pakai: cache sealed di DB dipakai bila belum kedaluwarsa
 * (skew 5 menit); selain itu tukar baru via App JWT lalu simpan sealed.
 */
export async function ensureInstallationToken(installationId: number): Promise<string> {
  assertGithubConfigured();
  const row = await getInstallation(installationId);
  if (!row) throw new Error(`Unknown GitHub installation: ${installationId}`);
  if (row.tokenBlob && row.tokenExpiresAt) {
    const skewMs = 5 * 60_000;
    if (row.tokenExpiresAt.getTime() - Date.now() > skewMs) {
      try {
        return openInstallationToken(row.tokenBlob);
      } catch {
        // Blob rusak (mis. rotasi JWT_SECRET) — tukar baru di bawah.
      }
    }
  }
  try {
    const { token, expiresAt } = await createInstallationToken(installationId);
    await saveInstallationToken(installationId, sealInstallationToken(token), new Date(expiresAt));
    return token;
  } catch (err) {
    const message = err instanceof Error ? err.message : "installation token failed";
    await markInstallationStatus(installationId, "error", message).catch(() => {});
    throw err;
  }
}

/**
 * Verifikasi repo milik instalasi (multi-akun): gagal bila `owner/repo`
 * tidak ada di daftar repo instalasi — mencegah salah pilih instalasi
 * (mis. instalasi akun-A dipasangkan repo akun-B; GitHub owner/repo
 * case-insensitive). Dipanggil POST /repos sebelum insert mapping.
 * Batas jujur: daftar dibatasi 10 halaman (±1000 repo, lihat
 * listInstallationRepos) — org raksasa di atas itu bisa false-negative;
 * pesannya mengarahkan lewat picker (sumber list yang sama).
 */
export async function assertRepoBelongsToInstallation(
  installationId: number,
  owner: string,
  repo: string,
): Promise<void> {
  assertGithubConfigured();
  const row = await getInstallation(installationId);
  if (!row) throw new Error(`Unknown GitHub installation: ${installationId}`);
  const token = await ensureInstallationToken(installationId);
  const repos = await listInstallationRepos(token);
  const wantOwner = owner.toLowerCase();
  const wantRepo = repo.toLowerCase();
  const found = repos.some((r) => r.owner.toLowerCase() === wantOwner && r.repo.toLowerCase() === wantRepo);
  if (!found) {
    const account = row.accountLogin ? ` ("${row.accountLogin}")` : "";
    throw new ApiError(
      403,
      "REPO_NOT_IN_INSTALLATION",
      `Repository ${owner}/${repo} is not in GitHub installation #${installationId}${account}. Pick a repository from that installation's picker (or install the App on the right account).`,
    );
  }
}
