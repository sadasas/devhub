import type { DoodleVariant } from '../../components/DoodleIllustration';
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
  | 'overview'
  | 'finish';

export interface TourStepDef {
  id: TourStepId;
  /** Element ids or [data-tour-id] values to ring. Empty = centered modal. */
  targetIds: string[];
  /** First tab to show when this step becomes active on ProjectPage. */
  tab?: string;
  /** Topic spot shown in the popover head. Undefined = no art (welcome uses `empty` in the modal). */
  doodle?: DoodleVariant;
}

export const TOUR_STEPS: TourStepDef[] = [
  { id: 'welcome', targetIds: [] },
  { id: 'team', targetIds: ['create-team'], doodle: 'tour-team' },
  { id: 'project', targetIds: ['create-project'], doodle: 'tour-project' },
  { id: 'board', targetIds: ['project-tab-board'], tab: 'board', doodle: 'tour-plan' },
  { id: 'issues', targetIds: ['project-tab-issues'], tab: 'issues', doodle: 'tour-issues' },
  { id: 'tests', targetIds: ['project-tab-tests'], tab: 'tests', doodle: 'tour-tests' },
  { id: 'stack', targetIds: ['project-tab-stack'], tab: 'stack', doodle: 'tour-build' },
  { id: 'schema', targetIds: ['project-tab-schema'], tab: 'schema', doodle: 'tour-schema' },
  { id: 'decisions', targetIds: ['project-tab-decisions'], tab: 'decisions', doodle: 'tour-decide' },
  { id: 'releases', targetIds: ['project-tab-releases'], tab: 'releases', doodle: 'tour-releases' },
  { id: 'api', targetIds: ['project-tab-api'], tab: 'api', doodle: 'tour-api' },
  { id: 'whiteboard', targetIds: ['project-tab-whiteboard'], tab: 'whiteboard', doodle: 'tour-collab' },
  { id: 'overview', targetIds: ['project-tab-overview'], tab: 'overview', doodle: 'tour-overview' },
  { id: 'finish', targetIds: [] },
];

export { TOUR_TOTAL };

export function getTourStep(index: number): TourStepDef {
  return TOUR_STEPS[Math.min(Math.max(index, 0), TOUR_STEPS.length - 1)]!;
}
