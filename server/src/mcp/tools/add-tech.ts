import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  name: z.string().min(1).max(200),
  version: z.string().max(100).default(''),
  category: z.enum(['frontend', 'backend', 'database', 'tooling']).default('frontend'),
  status: z.enum(['current', 'updateAvailable', 'majorUpgrade']).default('current'),
  notes: z.string().max(5_000).default(''),
});

export function registerAddTech(server: McpServer): void {
  server.registerTool(
    'add_tech',
    {
      title: 'Add a tech stack entry',
      description:
        'Add an entry to the DevHub project tech stack with name, version, category, status and optional notes.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      if (state.techEntries.some((t) => t.name.toLowerCase() === args.name.trim().toLowerCase())) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Tech entry already exists: ${args.name.trim()}` }],
        };
      }
      const now = new Date().toISOString();
      const entry = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        name: args.name.trim(),
        version: args.version.trim(),
        category: args.category,
        status: args.status,
        notes: args.notes,
      };
      state.techEntries.push(entry);
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { id: entry.id, name: entry.name, version: entry.version, status: entry.status, updatedAt: now },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
