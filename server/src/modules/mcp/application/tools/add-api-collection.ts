import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent, toolError } from '../../domain/entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).default(''),
});

export function registerAddApiCollection(server: McpServer): void {
  server.registerTool(
    'add_api_collection',
    {
      title: 'Add an API collection',
      description: 'Add an API collection (a named group of endpoints, e.g. "Users API") to the DevHub project API documentation.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const name = args.name.trim();
      if (state.apiCollections.some((c) => c.name === name)) {
        return toolError(`API collection already exists: ${name}`);
      }
      const now = nowIso();
      const collection = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        name,
        description: args.description,
      };
      state.apiCollections.push(collection);
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({ id: collection.id, name: collection.name, updatedAt: now }),
        ],
      };
    },
  );
}