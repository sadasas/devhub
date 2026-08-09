import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the project to inspect'),
});

export function registerProjectState(server: McpServer): void {
  server.registerTool(
    'project_state',
    {
      title: 'Read project state',
      description:
        'Read a DevHub project snapshot: task list with status/priority/estimate/blockers, issues, milestones, tech stack entries and counts. Use before planning new work.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const summary = {
        projectId: args.projectId,
        counts: {
          tasks: state.tasks.length,
          issues: state.issues.length,
          testCases: state.testCases.length,
          techEntries: state.techEntries.length,
          tables: state.tables.length,
          relations: state.relations.length,
          schemaVersions: state.schemaVersions.length,
          decisions: state.decisions.length,
          milestones: state.milestones.length,
        },
        tasks: state.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          estimate: t.estimate ?? null,
          actualHours: t.actualHours ?? null,
          labels: t.labels,
          blockedBy: t.blockedBy,
        })),
        issues: state.issues.map((i) => ({
          id: i.id,
          title: i.title,
          severity: i.severity,
          status: i.status,
          linkedTaskId: i.linkedTaskId,
        })),
        milestones: state.milestones.map((m) => ({
          id: m.id,
          name: m.name,
          version: m.version,
          status: m.status,
          targetDate: m.targetDate,
        })),
        techEntries: state.techEntries.map((t) => ({
          id: t.id,
          name: t.name,
          version: t.version,
          status: t.status,
        })),
        decisions: state.decisions.map((d) => ({ id: d.id, title: d.title, status: d.status, date: d.date })),
      };
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    },
  );
}
