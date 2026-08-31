import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, nowIso, textContent } from '../../domain/entity.js';
import { hours, LIMITS } from '../../../projects/domain/state.js';
import { deriveActualHours } from '../../../projects/domain/hours.js';

const inputSchema = z.object({
  projectId: z.string().uuid().describe('UUID of the target project'),
  taskId: z.string().uuid().describe('UUID of the task to update'),
  title: z.string().min(1).max(LIMITS.TASK_TITLE).optional(),
  status: z.enum(['todo', 'inProgress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimate: z.number().int().min(0).optional(),
  actualHours: hours
        .optional()
        .describe('Actual hours spent — auto-derived from startDate/createdAt when status moves to done'),
  labels: z.array(z.string().max(50)).max(20).optional(),
  milestoneId: z.string().uuid().nullable().optional().describe('Move task to another milestone, or null to unassign'),
  dueDate: z
    .string().max(100).refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' })
    .nullable()
    .optional()
    .describe('Set or clear the due date (YYYY-MM-DD, or null)'),
  startDate: z
    .string().max(100).refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' })
    .nullable()
    .optional()
    .describe('Set or clear the start date (YYYY-MM-DD, or null)'),
  completedAt: z
    .string().max(100).refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' })
    .nullable()
    .optional()
    .describe('Completion time — auto-set to now when status moves to done, cleared when leaving done'),
  pinned: z.boolean().optional().describe('Pin or unpin the task'),
  assigneeId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe('Set or clear the assignee (team member id, or null)'),
  description: z.string().max(LIMITS.TASK_DESCRIPTION).optional(),
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
      let completedAt = args.completedAt;
      if (completedAt === undefined && args.status !== undefined) {
        if (args.status === 'done') {
          if (task.status !== 'done') completedAt = nowIso();
        } else {
          completedAt = null;
        }
      }
      const actualHours =
        args.actualHours ??
        (args.status === 'done' && task.status !== 'done' && completedAt
          ? deriveActualHours({
              completedAt,
              createdAt: task.createdAt,
              startDate: args.startDate ?? task.startDate,
            })
          : undefined);
      applyDefined(task, {
        title: args.title?.trim(),
        status: args.status,
        priority: args.priority,
        estimate: args.estimate,
        actualHours,
        labels: args.labels,
        milestoneId: args.milestoneId,
        dueDate: args.dueDate,
        startDate: args.startDate,
        completedAt,
        pinned: args.pinned,
        assigneeId: args.assigneeId,
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