import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState } from '../state-db.js';
import { textContent } from '../../domain/entity.js';
import { LIMITS } from '../../../projects/domain/state.js';

const inputSchema = z.object({
  projectId: z.string().uuid().describe('UUID of the project to inspect'),
  limit: z
    .number()
    .int()
    .min(0)
    .max(LIMITS.WHITEBOARDS_PER_PROJECT)
    .default(LIMITS.WHITEBOARDS_PER_PROJECT)
    .describe('Max whiteboards returned (0 = all, capped at 50 per project)'),
  includeElements: z
    .boolean()
    .default(false)
    .describe('Include full board elements (up to 1000 per board). Default false returns counts only.'),
});

export function registerListWhiteboards(server: McpServer): void {
  server.registerTool(
    'list_whiteboards',
    {
      title: 'List whiteboards',
      description:
        'List whiteboards in a DevHub project. Read-only — works for viewers. Returns boards with id, name, description, element count and optional elements. Use to inspect canvas before planning edits.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const cap = args.limit === 0 ? state.whiteboards.length : Math.min(args.limit, state.whiteboards.length);
      const boards = state.whiteboards.slice(0, cap).map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        elementCount: b.elements.length,
        ...(args.includeElements ? { elements: b.elements } : {}),
      }));
      return {
        content: [
          textContent({
            projectId: args.projectId,
            count: state.whiteboards.length,
            returned: boards.length,
            whiteboards: boards,
          }),
        ],
      };
    },
  );
}
