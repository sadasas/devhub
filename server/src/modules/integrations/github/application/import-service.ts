/**
 * Import service GitHub (application, ADR-041): one-time import issues repo
 * menjadi issues DevHub (target issue-only ala Linear). Idempoten via
 * provenance terstruktur `githubIssue{owner,repo,number}` (issue DevHub tak
 * punya array labels seperti task). Tanpa express — dipanggil routes.
 * Token dari caller (sudah di-resolve).
 */

import { LIMITS, type Issue, type State } from "../../../projects/domain/state.js";
import { mutateProject } from "../../../projects/application/entityService.js";
import { broadcastDiff } from "../../../realtime/infrastructure/broadcast.js";
import { newId, nowIso } from "../../../../shared/ids.js";
import { listRepoIssues, type RepoIssueItem } from "../infrastructure/github-app.js";

export interface ImportResult {
  imported: number;
  skipped: number;
  issueIds: string[];
}

/** Bentuk issue GitHub minimal yang bisa dijadikan issue DevHub. */
export interface GithubIssueSource {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  url: string;
  closedAt: string | null;
}

export function toGithubIssueSource(item: RepoIssueItem): GithubIssueSource {
  return {
    number: item.number,
    title: item.title,
    body: item.body,
    state: item.state,
    labels: item.labels,
    url: item.url,
    closedAt: item.closedAt,
  };
}

/** Cari issue DevHub dari sidik provenance GitHub (eksak, bukan scan teks). */
export function findIssueByProvenance(
  state: State,
  owner: string,
  repo: string,
  number: number,
): Issue | undefined {
  return state.issues.find(
    (i) => i.githubIssue?.owner === owner && i.githubIssue?.repo === repo && i.githubIssue?.number === number,
  );
}

/**
 * Bangun issue DevHub dari 1 issue GitHub (dipakai import manual + webhook
 * otomatis — satu sumber kebenaran). Severity selalu medium (tanpa pemetaan
 * label, keputusan sesi 2026-09-25); linkedTaskId diisi saat triase manual.
 */
export function buildIssueFromGithubIssue(
  source: GithubIssueSource,
  owner: string,
  repo: string,
  now: string,
): Issue {
  const fullName = `${owner}/${repo}`;
  const resolved = source.state === "closed";
  const footer = [
    `Imported from ${fullName}#${source.number} (${source.url})`,
    ...(source.labels.length > 0 ? [`Labels: ${source.labels.join(", ")}`] : []),
  ].join("\n");
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: source.title.slice(0, LIMITS.ISSUE_TITLE) || `#${source.number}`,
    severity: "medium",
    status: resolved ? "resolved" : "open",
    description: `${source.body.slice(0, LIMITS.ISSUE_DESCRIPTION - 300)}\n\n${footer}`.slice(
      0,
      LIMITS.ISSUE_DESCRIPTION,
    ),
    reproduction: "",
    linkedTaskId: null,
    pinned: false,
    attachments: [],
    fixPr: null,
    githubIssue: { owner, repo, number: source.number, url: source.url },
  };
}

/**
 * Import issues (PR di-skip) menjadi issues open/resolved. 1 txn + 1 activity row.
 * Cap 300 issues (3 halaman) — dokumentasikan, bukan silent cut: kembalikan
 * `truncated: true` bila halaman terakhir penuh.
 */
export async function importRepoIssues(input: {
  projectId: string;
  actorId: string;
  token: string;
  owner: string;
  repo: string;
}): Promise<ImportResult & { truncated: boolean }> {
  const issues = await listRepoIssues(input.token, input.owner, input.repo);
  let imported = 0;
  let skipped = 0;
  const issueIds: string[] = [];
  const now = nowIso();
  const { version } = await mutateProject(input.actorId, input.projectId, undefined, (state) => {
    let firstIssueId: string | undefined;
    for (const item of issues) {
      if (item.isPullRequest) {
        skipped += 1;
        continue;
      }
      if (findIssueByProvenance(state, input.owner, input.repo, item.number)) {
        skipped += 1;
        continue;
      }
      const issue = buildIssueFromGithubIssue(toGithubIssueSource(item), input.owner, input.repo, now);
      state.issues.push(issue);
      issueIds.push(issue.id);
      firstIssueId ??= issue.id;
      imported += 1;
    }
    if (!firstIssueId) return;
    return {
      entity: "issues",
      entityId: firstIssueId,
      action: "created",
      summary: `GitHub: imported ${imported} issue(s) from ${input.owner}/${input.repo}`,
    };
  });
  if (issueIds.length > 0) {
    broadcastDiff(input.projectId, {
      type: "state:diff",
      projectId: input.projectId,
      version,
      ops: issueIds.map((id) => ({ entity: "issues", id, op: "created" as const })),
    });
  }
  return { imported, skipped, issueIds, truncated: issues.length >= 300 };
}
