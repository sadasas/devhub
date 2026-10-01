import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, nowIso, textContent } from '../../domain/entity.js';
import { LIMITS, githubLinkSchema } from '../../../projects/domain/state.js';
import { applyActiveHoursTransition } from '../../../projects/domain/hours.js';

const inputSchema = z.object({
  projectId: z.string().uuid().describe('UUID of the target project'),
  taskId: z.string().uuid().describe('UUID of the task to update'),
  title: z.string().min(1).max(LIMITS.TASK_TITLE).optional(),
  status: z.enum(['todo', 'inProgress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimate: z.number().int().min(0).optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  parentTaskId: z.string().uuid().nullable().optional().describe('Set parent for 1-level subtask, or null to detach'),
  checklist: z.array(z.object({ id: z.string().uuid(), title: z.string().min(1).max(200), done: z.boolean().default(false) })).max(20).optional(),
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
  githubLinks: z
    .array(githubLinkSchema)
    .max(LIMITS.GITHUB_LINKS_PER_TASK)
    .optional()
    .describe('Replace the GitHub branch/PR/commit links on this task'),
});

export function registerUpdateTask(server: McpServer): void {
  server.registerTool(
    'update_task',
    {
      title: 'Update a task',
      description:
        'Change a task in a DevHub project: status, priority, estimate, labels or title. Active hours (actualHours) are auto-derived from accumulated in-progress time — never send manual hours. Agents should call this after completing implementation work.',
      inputSchema: inputSchema.passthrough(),
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const task = findEntity(state.tasks, args.taskId, 'Task') as Record<string, unknown> & {
        status: string;
        createdAt: string;
        title: string;
        id: string;
        actualHours?: number;
        startDate?: string | null;
        updatedAt: string;
      };
      const raw = args as Record<string, unknown>;
      const warnings: string[] = [];
      if (raw.actualHours !== undefined || raw.activeMs !== undefined || raw.inProgressAt !== undefined) {
        warnings.push('actualHours/activeMs/inProgressAt are auto-derived and were ignored.');
      }
      const now = nowIso();
      let completedAt = args.completedAt;
      if (completedAt === undefined && args.status !== undefined) {
        if (args.status === 'done') {
          if (task.status !== 'done') completedAt = now;
        } else if (task.status === 'done') {
          completedAt = null;
        }
      }
      // ADR-067: strip manual jam, hitung via transisi inProgress.
      let hoursPatch: Record<string, unknown> = {};
      if (args.status !== undefined && args.status !== task.status) {
        hoursPatch = applyActiveHoursTransition(
          {
            status: task.status,
            createdAt: task.createdAt,
            inProgressAt: (task as Record<string, unknown>).inProgressAt as string | null | undefined,
            activeMs: (task as Record<string, unknown>).activeMs as number | undefined,
            actualHours: task.actualHours,
          },
          args.status,
          now,
          (completedAt as string | null | undefined) ??
            ((task as Record<string, unknown>).completedAt as string | null | undefined) ??
            now,
        ) as Record<string, unknown>;
      } else if ((task as Record<string, unknown>).activeMs === undefined && task.actualHours != null) {
        hoursPatch = applyActiveHoursTransition(
          {
            status: task.status,
            createdAt: task.createdAt,
            inProgressAt: (task as Record<string, unknown>).inProgressAt as string | null | undefined,
            activeMs: undefined,
            actualHours: task.actualHours,
          },
          task.status,
          now,
        ) as Record<string, unknown>;
      }
      applyDefined(task, {
        title: args.title?.trim(),
        status: args.status,
        priority: args.priority,
        estimate: args.estimate,
        labels: args.labels,
        parentTaskId: args.parentTaskId,
        checklist: args.checklist,
        milestoneId: args.milestoneId,
        dueDate: args.dueDate,
        startDate: args.startDate,
        completedAt,
        pinned: args.pinned,
        assigneeId: args.assigneeId,
        description: args.description,
        githubLinks: args.githubLinks,
        ...hoursPatch,
      });
      task.updatedAt = now;
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({
            id: task.id,
            title: task.title,
            status: task.status,
            actualHours: task.actualHours ?? null,
            ...(warnings.length > 0 ? { warnings } : {}),
          }),
        ],
      };
    },
  );
}