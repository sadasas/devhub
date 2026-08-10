import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

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
      title: 'Add a database table',
      description:
        'Add a table to the DevHub project schema with columns (name, type, nullable, primaryKey, default, comment) and optional indexes.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      if (state.tables.some((t) => t.name === args.name.trim())) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Table already exists: ${args.name.trim()}` }],
        };
      }
      const now = new Date().toISOString();
      const table = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        name: args.name.trim(),
        comment: args.comment,
        columns: args.columns.map((c) => ({
          id: randomUUID(),
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
          {
            type: 'text',
            text: JSON.stringify(
              { id: table.id, name: table.name, columns: table.columns.length, updatedAt: now },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
