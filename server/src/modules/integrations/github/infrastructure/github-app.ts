import { createPrivateKey, createSign } from "node:crypto";
import { config } from "../../../../config.js";
import { GITHUB_API_BASE } from "../domain/github.js";

/**
 * Klien GitHub App (infrastructure, ADR-041): JWT App RS256 + installation
 * access token via `fetch` native. Tanpa dep baru (reuse pola social.routes).
 *
 * - JWT: `RS256`, `iat -60s` (toleransi skew), `exp +10m` (maks GitHub),
 *   `iss = APP_ID`. Private key dari env base64 1 baris.
 * - Installation token: `POST /app/installations/{id}/access_tokens`
 *   (short-lived ~1 jam). Disimpan sealed di DB, di-refresh lazy on-use.
 */

export function isGithubAppConfigured(): boolean {
  return Boolean(
    config.GITHUB_APP_ID &&
      config.GITHUB_APP_PRIVATE_KEY_B64 &&
      config.GITHUB_APP_WEBHOOK_SECRET,
  );
}

function readPrivateKeyPem(): string {
  const raw = config.GITHUB_APP_PRIVATE_KEY_B64.trim();
  // Terima base64 1 baris ATAU PEM multiline (dev lokal) — normalisasi ke PEM.
  if (raw.includes("BEGIN")) return raw;
  return Buffer.from(raw, "base64").toString("utf8");
}

export function createAppJwt(nowSec: number = Math.floor(Date.now() / 1000)): string {
  if (!config.GITHUB_APP_ID) throw new Error("GITHUB_APP_ID is not configured");
  const pem = readPrivateKeyPem();
  const key = createPrivateKey(pem);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: nowSec - 60, exp: nowSec + 10 * 60, iss: config.GITHUB_APP_ID }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(key, "base64url");
  return `${header}.${payload}.${signature}`;
}

export interface InstallationToken {
  token: string;
  expiresAt: string;
}

async function githubFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "devhub-github-app",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

export async function createInstallationToken(installationId: number): Promise<InstallationToken> {
  const jwt = createAppJwt();
  const { status, json } = await githubFetch(
    `/app/installations/${installationId}/access_tokens`,
    jwt,
    { method: "POST" },
  );
  if (status !== 201) {
    throw new Error(`GitHub installation token failed: HTTP ${status}`);
  }
  const body = json as { token?: string; expires_at?: string };
  if (!body?.token || !body?.expires_at) throw new Error("GitHub installation token malformed");
  return { token: body.token, expiresAt: body.expires_at };
}

export interface InstallationInfo {
  accountLogin: string;
  accountType: string;
}

export async function getInstallationInfo(installationId: number): Promise<InstallationInfo> {
  const jwt = createAppJwt();
  const { status, json } = await githubFetch(`/app/installations/${installationId}`, jwt);
  if (status !== 200) throw new Error(`GitHub installation lookup failed: HTTP ${status}`);
  const body = json as { account?: { login?: string; type?: string } };
  return {
    accountLogin: body?.account?.login ?? "",
    accountType: body?.account?.type ?? "",
  };
}

export interface InstallationRepoItem {
  owner: string;
  repo: string;
  fullName: string;
  isPrivate: boolean;
}

export async function listInstallationRepos(installationToken: string): Promise<InstallationRepoItem[]> {
  const out: InstallationRepoItem[] = [];
  let page = 1;
  for (;;) {
    const { status, json } = await githubFetch(
      `/installation/repositories?per_page=100&page=${page}`,
      installationToken,
    );
    if (status !== 200) throw new Error(`GitHub installation repos failed: HTTP ${status}`);
    const body = json as { repositories?: Array<{ name?: string; full_name?: string; private?: boolean; owner?: { login?: string } }> };
    const repos = body?.repositories ?? [];
    for (const r of repos) {
      if (!r?.name || !r?.owner?.login) continue;
      out.push({
        owner: r.owner.login,
        repo: r.name,
        fullName: r.full_name ?? `${r.owner.login}/${r.name}`,
        isPrivate: r.private ?? false,
      });
    }
    if (repos.length < 100) break;
    page += 1;
    if (page > 10) break;
  }
  return out;
}

export interface RepoIssueItem {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  url: string;
  closedAt: string | null;
  isPullRequest: boolean;
}

/** List issues (termasuk PR — ditandai isPullRequest agar bisa di-skip importer). Max 3 halaman. */
export async function listRepoIssues(
  installationToken: string,
  owner: string,
  repo: string,
): Promise<RepoIssueItem[]> {
  const out: RepoIssueItem[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const { status, json } = await githubFetch(
      `/repos/${owner}/${repo}/issues?state=all&per_page=100&page=${page}`,
      installationToken,
    );
    if (status !== 200) throw new Error(`GitHub issues list failed: HTTP ${status}`);
    const items = (json as Array<{
      number?: number;
      title?: string;
      body?: string | null;
      state?: string;
      labels?: Array<string | { name?: string }>;
      html_url?: string;
      closed_at?: string | null;
      pull_request?: unknown;
    }>) ?? [];
    for (const item of items) {
      if (typeof item?.number !== "number") continue;
      out.push({
        number: item.number,
        title: typeof item.title === "string" ? item.title : `#${item.number}`,
        body: typeof item.body === "string" ? item.body : "",
        state: typeof item.state === "string" ? item.state : "open",
        labels: (item.labels ?? [])
          .map((l) => (typeof l === "string" ? l : l?.name ?? "").slice(0, 50))
          .filter(Boolean)
          .slice(0, 5),
        url: typeof item.html_url === "string" ? item.html_url : "",
        closedAt: typeof item.closed_at === "string" ? item.closed_at : null,
        isPullRequest: item.pull_request !== undefined && item.pull_request !== null,
      });
    }
    if (items.length < 100) break;
  }
  return out;
}

export async function postIssueComment(
  installationToken: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const { status } = await githubFetch(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    installationToken,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) },
  );
  if (status !== 201) throw new Error(`GitHub comment failed: HTTP ${status}`);
}
