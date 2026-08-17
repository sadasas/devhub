import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, nowIso, textContent } from '../entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  taskId: z.string().describe('UUID of the task to update'),
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['todo', 'inProgress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimate: z.number().int().min(0).optional(),
  actualHours: z.number().int().min(0).optional(),
  labels: z.array(z.string()).max(20).optional(),
  milestoneId: z.string().uuid().nullable().optional().describe('Move task to another milestone, or null to unassign'),
  dueDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' })
    .nullable()
    .optional()
    .describe('Set or clear the due date (YYYY-MM-DD, or null)'),
  startDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' })
    .nullable()
    .optional()
    .describe('Set or clear the start date (YYYY-MM-DD, or null)'),
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
      const task = findEntity(state.tasks, args.taskId, 'Task');
      applyDefined(task, {
        title: args.title?.trim(),
        status: args.status,
        priority: args.priority,
        estimate: args.estimate,
        actualHours: args.actualHours,
        labels: args.labels,
        milestoneId: args.milestoneId,
        dueDate: args.dueDate,
        startDate: args.startDate,
        description: args.description,
      });
      task.updatedAt = nowIso();
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({
            id: task.id,
            title: task.title,
            status: task.status,
            actualHours: task.actualHours ?? null,
          }),
        ],
      };
    },
  );
}