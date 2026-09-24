import { z } from "zod";

/**
 * Domain murni integrasi GitHub (ADR-041): hanya zod + parser + konstanta.
 * Tanpa express/pg/fetch/config — semua I/O di application/infrastructure.
 *
 * Bentuk link (`githubLinkSchema`) dan repo/automation tinggal di
 * modules/projects/domain/state.ts (single-source, dipakai validasi state);
 * file ini hanya validasi transport (query/body webhook) + parser teks.
 */

export const GITHUB_API_BASE = "https://api.github.com";

/** Permission minimal App (least-privilege) — didokumentasikan, bukan dienforce di kode. */
export const GITHUB_MIN_PERMISSIONS = [
  "Contents: read",
  "Issues: read & write",
  "Pull requests: read & write",
  "Checks: read",
  "Commit statuses: read",
  "Deployments: read",
] as const;

/** Query redirect Setup URL GitHub setelah install: ?installation_id=&setup_action=. */
export const githubSetupQuerySchema = z.object({
  installation_id: z.coerce.number().int().positive(),
  setup_action: z.enum(["install", "update"]).default("install"),
});

export type GitHubSetupQuery = z.infer<typeof githubSetupQuerySchema>;

/** Body connect repo: admin DevHub memetakan 1 project <-> 1 repo (keputusan per-project). */
export const githubConnectBodySchema = z.object({
  projectId: z.string().uuid(),
  installationId: z.number().int().positive(),
  owner: z.string().min(1).max(100).regex(/^[^/\s]+$/, { message: "Invalid owner" }),
  repo: z.string().min(1).max(100).regex(/^[^/\s]+$/, { message: "Invalid repo" }),
});

export type GitHubConnectBody = z.infer<typeof githubConnectBodySchema>;

/** Status koneksi per project (untuk Settings + badge). */
export const githubStatusResponseSchema = z.object({
  connected: z.boolean(),
  owner: z.string().nullable(),
  repo: z.string().nullable(),
  installationId: z.number().nullable(),
  accountLogin: z.string().nullable(),
  automation: z
    .object({
      onPrOpened: z.enum(["suggest", "auto", "off"]),
      onPrMerged: z.enum(["suggest", "auto", "off"]),
    })
    .nullable(),
});

export type GitHubStatusResponse = z.infer<typeof githubStatusResponseSchema>;

/** Daftar repo dalam 1 instalasi (untuk picker repo di Settings). */
export const githubInstallationRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  fullName: z.string(),
  isPrivate: z.boolean(),
});

export type GitHubInstallationRepo = z.infer<typeof githubInstallationRepoSchema>;

/**
 * Magic words: ekstrak kunci task DevHub dari teks bebas (branch/PR title/
 * body/commit message). Format yang didukung:
 * - UUID penuh task (`123e4567-e89b-12d3-a456-426614174000`)
 * - shortId 8-hex prefix UUID (`123e4567`) — dicocokkan prefix di application
 * - `DEV-` + 8-hex (`DEV-123e4567`, case-insensitive) — alias gaya Linear
 * Mengembalikan kandidat unik (dedupe), tanpa validasi ke state.
 */
const UUID_SOURCE = "\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b";
const DEV_KEY_SOURCE = "\\bDEV-([0-9a-f]{8})\\b";
const SHORT_HEX_SOURCE = "(^|[\\s/_\\-#([\\]])([0-9a-f]{8})(?=[\\s\\-_.)\\],:;]|$)";

export interface TaskKeyCandidate {
  /** 'uuid' = pasti unik; 'short'/'dev' = prefix 8-hex, perlu resolusi prefix. */
  kind: "uuid" | "short" | "dev";
  value: string;
}

export function extractTaskKeys(text: string): TaskKeyCandidate[] {
  if (!text) return [];
  // RegExp fresh per panggilan: pola module-level ber-flag /g menyimpan
  // lastIndex antar panggilan dan meracuni matchAll berikutnya.
  const uuidRe = new RegExp(UUID_SOURCE, "gi");
  const devRe = new RegExp(DEV_KEY_SOURCE, "gi");
  const shortRe = new RegExp(SHORT_HEX_SOURCE, "gi");
  const out: TaskKeyCandidate[] = [];
  // Dedupe per NILAI lintas kind: prefix 8-hex dari UUID/DEV yang sama pasti
  // menunjuk task yang sama, jadi kemunculan bare berikutnya di-skip.
  const seenValues = new Set<string>();
  const push = (kind: TaskKeyCandidate["kind"], value: string) => {
    const v = value.toLowerCase();
    if (seenValues.has(v)) return;
    seenValues.add(v);
    out.push({ kind, value: v });
  };
  for (const m of text.matchAll(uuidRe)) {
    push("uuid", m[0]);
    // Daftarkan prefix-nya agar short-hex di dalam UUID yang sama di-skip.
    seenValues.add(m[0].slice(0, 8).toLowerCase());
  }
  for (const m of text.matchAll(devRe)) {
    if (m.index === undefined || m[1] === undefined) continue;
    push("dev", m[1]);
  }
  for (const m of text.matchAll(shortRe)) {
    if (m.index === undefined || m[2] === undefined) continue;
    push("short", m[2]);
  }
  return out;
}

/**
 * Format nama branch dari task: `feat/<short8>-<slug>` (max 80 char).
 * Dipakai tombol "Create branch" (copy-command, tanpa write ke GitHub).
 */
export function formatBranchName(taskId: string, title: string, prefix = "feat"): string {
  const short = taskId.replace(/-/g, "").slice(0, 8).toLowerCase();
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");
  const base = `${prefix}/${short}${slug ? `-${slug}` : ""}`;
  return base.slice(0, 80);
}

/** Body PR default saat membuat PR dari task (template `Fixes <uuid>` untuk auto-link balik). */
export function formatPrBody(taskId: string, taskTitle: string): string {
  return `${taskTitle}\n\nFixes ${taskId}`;
}
