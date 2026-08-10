import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  fromTableId: z.string().describe('UUID of the source table'),
  fromColumnId: z.string().describe('UUID of the source column'),
  toTableId: z.string().describe('UUID of the target table'),
  toColumnId: z.string().describe('UUID of the target column'),
  cardinality: z.enum(['1:1', '1:N', 'N:M']).default('1:N'),
  onDelete: z.enum(['cascade', 'setNull', 'restrict']).default('cascade'),
});

export function registerAddRelation(server: McpServer): void {
  server.registerTool(
    'add_relation',
    {
      title: 'Add a schema relation',
      description:
        'Add a foreign-key relation between two tables in the DevHub project schema. Requires the UUIDs returned by project_state (tables[*].id and tables[*].columns[*].id).',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const fromTable = state.tables.find((t) => t.id === args.fromTableId);
      const toTable = state.tables.find((t) => t.id === args.toTableId);
      if (!fromTable || !toTable) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'fromTableId or toTableId not found in schema' }],
        };
      }
      if (args.fromTableId === args.toTableId) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'fromTableId and toTableId must be different tables' }],
        };
      }
      if (!fromTable.columns.some((c) => c.id === args.fromColumnId)) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'fromColumnId not found in the from table' }],
        };
      }
      if (!toTable.columns.some((c) => c.id === args.toColumnId)) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'toColumnId not found in the to table' }],
        };
      }
      const now = new Date().toISOString();
      const relation = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        fromTableId: args.fromTableId,
        fromColumnId: args.fromColumnId,
        toTableId: args.toTableId,
        toColumnId: args.toColumnId,
        cardinality: args.cardinality,
        onDelete: args.onDelete,
      };
      state.relations.push(relation);
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: relation.id,
                fromTableId: relation.fromTableId,
                toTableId: relation.toTableId,
                cardinality: relation.cardinality,
                updatedAt: now,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
