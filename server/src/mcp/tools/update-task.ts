import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  taskId: z.string().describe('UUID of the task to update'),
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['todo', 'inProgress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimate: z.number().int().min(0).optional(),
  actualHours: z.number().int().min(0).optional(),
  labels: z.array(z.string()).max(20).optional(),
  description: z.string().optional(),
});

export function registerUpdateTask(server: McpServer): void {
  server.registerTool(
    'update_task',
    {
      title: 'Update a task',
      description:
        'Change a task in a DevHub project: status, priority, estimate, actual hours spent, labels or title. Agents should call this after completing implementation work.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const task = state.tasks.find((t) => t.id === args.taskId);
      if (!task) {
        throw new McpError(ErrorCode.InvalidParams, `Task not found: ${args.taskId}`);
      }
      if (args.title !== undefined) task.title = args.title.trim();
      if (args.status !== undefined) task.status = args.status;
      if (args.priority !== undefined) task.priority = args.priority;
      if (args.estimate !== undefined) task.estimate = args.estimate;
      if (args.actualHours !== undefined) task.actualHours = args.actualHours;
      if (args.labels !== undefined) task.labels = args.labels;
      if (args.description !== undefined) task.description = args.description;
      task.updatedAt = new Date().toISOString();
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { id: task.id, title: task.title, status: task.status, actualHours: task.actualHours ?? null },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
