import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useProject } from '../state/project-context';
import type { ProjectTab } from '../features/project/ProjectPage';

const TAB_LABELS: Record<ProjectTab, string> = {
  board: 'Board',
  issues: 'Issues',
  tests: 'Test Cases',
  stack: 'Stack',
  schema: 'Schema',
  decisions: 'Decisions',
  releases: 'Releases',
  api: 'API',
  overview: 'Overview',
  whiteboard: 'Whiteboard',
};

const TAB_IDS: ProjectTab[] = Object.keys(TAB_LABELS) as ProjectTab[];

export function viewingStatus(tab: ProjectTab): string {
  return `Viewing ${TAB_LABELS[tab] ?? 'Board'}`;
}

/**
 * Announces the current UI context as the presence status: `active` while
 * `open` (e.g. 'Editing task' for an open edit modal), and the current
 * project tab (e.g. 'Viewing Board') once closed or unmounted.
 */
export function usePresenceStatus(active: string | null, open = true): void {
  const { setStatus } = useProject();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: ProjectTab = TAB_IDS.includes(tabParam as ProjectTab) ? (tabParam as ProjectTab) : 'board';
  const restore = viewingStatus(tab);

  useEffect(() => {
    if (!open) return undefined;
    setStatus(active);
    return () => setStatus(restore);
  }, [open, active, restore, setStatus]);
}