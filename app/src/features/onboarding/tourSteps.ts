import { TOUR_TOTAL } from './tour-events';

export type TourStepId =
  | 'welcome'
  | 'team'
  | 'project'
  | 'plan'
  | 'build'
  | 'decide'
  | 'collab';

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
  { id: 'plan', targetIds: ['project-tab-board', 'project-tab-issues'], tab: 'board' },
  { id: 'build', targetIds: ['project-tab-tests', 'project-tab-stack', 'project-tab-schema'], tab: 'tests' },
  {
    id: 'decide',
    targetIds: ['project-tab-decisions', 'project-tab-releases', 'project-tab-api'],
    tab: 'decisions',
  },
  {
    id: 'collab',
    targetIds: ['project-tab-whiteboard', 'project-tab-overview'],
    tab: 'whiteboard',
  },
];

export { TOUR_TOTAL };

export function getTourStep(index: number): TourStepDef {
  return TOUR_STEPS[Math.min(Math.max(index, 0), TOUR_STEPS.length - 1)]!;
}
