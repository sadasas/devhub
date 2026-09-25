/**
 * Link service GitHub (application, ADR-041): resolusi task dari magic words
 * + penempelan link via mutateProject (transaksional + activity + broadcast WS).
 * Tanpa express — dipanggil webhook-service. Komentar linkback + automation
 * menyusul di F4; F3 fokus link e2e (push + pull_request).
 */

import { ApiError } from "../../../../shared/errors.js";
import { newId, nowIso } from "../../../../shared/ids.js";
import { pool } from "../../../../db/pool.js";
import {
  LIMITS,
  stateSchema,
  type GitHubLink,
  type State,
  type Task,
} from "../../../projects/domain/state.js";
import { mutateProject } from "../../../projects/application/entityService.js";
import { broadcastDiff } from "../../../realtime/infrastructure/broadcast.js";
import { extractTaskKeys } from "../domain/github.js";
import {
  buildIssueFromGithubIssue,
  findIssueByProvenance,
  type GithubIssueSource,
} from "./import-service.js";

const WRITE_ROLES = new Set(["owner", "admin", "editor"]);

/** Snapshot state read-only (tanpa lock) untuk resolusi magic words pre-mutasi. */
async function loadStateSnapshot(projectId: string): Promise<State> {
  const res = await pool.query<{ data: unknown }>(`SELECT data FROM projects WHERE id = $1`, [projectId]);
  if (res.rows.length === 0) throw new ApiError(404, "NOT_FOUND", "Project not found");
  const parsed = stateSchema.safeParse(res.rows[0]?.data);
  if (!parsed.success) throw new ApiError(500, "INTERNAL", "Stored state is invalid");
  return parsed.data;
}

/**
 * Aktor mutasi webhook: webhook GitHub tanpa sesi user, jadi mutasi
 * diatribusikan ke penghubung (connected_by) bila masih member berhak-tulis;
 * fallback ke owner/admin/editor pertama tim. Error bila tidak ada —
 * caller meng-enqueue ke outbox untuk retry (member bisa bergabung lagi).
 */
export async function resolveWebhookActor(projectId: string): Promise<string> {
  const res = await pool.query<{ user_id: string; role: string; connected_by: string | null }>(
    `SELECT tm.user_id, tm.role, g.connected_by
     FROM projects p
     JOIN team_members tm ON tm.team_id = p.team_id
     LEFT JOIN github_project_repos g ON g.project_id = p.id
     WHERE p.id = $1`,
    [projectId],
  );
  const rows = res.rows;
  if (rows.length === 0) throw new ApiError(404, "NOT_FOUND", "Project not found");
  const connectedBy = rows[0]?.connected_by ?? null;
  if (connectedBy) {
    const still = rows.find((r) => r.user_id === connectedBy && WRITE_ROLES.has(r.role));
    if (still) return connectedBy;
  }
  const rank = (role: string) => (role === "owner" ? 0 : role === "admin" ? 1 : role === "editor" ? 2 : 9);
  const fallback = [...rows].filter((r) => WRITE_ROLES.has(r.role)).sort((a, b) => rank(a.role) - rank(b.role))[0];
  if (!fallback) {
    const err = new ApiError(409, "GITHUB_NO_ACTOR", "No team writer available for webhook mutation");
    throw err;
  }
  return fallback.user_id;
}

/** Resolusi kandidat magic words -> id task: uuid exact, short/dev = prefix id. */
export function resolveTaskIds(state: State, text: string): string[] {
  const candidates = extractTaskKeys(text);
  if (candidates.length === 0) return [];
  const out: string[] = [];
  for (const c of candidates) {
    if (c.kind === "uuid") {
      if (state.tasks.some((t) => t.id === c.value)) out.push(c.value);
      continue;
    }
    const hit = state.tasks.find((t) => t.id.replace(/-/g, "").toLowerCase().startsWith(c.value));
    if (hit && !out.includes(hit.id)) out.push(hit.id);
  }
  return out;
}

