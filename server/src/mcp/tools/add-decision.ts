import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  title: z.string().min(1).max(500),
  status: z.enum(['proposed', 'accepted', 'rejected', 'superseded']).default('proposed'),
  date: z.string().default(new Date().toISOString().slice(0, 10)).describe('Decision date YYYY-MM-DD'),
  context: z.string().default(''),
  options: z.array(z.string()).max(20).default([]),
  decision: z.string().default(''),
  consequences: z.string().default(''),
});

export function registerAddDecision(server: McpServer): void {
  server.registerTool(
    'add_decision',
    {
      title: 'Add an ADR decision',
      description:
        'Record an architecture decision (ADR) in a DevHub project: context, options considered, the decision and its consequences.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const now = new Date().toISOString();
      const decision = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        title: args.title.trim(),
        status: args.status,
        date: args.date,
        context: args.context,
        options: args.options,
        decision: args.decision,
        consequences: args.consequences,
      };
      state.decisions.push(decision);
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ id: decision.id, title: decision.title, status: decision.status }, null, 2),
          },
        ],
      };
    },
  );
}
