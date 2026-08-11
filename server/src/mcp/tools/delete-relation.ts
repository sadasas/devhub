import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  relationId: z.string().describe('UUID of the relation to delete'),
});

export function registerDeleteRelation(server: McpServer): void {
  server.registerTool(
    'delete_relation',
    {
      title: 'Delete a schema relation',
      description:
        'Remove a foreign-key relation from the DevHub project schema by its UUID (as returned by add_relation or project_state relations[*].id).',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const index = state.relations.findIndex((r) => r.id === args.relationId);
      if (index < 0) {
        throw new McpError(ErrorCode.InvalidParams, `Relation not found: ${args.relationId}`);
      }
      state.relations.splice(index, 1);
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { id: args.relationId, deleted: true, remainingRelations: state.relations.length },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}