export interface LinkInput {
  repo: string;
  kind: GitHubLink["kind"];
  ref: string;
  url?: string;
  title?: string;
  status: GitHubLink["status"];
}

function buildLink(input: LinkInput): GitHubLink {
  return {
    id: newId(),
    repo: input.repo,
    kind: input.kind,
    ref: input.ref,
    url: input.url ?? "",
    title: (input.title ?? "").slice(0, LIMITS.GITHUB_LINK_TITLE),
    status: input.status,
    lastSyncedAt: nowIso(),
    linkedBy: null,
    linkedAt: nowIso(),
  };
}

/**
 * Tempel link ke task (dedupe repo+kind+ref, hormati cap). Update status bila
 * link sejenis sudah ada (mis. PR open -> merged). Mengembalikan true bila
 * ada perubahan (untuk skip activity no-op).
 */
export function attachLinkToTask(task: Task, input: LinkInput): boolean {
  const links = task.githubLinks ?? [];
  const existing = links.find((l) => l.repo === input.repo && l.kind === input.kind && l.ref === input.ref);
  if (existing) {
    if (existing.status === input.status && existing.title === (input.title ?? existing.title)) return false;
    existing.status = input.status;
    if (input.title) existing.title = input.title.slice(0, LIMITS.GITHUB_LINK_TITLE);
    if (input.url) existing.url = input.url;
    existing.lastSyncedAt = nowIso();
    task.updatedAt = nowIso();
    return true;
  }
  if (links.length >= LIMITS.GITHUB_LINKS_PER_TASK) return false;
  links.push(buildLink(input));
  task.githubLinks = links;
  task.updatedAt = nowIso();
  return true;
}

export interface AttachResult {
  taskId: string;
  changed: boolean;
}

/** Tempel 1 link ke banyak task — 1 txn + 1 activity row + 1 WS diff per task. */
export async function attachLinkToTasks(
  projectId: string,
  actorId: string,
  taskIds: string[],
  input: LinkInput,
): Promise<AttachResult[]> {
  return applyLinksToProject(
    projectId,
    actorId,
    taskIds.map((taskId) => ({ taskId, link: input })),
  ).then(({ linked }) => taskIds.map((taskId) => ({ taskId, changed: linked.includes(taskId) })));
}

export interface ResolvedLink {
  taskId: string;
  link: LinkInput;
}

/**
 * Tempel banyak link dalam 1 txn + 1 activity row ringkas per event
 * (anti-spam timeline: "linked PR #123 to 2 tasks", bukan 1 row per push).
 * `created` = task yang link-nya BARU dibuat event ini (untuk linkback comment).
 */
export async function applyLinksToProject(
  projectId: string,
  actorId: string,
  items: ResolvedLink[],
): Promise<{ linked: string[]; created: string[]; version: number }> {
  if (items.length === 0) return { linked: [], created: [], version: 0 };
  const linked: string[] = [];
  const created: string[] = [];
  const afters: Task[] = [];
  let draft: { taskId: string; link: LinkInput; before: Task } | undefined;
  const { version } = await mutateProject(actorId, projectId, undefined, (state) => {
    for (const { taskId, link } of items) {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) continue;
      const before = { ...task, githubLinks: [...(task.githubLinks ?? [])] };
      const isNew = !(task.githubLinks ?? []).some(
        (l) => l.repo === link.repo && l.kind === link.kind && l.ref === link.ref,
      );
      // Dedupe per identitas link (repo+kind+ref) di attachLinkToTask —
      // task yang sama boleh menerima banyak link berbeda.
      if (!attachLinkToTask(task, link)) continue;
      if (!linked.includes(taskId)) linked.push(taskId);
      if (isNew && !created.includes(taskId)) created.push(taskId);
      draft ??= { taskId, link, before };
      afters.push({ ...task, githubLinks: [...(task.githubLinks ?? [])] });
    }
    if (!draft) return;
    return {
      entity: "tasks",
      entityId: draft.taskId,
      action: "updated",
      summary: `GitHub: linked ${draft.link.kind} ${draft.link.repo}#${draft.link.ref} to ${linked.length} task(s)`,
      before: draft.before as unknown as Record<string, unknown>,
      after: { ...afters[0] } as unknown as Record<string, unknown>,
    };
  });
  if (linked.length > 0) {
    broadcastDiff(projectId, {
      type: "state:diff",
      projectId,
      version,
      ops: afters.map((after) => ({ entity: "tasks", id: after.id, op: "updated", after })),
    });
  }
  return { linked, created, version };
}

