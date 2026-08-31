import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent, toolError } from '../../domain/entity.js';

const inputSchema = z.object({
  projectId: z.string().uuid().describe('UUID of the target project'),
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
      const name = args.name.trim();
      const duplicate = state.techEntries.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        return toolError(`Tech entry already exists: ${name}`);
      }
      const now = nowIso();
      const entry = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        name,
        version: args.version.trim(),
        category: args.category,
        status: args.status,
        notes: args.notes,
      };
      state.techEntries.push(entry);
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({ id: entry.id, name: entry.name, version: entry.version, status: entry.status, updatedAt: now }),
        ],
      };
    },
  );
}