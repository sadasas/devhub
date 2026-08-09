import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  milestoneId: z.string().describe('UUID of the milestone to update'),
  name: z.string().min(1).optional(),
  version: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional().describe('YYYY-MM-DD'),
  status: z.enum(['planned', 'inProgress', 'released']).optional(),
  changelog: z.string().optional().describe('What shipped with this release'),
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
      const milestone = state.milestones.find((m) => m.id === args.milestoneId);
      if (!milestone) {
        throw new McpError(ErrorCode.InvalidParams, `Milestone not found: ${args.milestoneId}`);
      }
      if (args.name !== undefined) milestone.name = args.name;
      if (args.version !== undefined) milestone.version = args.version;
      if (args.targetDate !== undefined) milestone.targetDate = args.targetDate;
      if (args.status !== undefined) milestone.status = args.status;
      if (args.changelog !== undefined) milestone.changelog = args.changelog;
      milestone.updatedAt = new Date().toISOString();
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { id: milestone.id, name: milestone.name, status: milestone.status, version: milestone.version },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