export interface PushCommitInput {
  sha: string;
  message: string;
  url: string;
}

/**
 * Event push: magic words dari tiap commit message + nama branch diresolusi
 * ke task; ditempel link commit (+ link branch sekali). 1 txn per project.
 */
export async function applyPushEvent(input: {
  projectId: string;
  actorId: string;
  owner: string;
  repo: string;
  branch: string;
  branchUrl: string;
  commits: PushCommitInput[];
}): Promise<string[]> {
  const repo = `${input.owner}/${input.repo}`;
  const state = await loadStateSnapshot(input.projectId);
  const items: ResolvedLink[] = [];
  for (const taskId of resolveTaskIds(state, input.branch)) {
    items.push({
      taskId,
      link: { repo, kind: "branch", ref: input.branch, url: input.branchUrl, title: "", status: "unknown" },
    });
  }
  for (const commit of input.commits) {
    const ids = resolveTaskIds(state, `${commit.message} ${input.branch}`);
    for (const taskId of ids) {
      items.push({
        taskId,
        link: {
          repo,
          kind: "commit",
          ref: commit.sha,
          url: commit.url,
          title: (commit.message.split("\n")[0] ?? "").slice(0, LIMITS.GITHUB_LINK_TITLE),
          status: "unknown",
        },
      });
    }
  }
  if (items.length === 0) return [];
  const { linked } = await applyLinksToProject(input.projectId, input.actorId, items);
  return linked;
}

export interface PullRequestInput {
  number: number;
  title: string;
  body: string;
  headBranch: string;
  url: string;
  draft: boolean;
  merged: boolean;
  state: string;
}

/**
 * Event pull_request (opened/synchronize/reopened/closed): magic words dari
 * title + body + head branch diresolusi; ditempel/diupdate link PR.
 * Automation (locked: default suggest = no-op backend; banner di UI F5):
 * - mode 'auto': opened/reopened memindahkan todo -> inProgress,
 *   merged memindahkan -> done (+completedAt, mirror deriveTaskPatch).
 * - mode 'suggest'/'off': tanpa perubahan status.
 */
export async function applyPullRequestEvent(input: {
  projectId: string;
  actorId: string;
  owner: string;
  repo: string;
  automation?: { onPrOpened: string; onPrMerged: string };
  pr: PullRequestInput;
}): Promise<{ linked: string[]; created: string[] }> {
  const repo = `${input.owner}/${input.repo}`;
  const state = await loadStateSnapshot(input.projectId);
  const ids = resolveTaskIds(state, `${input.pr.title}\n${input.pr.body}\n${input.pr.headBranch}`);
  if (ids.length === 0) return { linked: [], created: [] };
  const status = input.pr.merged
    ? "merged"
    : input.pr.state === "closed"
      ? "closed"
      : input.pr.draft
        ? "draft"
        : "open";
  const { linked, created } = await applyLinksToProject(
    input.projectId,
    input.actorId,
    ids.map((taskId) => ({
      taskId,
      link: {
        repo,
        kind: "pr",
        ref: String(input.pr.number),
        url: input.pr.url,
        title: input.pr.title.slice(0, LIMITS.GITHUB_LINK_TITLE),
        status,
      },
    })),
  );
  const automation = input.automation ?? { onPrOpened: "suggest", onPrMerged: "suggest" };
  if (linked.length > 0) {
    if (!input.pr.merged && automation.onPrOpened === "auto") {
      await moveLinkedTasks(input.projectId, input.actorId, linked, "inProgress");
    }
    if (input.pr.merged && automation.onPrMerged === "auto") {
      await moveLinkedTasks(input.projectId, input.actorId, linked, "done");
    }
  }
  return { linked, created };
}

