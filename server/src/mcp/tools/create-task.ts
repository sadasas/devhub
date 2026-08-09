import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  title: z.string().min(1).max(500),
  status: z.enum(['todo', 'inProgress', 'review', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  estimate: z.number().int().min(0).optional().describe('Estimated hours'),
  actualHours: z.number().int().min(0).optional(),
  labels: z.array(z.string()).max(20).default([]),
  description: z.string().default(''),
});

export function registerCreateTask(server: McpServer): void {
  server.registerTool(
    'create_task',
    {
      title: 'Create a task',
      description: 'Add a task to a DevHub project board with status, priority, estimate and labels.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const now = new Date().toISOString();
      const task = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        title: args.title.trim(),
        status: args.status,
        priority: args.priority,
        estimate: args.estimate,
        actualHours: args.actualHours,
        labels: args.labels,
        blockedBy: [] as string[],
        description: args.description,
      };
      state.tasks.push(task);
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ id: task.id, title: task.title, status: task.status }, null, 2),
          },
        ],
      };
    },
  );
}
