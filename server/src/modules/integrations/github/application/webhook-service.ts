/**
 * Webhook service GitHub (application, ADR-041): verifikasi HMAC + dedupe
 * delivery + routing event + linkback comment + drain outbox.
 * Tanpa express — dipanggil webhook routes.
 *
 * Kebijakan respons: transport error -> throw (4xx); apply per-project gagal
 * -> enqueue outbox (envelope event penuh) + tetap 200 (GitHub retry delivery
 * sama akan ter-dedupe, jadi retry dijamin via outbox + drain).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../../../../shared/errors.js";
import { config } from "../../../../config.js";
import {
  computeNextRetry,
  deleteOutbox,
  enqueueOutbox,
  findProjectsByRepo,
  insertWebhookDelivery,
  listDueOutbox,
  markInstallationStatus,
  markOutboxForRetry,
  upsertInstallation,
  type GithubOutboxOp,
  type GithubProjectRepo,
} from "../infrastructure/github-repository.js";
import { ensureInstallationToken } from "./install-service.js";
import { postIssueComment } from "../infrastructure/github-app.js";
import {
  applyCheckEvent,
  applyPullRequestEvent,
  applyPushEvent,
  applyReviewEvent,
  resolveWebhookActor,
} from "./link-service.js";

export function verifyWebhookSignature(raw: Buffer, signatureHeader: string | undefined): void {
  const secret = config.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, "GITHUB_NOT_CONFIGURED", "GitHub webhook secret is not configured");
  if (!signatureHeader?.startsWith("sha256=")) {
    throw new ApiError(401, "GITHUB_BAD_SIGNATURE", "Missing webhook signature");
  }
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError(401, "GITHUB_BAD_SIGNATURE", "Invalid webhook signature");
  }
}

export interface WebhookResult {
  status: "pong" | "processed" | "ignored" | "deduped";
  detail?: string;
  projects?: Array<{ projectId: string; linked: string[]; error?: string }>;
}

interface RepoRef {
  owner: string;
  repo: string;
}

function repoOf(payload: unknown): RepoRef | null {
  const repo = (payload as { repository?: { name?: string; owner?: { login?: string } } })?.repository;
  if (!repo?.name || !repo?.owner?.login) return null;
  return { owner: repo.owner.login, repo: repo.name };
}

async function applyToMappedProjects(
  repo: RepoRef,
  event: string,
  payload: unknown,
  apply: (mapping: GithubProjectRepo, actorId: string) => Promise<string[]>,
  op: GithubOutboxOp,
): Promise<WebhookResult> {
  const mappings = await findProjectsByRepo(repo.owner, repo.repo);
  if (mappings.length === 0) return { status: "ignored", detail: "no-mapping" };
  const projects: Array<{ projectId: string; linked: string[]; error?: string }> = [];
  for (const mapping of mappings) {
    try {
      const actorId = await resolveWebhookActor(mapping.projectId);
      const linked = await apply(mapping, actorId);
      projects.push({ projectId: mapping.projectId, linked });
    } catch (err) {
      const message = err instanceof Error ? err.message : "apply failed";
      await enqueueOutbox({
        projectId: mapping.projectId,
        taskId: null,
        op,
        payload: { event, payload, error: message },
      }).catch(() => {});
      projects.push({ projectId: mapping.projectId, linked: [], error: message });
    }
  }
  return { status: "processed", projects };
}

/** Komentar linkback 1x per (PR, task baru): "Linked to DevHub task ...". Gagal -> outbox. */
async function postLinkbackComments(
  mapping: GithubProjectRepo,
  repo: RepoRef,
  prNumber: number,
  prUrl: string,
  created: string[],
  taskTitles: Map<string, string>,
): Promise<void> {
  if (created.length === 0) return;
  let token: string;
  try {
    token = await ensureInstallationToken(mapping.installationId);
  } catch {
    return; // App belum dikonfigurasi (mis. test) — skip diam-diam, link tetap ada.
  }
  const lines = created.map((id) => {
    const title = taskTitles.get(id) ?? "task";
    const short = id.replace(/-/g, "").slice(0, 8).toUpperCase();
    return `- ${title} (DEV-${short}, ${prUrl})`;
  });
  const body = `🔗 Linked to DevHub task(s):\n${lines.join("\n")}`;
  try {
    await postIssueComment(token, repo.owner, repo.repo, prNumber, body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "comment failed";
    await enqueueOutbox({
      projectId: mapping.projectId,
      taskId: null,
      op: "comment",
      payload: {
        installationId: mapping.installationId,
        owner: repo.owner,
        repo: repo.repo,
        number: prNumber,
        body,
        error: message,
      },
    }).catch(() => {});
  }
}

/**
 * Dispatch murni event -> apply (tanpa verify/dedupe) — dipakai handleWebhook
 * dan drainOutbox (retry envelope tersimpan).
 */
export async function dispatchEvent(event: string, payload: unknown): Promise<WebhookResult> {
  const p = payload as Record<string, unknown>;

  if (event === "ping") return { status: "pong" };

  if (event === "installation") {
    const inst = p.installation as { id?: number; account?: { login?: string; type?: string } } | undefined;
    if (typeof inst?.id !== "number") return { status: "ignored", detail: "no-installation" };
    if (p.action === "deleted") {
      await markInstallationStatus(inst.id, "removed", "App uninstalled on GitHub");
    } else if (p.action === "suspend") {
      await markInstallationStatus(inst.id, "suspended", "App suspended on GitHub");
    } else {
      await upsertInstallation({
        installationId: inst.id,
        accountLogin: inst.account?.login ?? "",
        accountType: inst.account?.type ?? "",
      });
    }
    return { status: "processed" };
  }

  if (event === "installation_repositories") {
    // Picker repo on-demand (GET /installations/:id/repos) — tidak ada state.
    return { status: "ignored", detail: "repos-picker-on-demand" };
  }

  if (event === "push") {
    const repo = repoOf(payload);
    if (!repo) return { status: "ignored", detail: "no-repo" };
    const ref = typeof p.ref === "string" ? p.ref : "";
    const branch = ref.replace(/^refs\/heads\//, "") || "unknown";
    const commits = (Array.isArray(p.commits) ? p.commits : []) as Array<{
      id?: string;
      message?: string;
      url?: string;
    }>;
    return applyToMappedProjects(
      repo,
      event,
      payload,
      (mapping, actorId) =>
        applyPushEvent({
          projectId: mapping.projectId,
          actorId,
          owner: repo.owner,
          repo: repo.repo,
          branch,
          branchUrl: `https://github.com/${repo.owner}/${repo.repo}/tree/${branch}`,
          commits: commits.map((c) => ({
            sha: typeof c.id === "string" ? c.id : "",
            message: typeof c.message === "string" ? c.message : "",
            url: typeof c.url === "string" ? c.url : "",
          })),
        }),
      "link",
    );
  }

  if (event === "pull_request") {
    const repo = repoOf(payload);
    if (!repo) return { status: "ignored", detail: "no-repo" };
    const pr = p.pull_request as
      | {
          number?: number;
          title?: string;
          body?: string | null;
          html_url?: string;
          draft?: boolean;
          merged?: boolean;
          state?: string;
          head?: { ref?: string };
        }
      | undefined;
    if (typeof pr?.number !== "number") return { status: "ignored", detail: "no-pr" };
    if (p.action !== "opened" && p.action !== "synchronize" && p.action !== "reopened" && p.action !== "closed") {
      return { status: "ignored", detail: `action-${String(p.action)}` };
    }
    const prInput = {
      number: pr.number,
      title: typeof pr.title === "string" ? pr.title : "",
      body: typeof pr.body === "string" ? pr.body : "",
      headBranch: pr.head?.ref ?? "",
      url: typeof pr.html_url === "string" ? pr.html_url : "",
      draft: pr.draft === true,
      merged: pr.merged === true,
      state: typeof pr.state === "string" ? pr.state : "open",
    };
    const result = await applyToMappedProjects(
      repo,
      event,
      payload,
      async (mapping, actorId) => {
        const { linked, created } = await applyPullRequestEvent({
          projectId: mapping.projectId,
          actorId,
          owner: repo.owner,
          repo: repo.repo,
          automation: mapping.automation,
          pr: prInput,
        });
        if (p.action === "opened" && created.length > 0) {
          const titles = new Map<string, string>();
          for (const id of created) titles.set(id, prInput.title);
          await postLinkbackComments(mapping, repo, prInput.number, prInput.url, created, titles);
        }
        return linked;
      },
      "link",
    );
    return result;
  }

  if (event === "pull_request_review") {
    if (p.action !== "submitted") return { status: "ignored", detail: `action-${String(p.action)}` };
    const repo = repoOf(payload);
    if (!repo) return { status: "ignored", detail: "no-repo" };
    const review = p.review as { state?: string } | undefined;
    const pr = p.pull_request as
      | { number?: number; title?: string; body?: string | null; html_url?: string; head?: { ref?: string } }
      | undefined;
    if (typeof pr?.number !== "number") return { status: "ignored", detail: "no-pr" };
    return applyToMappedProjects(
      repo,
      event,
      payload,
      (mapping, actorId) =>
        applyReviewEvent({
          projectId: mapping.projectId,
          actorId,
          owner: repo.owner,
          repo: repo.repo,
          review: {
            prNumber: pr.number as number,
            prTitle: typeof pr.title === "string" ? pr.title : "",
            prBody: typeof pr.body === "string" ? pr.body : "",
            prHeadBranch: pr.head?.ref ?? "",
            prUrl: typeof pr.html_url === "string" ? pr.html_url : "",
            reviewState: typeof review?.state === "string" ? review.state : "",
          },
        }),
      "status",
    );
  }

  if (event === "check_run" || event === "check_suite") {
    const repo = repoOf(payload);
    if (!repo) return { status: "ignored", detail: "no-repo" };
    const node = (event === "check_run" ? p.check_run : p.check_suite) as
      | {
          status?: string;
          conclusion?: string | null;
          head_sha?: string;
          pull_requests?: Array<{ number?: number }>;
        }
      | undefined;
    if (!node || node.status !== "completed") return { status: "ignored", detail: "not-completed" };
    const prNumbers = (node.pull_requests ?? [])
      .map((r) => r.number)
      .filter((n): n is number => typeof n === "number");
    if (prNumbers.length === 0 && typeof node.head_sha !== "string") {
      return { status: "ignored", detail: "no-target" };
    }
    return applyToMappedProjects(
      repo,
      event,
      payload,
      (mapping, actorId) =>
        applyCheckEvent({
          projectId: mapping.projectId,
          actorId,
          owner: repo.owner,
          repo: repo.repo,
          check: {
            sha: typeof node.head_sha === "string" ? node.head_sha : "",
            conclusion: typeof node.conclusion === "string" ? node.conclusion : null,
            status: "completed",
            prNumbers,
          },
        }),
      "status",
    );
  }

  return { status: "ignored", detail: `event-${event}` };
}

export async function handleWebhook(input: {
  event: string;
  deliveryId: string;
  raw: Buffer;
  signature: string | undefined;
}): Promise<WebhookResult> {
  verifyWebhookSignature(input.raw, input.signature);
  let payload: unknown;
  try {
    payload = JSON.parse(input.raw.toString("utf8") as string) as unknown;
  } catch {
    throw new ApiError(400, "GITHUB_BAD_PAYLOAD", "Invalid JSON payload");
  }
  const p = payload as Record<string, unknown>;
  const fresh = await insertWebhookDelivery({
    deliveryId: input.deliveryId,
    event: input.event,
    action: typeof p.action === "string" ? p.action : null,
    repo: repoOf(payload) ? `${repoOf(payload)?.owner}/${repoOf(payload)?.repo}` : null,
    projectId: null,
  });
  if (!fresh) return { status: "deduped" };
  return dispatchEvent(input.event, payload);
}

export interface DrainResult {
  drained: number;
  succeeded: number;
  failed: number;
  pending: number;
}

/**
 * Proses antrean outbox yang jatuh tempo untuk 1 project (tanpa worker:
 * dipicu manual via endpoint + oportunistik; lihat routes).
 */
export async function drainOutbox(projectId: string, limit = 20): Promise<DrainResult> {
  const rows = await listDueOutbox(limit * 2, new Date());
  const mine = rows.filter((r) => r.projectId === projectId).slice(0, limit);
  let succeeded = 0;
  let failed = 0;
  for (const row of mine) {
    try {
      const payload = row.payload as {
        event?: string;
        payload?: unknown;
        installationId?: number;
        owner?: string;
        repo?: string;
        number?: number;
        body?: string;
      };
      if ((row.op === "link" || row.op === "status") && payload?.event) {
        await dispatchEvent(payload.event, payload.payload);
      } else if (row.op === "comment" && payload?.body) {
        const token = await ensureInstallationToken(Number(payload.installationId));
        await postIssueComment(token, String(payload.owner), String(payload.repo), Number(payload.number), String(payload.body));
      }
      // op 'import' (F6) dan envelope tak dikenal: anggap selesai agar tidak macet.
      await deleteOutbox(row.id);
      succeeded += 1;
    } catch {
      const attempts = row.attempts + 1;
      if (attempts >= 5) {
        await deleteOutbox(row.id);
      } else {
        await markOutboxForRetry(row.id, attempts, computeNextRetry(attempts));
      }
      failed += 1;
    }
  }
  const rest = await listDueOutbox(1000, new Date());
  return { drained: mine.length, succeeded, failed, pending: rest.filter((r) => r.projectId === projectId).length };
}
