import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent } from '../../domain/entity.js';
import { LIMITS } from '../../../projects/domain/state.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  brief: z
    .string()
    .max(LIMITS.BRIEF)
    .describe(
      'Plan outline. Each non-empty line becomes a task. Line syntax:\n- "- <title> :: <estimate hours>" creates a task with an estimate\n- "# Milestone: <name> :: <version> :: <YYYY-MM-DD>" creates a milestone\n- "## Decision: <title>" creates a proposed decision',
    ),
});

function parsePlan(brief: string) {
  const today = new Date().toISOString().slice(0, 10);
  const tasks: Array<{ title: string; estimate?: number }> = [];
  const milestones: Array<{ name: string; version: string | null; targetDate: string | null }> = [];
  const decisions: string[] = [];
  for (const raw of brief.split('\n')) {
    const line = raw.trim();
    if (!line || line === '---') continue;
    if (line.startsWith('## ')) {
      decisions.push(line.slice(3).trim().slice(0, LIMITS.DECISION_TITLE));
      continue;
    }
    if (line.startsWith('# ')) {
      const parts = line.slice(2).split('::').map((p) => p.trim());
      milestones.push({
        name: (parts[0] || 'Milestone').slice(0, LIMITS.MILESTONE_NAME),
        version: parts[1] ? parts[1].slice(0, LIMITS.MILESTONE_VERSION) : null,
        targetDate: parts[2] ? parts[2] : null,
      });
      continue;
    }
    const body = line.startsWith('-') ? line.slice(1).trim() : line;
    const parts = body.split('::').map((p) => p.trim());
    const parsedEstimate = parts[1] ? Number.parseInt(parts[1], 10) : undefined;
    const estimate =
      parsedEstimate !== undefined && Number.isFinite(parsedEstimate) && parsedEstimate >= 0
        ? parsedEstimate
        : undefined;
    tasks.push({
      title: (parts[0] || body).slice(0, LIMITS.TASK_TITLE),
      estimate,
    });
  }
  return { tasks, milestones, decisions, today };
}

export function registerPlanProject(server: McpServer): void {
  server.registerTool(
    'plan_project',
    {
      title: 'Plan a project from a brief',
      description:
        'Turn a free-form brief into DevHub tasks, milestones and proposed decisions in one call. Use the project_state tool first to avoid duplicating existing work.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const { tasks, milestones, decisions, today } = parsePlan(args.brief);

      const now = nowIso();
      const taskResults = tasks.map((t) => {
        const task = {
          id: newId(),
          createdAt: now,
          updatedAt: now,
          title: t.title,
          status: 'todo' as const,
          priority: 'medium' as const,
          estimate: t.estimate,
          actualHours: undefined,
          labels: [] as string[],
          blockedBy: [] as string[],
          pinned: false,
          description: '',
        };
        state.tasks.push(task);
        return { id: task.id, title: task.title, estimate: task.estimate ?? null };
      });

      const milestoneResults = milestones.map((m) => {
        const milestone = {
          id: newId(),
          createdAt: now,
          updatedAt: now,
          name: m.name,
          version: m.version,
          targetDate: m.targetDate,
          status: 'planned' as const,
          changelog: '',
        };
        state.milestones.push(milestone);
        return { id: milestone.id, name: milestone.name, version: milestone.version };
      });

      const decisionResults = decisions.map((title) => {
        const decision = {
          id: newId(),
          createdAt: now,
          updatedAt: now,
          title,
          status: 'proposed' as const,
          date: today,
          context: '',
          options: [] as string[],
          decision: '',
          consequences: '',
          pinned: false,
        };
        state.decisions.push(decision);
        return { id: decision.id, title: decision.title };
      });

      await saveState(args.projectId, state);
      return {
        content: [
          textContent({
            createdTasks: taskResults,
            createdMilestones: milestoneResults,
            createdDecisions: decisionResults,
          }),
        ],
      };
    },
  );
}