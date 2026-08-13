import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent, toolError } from '../entity.js';

const columnSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  nullable: z.boolean().default(true),
  primaryKey: z.boolean().default(false),
  default: z.string().max(500).nullable().optional(),
  comment: z.string().max(2_000).default(''),
});

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  name: z.string().min(1).max(200),
  comment: z.string().max(2_000).default(''),
  columns: z.array(columnSchema).max(200).default([]),
  indexes: z.array(z.string().max(500)).max(50).default([]),
});

export function registerAddTable(server: McpServer): void {
  server.registerTool(
    'add_table',
    {
      title: 'Add a table',
      description:
        'Add a table to the DevHub project schema with columns (name, type, nullable, primary key, default, comment) and optional indexes.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const name = args.name.trim();
      if (state.tables.some((t) => t.name === name)) {
        return toolError(`Table already exists: ${name}`);
      }
      const now = nowIso();
      const table = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        name,
        comment: args.comment,
        columns: args.columns.map((c) => ({
          id: newId(),
          name: c.name.trim(),
          type: c.type.trim(),
          nullable: c.nullable,
          primaryKey: c.primaryKey,
          default: c.default ?? null,
          comment: c.comment,
        })),
        indexes: args.indexes,
      };
      state.tables.push(table);
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({ id: table.id, name: table.name, columns: table.columns.length, updatedAt: now }),
        ],
      };
    },
  );
}