/**
 * Pindahkan status task ter-link (mode automation 'auto' saja).
 * Aturan completedAt mirror deriveTaskPatch (entities.ts):
 * -> done tanpa completedAt => nowIso(); keluar done => null.
 */
export async function moveLinkedTasks(
  projectId: string,
  actorId: string,
  taskIds: string[],
  to: "inProgress" | "done",
): Promise<string[]> {
  const moved: string[] = [];
  const afters: Task[] = [];
  let draft: { taskId: string; before: Task } | undefined;
  const { version } = await mutateProject(actorId, projectId, undefined, (state) => {
    for (const taskId of taskIds) {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) continue;
      if (to === "inProgress" && task.status !== "todo") continue;
      if (to === "done" && task.status === "done") continue;
      const before = { ...task, githubLinks: [...(task.githubLinks ?? [])] };
      task.status = to;
      if (to === "done") {
        if (task.completedAt == null) task.completedAt = nowIso();
      } else if (task.completedAt != null) {
        task.completedAt = null;
      }
      task.updatedAt = nowIso();
      moved.push(taskId);
      draft ??= { taskId, before };
      afters.push({ ...task, githubLinks: [...(task.githubLinks ?? [])] });
    }
    if (!draft) return;
    return {
      entity: "tasks",
      entityId: draft.taskId,
      action: "updated",
      summary: `GitHub automation: moved ${moved.length} task(s) to ${to}`,
      before: draft.before as unknown as Record<string, unknown>,
      after: { ...afters[0] } as unknown as Record<string, unknown>,
    };
  });
  if (moved.length > 0) {
    broadcastDiff(projectId, {
      type: "state:diff",
      projectId,
      version,
      ops: afters.map((after) => ({ entity: "tasks", id: after.id, op: "updated", after })),
    });
  }
  return moved;
}

/**
 * Update meta PR (ci/review) pada link PR yang cocok (repo + number).
 * Dipakai event pull_request_review + check_run/check_suite.
 */
export async function setPrMeta(
  projectId: string,
  actorId: string,
  input: {
    repo: string;
    prNumber: number;
    ciState?: "pass" | "fail" | "pending";
    reviewState?: "approved" | "changes_requested";
  },
): Promise<string[]> {
  const touched: string[] = [];
  const afters: Task[] = [];
  let draft: { taskId: string; before: Task } | undefined;
  const { version } = await mutateProject(actorId, projectId, undefined, (state) => {
    for (const task of state.tasks) {
      const link = (task.githubLinks ?? []).find(
        (l) => l.kind === "pr" && l.repo === input.repo && l.ref === String(input.prNumber),
      );
      if (!link) continue;
      const before = { ...task, githubLinks: [...(task.githubLinks ?? [])] };
      let changed = false;
      if (input.ciState !== undefined && link.ciState !== input.ciState) {
        link.ciState = input.ciState;
        changed = true;
      }
      if (input.reviewState !== undefined && link.reviewState !== input.reviewState) {
        link.reviewState = input.reviewState;
        changed = true;
      }
      if (!changed) continue;
      link.lastSyncedAt = nowIso();
      task.updatedAt = nowIso();
      touched.push(task.id);
      draft ??= { taskId: task.id, before };
      afters.push({ ...task, githubLinks: [...(task.githubLinks ?? [])] });
    }
    if (!draft) return;
    return {
      entity: "tasks",
      entityId: draft.taskId,
      action: "updated",
      summary: `GitHub: updated PR #${input.prNumber} checks/review`,
      before: draft.before as unknown as Record<string, unknown>,
      after: { ...afters[0] } as unknown as Record<string, unknown>,
    };
  });
  if (touched.length > 0) {
    broadcastDiff(projectId, {
      type: "state:diff",
      projectId,
      version,
      ops: afters.map((after) => ({ entity: "tasks", id: after.id, op: "updated", after })),
    });
  }
  return touched;
}

