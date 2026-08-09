import type { Milestone, State } from './types';

export interface ProjectStats {
  totalTasks: number;
  doneTasks: number;
  openIssues: number;
  outdatedDeps: number;
  nextMilestone: Milestone | null;
  totalMilestones: number;
  releasedMilestones: number;
}

export function computeProjectStats(state: State): ProjectStats {
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter((t) => t.status === 'done').length;
  const openIssues = state.issues.filter((i) => !['resolved', 'wontfix'].includes(i.status)).length;
  const outdatedDeps = state.techEntries.filter((t) => t.status !== 'current').length;

  const now = Date.now();
  const upcoming = state.milestones
    .filter((m) => m.status !== 'released' && m.targetDate && Date.parse(m.targetDate) >= now)
    .sort((a, b) => Date.parse(a.targetDate!) - Date.parse(b.targetDate!));

  const releasedMilestones = state.milestones.filter((m) => m.status === 'released').length;

  return {
    totalTasks,
    doneTasks,
    openIssues,
    outdatedDeps,
    nextMilestone: upcoming[0] ?? null,
    totalMilestones: state.milestones.length,
    releasedMilestones,
  };
}
