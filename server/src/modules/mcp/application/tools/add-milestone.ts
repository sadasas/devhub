import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent } from '../../domain/entity.js';
import { isoDate, LIMITS, milestoneStatus } from '../../../projects/domain/state.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  name: z.string().min(1).max(LIMITS.MILESTONE_NAME).describe('Milestone name (e.g. "M26: Profile Redesign")'),
  version: z.string().max(LIMITS.MILESTONE_VERSION).nullable().optional(),
  targetDate: isoDate.nullable().optional().describe('YYYY-MM-DD'),
  status: milestoneStatus.default('planned'),
  changelog: z.string().max(LIMITS.MILESTONE_CHANGELOG).default('').describe('What will ship / shipped with this release'),
});

export function registerAddMilestone(server: McpServer): void {
  server.registerTool(
    'add_milestone',
    {
      title: 'Add a milestone',
      description:
        'Create a DevHub milestone (e.g. a release "M26: ...") with name, optional version, target date, status and changelog.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const now = nowIso();
      const milestone = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        name: args.name.trim(),
        version: args.version,
        targetDate: args.targetDate,
        status: args.status,
        changelog: args.changelog,
      };
      state.milestones.push(milestone);
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({ id: milestone.id, name: milestone.name, status: milestone.status, version: milestone.version }),
        ],
      };
    },
  );
}
