/**
 * Required-field validation for autosave.
 * Mirror backend `min(1)` (server/.../domain/state.ts): title/name wajib non-kosong.
 * Dipakai project-context (tahan mutation) + edit modal (InlineError + tahan indikator save).
 */

export function isNonEmptyTitle(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isTaskValid(task: { title: string }): boolean {
  return isNonEmptyTitle(task.title);
}

export function isIssueValid(issue: { title: string }): boolean {
  return isNonEmptyTitle(issue.title);
}

export function isDecisionValid(decision: { title: string }): boolean {
  return isNonEmptyTitle(decision.title);
}

export function isTestCaseValid(testCase: { name: string }): boolean {
  return isNonEmptyTitle(testCase.name);
}

export function isTechValid(entry: { name: string }): boolean {
  return isNonEmptyTitle(entry.name);
}

export function isMilestoneValid(milestone: { name: string }): boolean {
  return isNonEmptyTitle(milestone.name);
}
