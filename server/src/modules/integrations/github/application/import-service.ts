/**
 * Import service GitHub (application, ADR-041): one-time import issues repo
 * menjadi tasks DevHub. Idempoten via label provenance `gh:owner/repo#N`.
 * Tanpa express — dipanggil routes. Token dari caller (sudah di-resolve).
 */

import { LIMITS } from "../../../projects/domain/state.js";
import { mutateProject } from "../../../projects/application/entityService.js";
import { broadcastDiff } from "../../../realtime/infrastructure/broadcast.js";
import { newId, nowIso } from "../../../../shared/ids.js";
import { listRepoIssues } from "../infrastructure/github-app.js";

export interface ImportResult {
  imported: number;
  skipped: number;
  taskIds: string[];
}

/**
 * Import issues (PR di-skip) menjadi tasks todo/done. 1 txn + 1 activity row.
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
  const repo = `${input.owner}/${input.repo}`;
  let imported = 0;
  let skipped = 0;
  const taskIds: string[] = [];
  const now = nowIso();
  const { version } = await mutateProject(input.actorId, input.projectId, undefined, (state) => {
    const existing = new Set<string>();
    for (const t of state.tasks) {
      for (const l of t.labels ?? []) {
        if (l.startsWith("gh:")) existing.add(l);
      }
    }
    let firstTaskId: string | undefined;
    for (const issue of issues) {
      if (issue.isPullRequest) {
        skipped += 1;
        continue;
      }
      const provenance = `gh:${repo}#${issue.number}`;
      if (existing.has(provenance)) {
        skipped += 1;
        continue;
      }
      const id = newId();
      const done = issue.state === "closed";
      state.tasks.push({
        id,
        createdAt: now,
        updatedAt: now,
        title: issue.title.slice(0, LIMITS.TASK_TITLE) || `#${issue.number}`,
        status: done ? "done" : "todo",
        priority: "medium",
        estimate: undefined,
        actualHours: undefined,
        labels: [...issue.labels, provenance].slice(0, 20),
        blockedBy: [],
        parentTaskId: null,
        checklist: [],
        milestoneId: null,
        dueDate: null,
        startDate: null,
        completedAt: done ? issue.closedAt ?? now : null,
        assigneeId: null,
        pinned: false,
        description: `${issue.body.slice(0, LIMITS.TASK_DESCRIPTION - 200)}\n\nImported from ${repo}#${issue.number} (${issue.url})`.slice(
          0,
          LIMITS.TASK_DESCRIPTION,
        ),
        attachments: [],
        githubLinks: [],
      });
      existing.add(provenance);
      taskIds.push(id);
      firstTaskId ??= id;
      imported += 1;
    }
    if (!firstTaskId) return;
    return {
      entity: "tasks",
      entityId: firstTaskId,
      action: "created",
      summary: `GitHub: imported ${imported} issue(s) from ${repo}`,
    };
  });
  if (taskIds.length > 0) {
    broadcastDiff(input.projectId, {
      type: "state:diff",
      projectId: input.projectId,
      version,
      ops: taskIds.map((id) => ({ entity: "tasks", id, op: "created" as const })),
    });
  }
  return { imported, skipped, taskIds, truncated: issues.length >= 300 };
}