export interface ReviewInput {
  prNumber: number;
  prTitle: string;
  prBody: string;
  prHeadBranch: string;
  prUrl: string;
  /** approved | changes_requested | commented | dismissed */
  reviewState: string;
}

/**
 * Event pull_request_review.submitted: resolusi task via PR (seperti PR event)
 * + catat reviewState. 'commented'/'dismissed' tidak mengubah reviewState.
 */
export async function applyReviewEvent(input: {
  projectId: string;
  actorId: string;
  owner: string;
  repo: string;
  review: ReviewInput;
}): Promise<string[]> {
  const repo = `${input.owner}/${input.repo}`;
  const state = await loadStateSnapshot(input.projectId);
  const ids = resolveTaskIds(
    state,
    `${input.review.prTitle}\n${input.review.prBody}\n${input.review.prHeadBranch}`,
  );
  if (ids.length === 0) return [];
  const reviewState =
    input.review.reviewState === "approved"
      ? "approved"
      : input.review.reviewState === "changes_requested"
        ? "changes_requested"
        : undefined;
  // Pastikan link PR ada (review bisa datang sebelum event PR diproses).
  const { linked } = await applyLinksToProject(
    input.projectId,
    input.actorId,
    ids.map((taskId) => ({
      taskId,
      link: {
        repo,
        kind: "pr",
        ref: String(input.review.prNumber),
        url: input.review.prUrl,
        title: input.review.prTitle.slice(0, LIMITS.GITHUB_LINK_TITLE),
        status: "open" as const,
      },
    })),
  );
  if (reviewState) {
    await setPrMeta(input.projectId, input.actorId, {
      repo,
      prNumber: input.review.prNumber,
      reviewState,
    });
  }
  return linked;
}

export interface CheckInput {
  sha: string;
  conclusion: string | null;
  status: string;
  prNumbers: number[];
}

/**
 * Event check_run/check_suite.completed: conclusion -> ciState pada link PR
 * (via nomor PR dari suite) dan link commit (via sha).
 */
export async function applyCheckEvent(input: {
  projectId: string;
  actorId: string;
  owner: string;
  repo: string;
  check: CheckInput;
}): Promise<string[]> {
  if (input.check.status !== "completed") return [];
  const ciState =
    input.check.conclusion === "success"
      ? "pass"
      : input.check.conclusion === "failure" || input.check.conclusion === "timed_out" || input.check.conclusion === "cancelled"
        ? "fail"
        : undefined;
  if (!ciState) return [];
  const touched = new Set<string>();
  for (const prNumber of input.check.prNumbers) {
    const ids = await setPrMeta(input.projectId, input.actorId, {
      repo: `${input.owner}/${input.repo}`,
      prNumber,
      ciState,
    });
    for (const id of ids) touched.add(id);
  }
  // Link commit dengan sha yang sama ikut ditandai (jejak CI per commit).
  const { version } = await mutateProject(input.actorId, input.projectId, undefined, (state) => {
    let first: { taskId: string; before: Task } | undefined;
    const afters: Task[] = [];
    for (const task of state.tasks) {
      const link = (task.githubLinks ?? []).find(
        (l) => l.kind === "commit" && l.repo === `${input.owner}/${input.repo}` && l.ref === input.check.sha,
      );
      if (!link || link.ciState === ciState) continue;
      const before = { ...task, githubLinks: [...(task.githubLinks ?? [])] };
      link.ciState = ciState;
      link.lastSyncedAt = nowIso();
      task.updatedAt = nowIso();
      touched.add(task.id);
      first ??= { taskId: task.id, before };
      afters.push({ ...task, githubLinks: [...(task.githubLinks ?? [])] });
    }
    if (!first) return;
    return {
      entity: "tasks",
      entityId: first.taskId,
      action: "updated",
      summary: `GitHub: CI ${ciState} for commit ${input.check.sha.slice(0, 7)}`,
      before: first.before as unknown as Record<string, unknown>,
      after: { ...afters[0] } as unknown as Record<string, unknown>,
    };
  });
  void version;
  return [...touched];
}

