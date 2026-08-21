import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { findIndexIn, textContent } from '../../domain/entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  relationId: z.string().uuid(),
});

export function registerDeleteRelation(server: McpServer): void {
  server.registerTool(
    'delete_relation',
    {
      title: 'Delete a relation',
      description: 'Remove a foreign-key relation from the DevHub project schema by its UUID.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const index = findIndexIn(state.relations, args.relationId, 'Relation');
      state.relations.splice(index, 1);
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({ id: args.relationId, deleted: true, remainingRelations: state.relations.length }),
        ],
      };
    },
  );
}