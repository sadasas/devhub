import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent, toolError } from '../entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  fromTableId: z.string(),
  fromColumnId: z.string(),
  toTableId: z.string(),
  toColumnId: z.string(),
  cardinality: z.enum(['1:1', '1:N', 'N:M']).default('1:N'),
  onDelete: z.enum(['cascade', 'setNull', 'restrict']).default('cascade'),
});

export function registerAddRelation(server: McpServer): void {
  server.registerTool(
    'add_relation',
    {
      title: 'Add a relation',
      description: 'Add a foreign-key relation between two tables in the DevHub project schema.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      if (!state.tables.some((t) => t.id === args.fromTableId) || !state.tables.some((t) => t.id === args.toTableId)) {
        return toolError('fromTableId or toTableId not found in schema');
      }
      if (args.fromTableId === args.toTableId) {
        return toolError('fromTableId and toTableId must be different tables');
      }
      const fromTable = state.tables.find((t) => t.id === args.fromTableId)!;
      const toTable = state.tables.find((t) => t.id === args.toTableId)!;
      if (!fromTable.columns.some((c) => c.id === args.fromColumnId)) {
        return toolError('fromColumnId not found in the from table');
      }
      if (!toTable.columns.some((c) => c.id === args.toColumnId)) {
        return toolError('toColumnId not found in the to table');
      }
      const duplicate = state.relations.find(
        (r) =>
          r.fromTableId === args.fromTableId &&
          r.fromColumnId === args.fromColumnId &&
          r.toTableId === args.toTableId &&
          r.toColumnId === args.toColumnId,
      );
      if (duplicate) {
        return toolError(`Identical relation already exists: ${duplicate.id} (${duplicate.cardinality})`);
      }
      const now = nowIso();
      const relation = {
        id: newId(),
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
          textContent({
            id: relation.id,
            fromTableId: relation.fromTableId,
            toTableId: relation.toTableId,
            cardinality: relation.cardinality,
            updatedAt: now,
          }),
        ],
      };
    },
  );
}