export interface IssueEventInput extends GithubIssueSource {}

/**
 * Filter label auto-issue: filter kosong = semua label lolos; terisi = issue
 * harus punya minimal 1 label yang cocok (case-insensitive, trim).
 */
export function matchesIssueLabels(filter: string[], labels: string[]): boolean {
  if (filter.length === 0) return true;
  const have = new Set(labels.map((l) => l.toLowerCase().trim()).filter(Boolean));
  return filter.some((f) => have.has(f.toLowerCase().trim()));
}

/**
 * Event issues (opened/closed) — auto-issue opsi A, target DevHub issue saja.
 * - opened + mode 'auto' + label cocok: buat issue (idempoten via provenance
 *   githubIssue); sudah ada -> laporkan sebagai linked (tanpa tulis ulang).
 * - closed + mode 'auto': issue berprovenance yang belum resolved -> resolved.
 *   Issue tanpa provenance (buatan manual) TIDAK disentuh.
 * - mode 'suggest'/'off': tanpa perubahan (import manual tetap tersedia).
 */
export async function applyIssueEvent(input: {
  projectId: string;
  actorId: string;
  owner: string;
  repo: string;
  automation?: { onIssueOpened: string; issueLabels: string[] };
  issue: IssueEventInput;
}): Promise<{ linked: string[]; created: string[] }> {
  const automation = input.automation ?? { onIssueOpened: "suggest", issueLabels: [] as string[] };
  if (automation.onIssueOpened !== "auto") return { linked: [], created: [] };
  const existing = await loadStateSnapshot(input.projectId).then(
    (state) => findIssueByProvenance(state, input.owner, input.repo, input.issue.number),
    () => undefined,
  );
  if (input.issue.state !== "closed") {
    if (!matchesIssueLabels(automation.issueLabels, input.issue.labels)) return { linked: [], created: [] };
    if (existing) return { linked: [existing.id], created: [] };
    const now = nowIso();
    const built = buildIssueFromGithubIssue(input.issue, input.owner, input.repo, now);
    let pushed = false;
    const { version } = await mutateProject(input.actorId, input.projectId, undefined, (state) => {
      if (findIssueByProvenance(state, input.owner, input.repo, input.issue.number)) return;
      state.issues.push(built);
      pushed = true;
      return {
        entity: "issues",
        entityId: built.id,
        action: "created",
        summary: `GitHub: auto-created issue from ${input.owner}/${input.repo}#${input.issue.number}`,
      };
    });
    const current =
      (await loadStateSnapshot(input.projectId).then(
        (state) => findIssueByProvenance(state, input.owner, input.repo, input.issue.number),
        () => undefined,
      )) ?? built;
    if (pushed) {
      broadcastDiff(input.projectId, {
        type: "state:diff",
        projectId: input.projectId,
        version,
        ops: [{ entity: "issues", id: current.id, op: "created" as const }],
      });
    }
    return { linked: [current.id], created: pushed ? [current.id] : [] };
  }
  if (!existing || existing.status === "resolved") return { linked: existing ? [existing.id] : [], created: [] };
  const before = { ...existing };
  const { version } = await mutateProject(input.actorId, input.projectId, undefined, (state) => {
    const target = findIssueByProvenance(state, input.owner, input.repo, input.issue.number);
    if (!target || target.status === "resolved") return;
    target.status = "resolved";
    target.updatedAt = nowIso();
    return {
      entity: "issues",
      entityId: target.id,
      action: "updated",
      summary: `GitHub: resolved issue from ${input.owner}/${input.repo}#${input.issue.number}`,
      before: before as unknown as Record<string, unknown>,
      after: { ...target } as unknown as Record<string, unknown>,
    };
  });
  broadcastDiff(input.projectId, {
    type: "state:diff",
    projectId: input.projectId,
    version,
    ops: [{ entity: "issues", id: existing.id, op: "updated" as const }],
  });
  return { linked: [existing.id], created: [] };
}
