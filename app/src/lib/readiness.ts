import type { Issue, Milestone, Task, TestCase } from './types';

export type CheckTone = 'success' | 'warn' | 'danger' | 'neutral';

export interface ReadinessCheck {
  id: string;
  label: string;
  pass: boolean;
  tone: CheckTone;
  detail: string;
  warn?: boolean;
}

export interface ReadinessResult {
  checks: ReadinessCheck[];
  passCount: number;
  total: number;
  ready: boolean;
  hasWarn: boolean;
}

export function computeReadiness(
  milestone: Milestone,
  tasks: Task[],
  issues: Issue[],
  testCases: TestCase[],
): ReadinessResult {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;

  const blockedActive = tasks.filter((t) => {
    if (t.status === 'done') return false;
    if (!t.blockedBy || t.blockedBy.length === 0) return false;
    return t.blockedBy.some((bId) => {
      const blocker = tasks.find((x) => x.id === bId);
      // if blocker not in milestone tasks, treat as external — not counted as internal blocked
      if (!blocker) return false;
      return blocker.status !== 'done';
    });
  }).length;

  const testRelevant = testCases.filter((tc) =>
    tc.taskId ? tasks.some((t) => t.id === tc.taskId) : false,
  );
  const testFail = testRelevant.filter((tc) => tc.status === 'fail').length;
  const testPending = testRelevant.filter((tc) => tc.status === 'pending').length;

  const linkedIssueIds = new Set(tasks.map((t) => t.id));
  const relevantIssues = issues.filter(
    (iss) => iss.linkedTaskId && linkedIssueIds.has(iss.linkedTaskId),
  );
  const openIssues = relevantIssues.filter((i) =>
    ['open', 'reproduced', 'fixing'].includes(i.status),
  ).length;

  const hasChangelog = milestone.changelog.trim().length > 0;

  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'done').length;

  const checks: ReadinessCheck[] = [
    {
      id: 'tasks',
      label: 'Tasks Complete',
      pass: total === 0 ? true : done === total,
      tone: total === 0 ? 'neutral' : done === total ? 'success' : 'warn',
      detail: `${done}/${total} done`,
      warn: total === 0,
    },
    {
      id: 'blocked',
      label: 'No Blocked Active',
      pass: blockedActive === 0,
      tone: blockedActive === 0 ? 'success' : 'danger',
      detail: blockedActive === 0 ? 'No blocked' : `${blockedActive} blocked`,
    },
    {
      id: 'tests',
      label: 'Tests Pass',
      pass: testFail === 0 && testPending === 0,
      tone: testFail > 0 ? 'danger' : testPending > 0 ? 'warn' : 'success',
      detail:
        testRelevant.length === 0
          ? 'No tests'
          : testFail > 0
            ? `${testFail} fail`
            : testPending > 0
              ? `${testPending} pending`
              : 'All pass',
      warn: testRelevant.length === 0,
    },
    {
      id: 'issues',
      label: 'No Open Issues',
      pass: openIssues === 0,
      tone: openIssues === 0 ? 'success' : 'danger',
      detail: openIssues === 0 ? 'No open' : `${openIssues} open`,
    },
    {
      id: 'changelog',
      label: 'Changelog Filled',
      pass: hasChangelog,
      tone: hasChangelog ? 'success' : 'warn',
      detail: hasChangelog ? 'Filled' : 'Empty',
      warn: !hasChangelog,
    },
    {
      id: 'overdue',
      label: 'No Overdue Tasks',
      pass: overdue === 0,
      tone: overdue === 0 ? 'success' : 'danger',
      detail: overdue === 0 ? 'No overdue' : `${overdue} overdue`,
      warn: true,
    },
  ];

  const passCount = checks.filter((c) => c.pass).length;
  const hasWarn = checks.some((c) => c.warn && !c.pass);
  // ready strictly: tasks+blocked+tests+issues must pass; changelog/overdue are warnings
  const critical = checks.filter((c) => ['tasks', 'blocked', 'tests', 'issues'].includes(c.id));
  const ready = critical.every((c) => c.pass);

  return { checks, passCount, total: checks.length, ready, hasWarn };
}
