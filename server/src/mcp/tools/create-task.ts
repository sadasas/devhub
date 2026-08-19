import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent } from '../entity.js';
import { hours, LIMITS } from '../../schema/state.js';
import { deriveActualHours } from '../../lib/hours.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  title: z.string().min(1).max(LIMITS.TASK_TITLE),
  status: z.enum(['todo', 'inProgress', 'review', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  estimate: z.number().int().min(0).optional().describe('Estimated hours'),
  actualHours: hours.optional().describe('Actual hours spent (auto-derived when status is done)'),
  labels: z.array(z.string().max(50)).max(20).default([]),
  milestoneId: z.string().uuid().nullable().optional().describe('Optional milestone to group this task under'),
  dueDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' })
    .nullable()
    .optional()
    .describe('Optional due date (YYYY-MM-DD)'),
  startDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' })
    .nullable()
    .optional()
    .describe('Optional start date (YYYY-MM-DD)'),
  completedAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' })
    .nullable()
    .optional()
    .describe('Optional completion time — auto-set to now when status is done'),
  pinned: z.boolean().default(false).describe('Pin the task so it floats to the top of lists'),
  assigneeId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe('Optional assignee (team member id), or null to clear'),
  description: z.string().max(LIMITS.TASK_DESCRIPTION).default(''),
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
      const now = nowIso();
      const completedAt = args.completedAt ?? (args.status === 'done' ? now : null);
      const actualHours =
        args.actualHours ??
        (completedAt
          ? deriveActualHours({ completedAt, createdAt: now, startDate: args.startDate })
          : undefined);
      const task = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        title: args.title.trim(),
        status: args.status,
        priority: args.priority,
        estimate: args.estimate,
        actualHours,
        labels: args.labels,
        blockedBy: [] as string[],
        milestoneId: args.milestoneId,
        dueDate: args.dueDate,
        startDate: args.startDate,
        completedAt,
        pinned: args.pinned,
        assigneeId: args.assigneeId ?? null,
        description: args.description,
      };
      state.tasks.push(task);
      await saveState(args.projectId, state);
      return { content: [textContent({ id: task.id, title: task.title, status: task.status })] };
    },
  );
}