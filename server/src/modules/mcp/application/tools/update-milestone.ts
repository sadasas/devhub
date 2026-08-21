import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, nowIso, textContent } from '../../domain/entity.js';
import { isoDate, LIMITS } from '../../../projects/domain/state.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  milestoneId: z.string().describe('UUID of the milestone to update'),
  name: z.string().min(1).max(LIMITS.MILESTONE_NAME).optional(),
  version: z.string().max(LIMITS.MILESTONE_VERSION).nullable().optional(),
  targetDate: isoDate.nullable().optional().describe('YYYY-MM-DD'),
  status: z.enum(['planned', 'inProgress', 'released']).optional(),
  changelog: z.string().max(LIMITS.MILESTONE_CHANGELOG).optional().describe('What shipped with this release'),
});

export function registerUpdateMilestone(server: McpServer): void {
  server.registerTool(
    'update_milestone',
    {
      title: 'Update a milestone',
      description:
        'Change a DevHub milestone: status (e.g. mark released), version, target date, changelog of shipped work.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const milestone = findEntity(state.milestones, args.milestoneId, 'Milestone');
      applyDefined(milestone, {
        name: args.name?.trim(),
        version: args.version,
        targetDate: args.targetDate,
        status: args.status,
        changelog: args.changelog,
      });
      milestone.updatedAt = nowIso();
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({
            id: milestone.id,
            name: milestone.name,
            status: milestone.status,
            version: milestone.version,
          }),
        ],
      };
    },
  );
}