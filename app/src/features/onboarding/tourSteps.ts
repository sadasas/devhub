import { TOUR_TOTAL } from './tour-events';

export type TourStepId =
  | 'welcome'
  | 'team'
  | 'project'
  | 'board'
  | 'issues'
  | 'tests'
  | 'stack'
  | 'schema'
  | 'decisions'
  | 'releases'
  | 'api'
  | 'whiteboard'
  | 'overview';

export interface TourStepDef {
  id: TourStepId;
  /** Element ids or [data-tour-id] values to ring. Empty = centered modal. */
  targetIds: string[];
  /** First tab to show when this step becomes active on ProjectPage. */
  tab?: string;
}

export const TOUR_STEPS: TourStepDef[] = [
  { id: 'welcome', targetIds: [] },
  { id: 'team', targetIds: ['create-team'] },
  { id: 'project', targetIds: ['create-project'] },
  // Per-tab project tour: one anchored step per ProjectTab so users learn
  // every feature surface (board views, issue severity, ERD, API docs…).
  // Order mirrors the tab bar (Alt+1..9, Alt+0) in ProjectPage TABS.
  { id: 'board', targetIds: ['project-tab-board'], tab: 'board' },
  { id: 'issues', targetIds: ['project-tab-issues'], tab: 'issues' },
  { id: 'tests', targetIds: ['project-tab-tests'], tab: 'tests' },
  { id: 'stack', targetIds: ['project-tab-stack'], tab: 'stack' },
  { id: 'schema', targetIds: ['project-tab-schema'], tab: 'schema' },
  { id: 'decisions', targetIds: ['project-tab-decisions'], tab: 'decisions' },
  { id: 'releases', targetIds: ['project-tab-releases'], tab: 'releases' },
  { id: 'api', targetIds: ['project-tab-api'], tab: 'api' },
  { id: 'whiteboard', targetIds: ['project-tab-whiteboard'], tab: 'whiteboard' },
  { id: 'overview', targetIds: ['project-tab-overview'], tab: 'overview' },
];

export { TOUR_TOTAL };

export function getTourStep(index: number): TourStepDef {
  return TOUR_STEPS[Math.min(Math.max(index, 0), TOUR_STEPS.length - 1)]!;
}
