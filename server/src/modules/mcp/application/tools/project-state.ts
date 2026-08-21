import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadProjectSnapshot } from '../state-db.js';
import { textContent } from '../../domain/entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the project to inspect'),
  limit: z
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(200)
    .describe('Max rows per collection returned (0 = all). Counts always reflect the full state.'),
});

export function registerProjectState(server: McpServer): void {
  server.registerTool(
    'project_state',
    {
      title: 'Read project state',
      description:
        'Read a DevHub project snapshot: project name/description/status and product brief (PRD), task list with status/priority/estimate/blockers, issues, milestones, tech stack entries, database schema (tables with columns and indexes, relations, schema versions) and counts. Use before planning new work.',
      inputSchema,
    },
    async (args) => {
      const { state, meta } = await loadProjectSnapshot(args.projectId);
      const cap = args.limit > 0 ? args.limit : Number.POSITIVE_INFINITY;
      const summary = {
        projectId: args.projectId,
        project: {
          name: meta.name,
          description: meta.description,
          status: meta.status,
          prd: meta.prd,
        },
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
        tasks: state.tasks.slice(0, cap).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          estimate: t.estimate ?? null,
          actualHours: t.actualHours ?? null,
          labels: t.labels,
          blockedBy: t.blockedBy,
        })),
        issues: state.issues.slice(0, cap).map((i) => ({
          id: i.id,
          title: i.title,
          severity: i.severity,
          status: i.status,
          linkedTaskId: i.linkedTaskId,
        })),
        milestones: state.milestones.slice(0, cap).map((m) => ({
          id: m.id,
          name: m.name,
          version: m.version,
          status: m.status,
          targetDate: m.targetDate,
        })),
        techEntries: state.techEntries.slice(0, cap).map((t) => ({
          id: t.id,
          name: t.name,
          version: t.version,
          category: t.category,
          status: t.status,
          notes: t.notes,
        })),
        decisions: state.decisions.slice(0, cap).map((d) => ({ id: d.id, title: d.title, status: d.status, date: d.date })),
        tables: state.tables.slice(0, cap).map((t) => ({
          id: t.id,
          name: t.name,
          comment: t.comment,
          indexes: t.indexes,
          columns: t.columns.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            nullable: c.nullable,
            primaryKey: c.primaryKey,
            default: c.default ?? null,
            comment: c.comment,
          })),
        })),
        relations: state.relations.slice(0, cap).map((r) => ({
          id: r.id,
          fromTableId: r.fromTableId,
          fromColumnId: r.fromColumnId,
          toTableId: r.toTableId,
          toColumnId: r.toColumnId,
          cardinality: r.cardinality,
          onDelete: r.onDelete,
        })),
        schemaVersions: state.schemaVersions.slice(0, cap).map((v) => ({
          id: v.id,
          version: v.version,
          appliedAt: v.appliedAt,
          notes: v.notes,
        })),
      };
      return { content: [textContent(summary)] };
    },
  );
}
