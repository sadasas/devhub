import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  apiHeaderSchema,
  apiMethod,
  apiParamSchema,
  apiResponseSchema,
  type ApiEndpoint,
} from '../../schema/state.js';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  endpointId: z.string().describe('UUID of the endpoint to update'),
  collectionId: z.string().uuid().nullable().describe('New collection UUID, or null to ungroup').optional(),
  method: apiMethod.optional(),
  path: z.string().min(1).max(500).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  headers: z.array(apiHeaderSchema).max(100).optional(),
  params: z.array(apiParamSchema).max(100).optional(),
  body: z.string().max(50_000).optional(),
  responses: z.array(apiResponseSchema).max(50).optional(),
});

export function registerUpdateApiEndpoint(server: McpServer): void {
  server.registerTool(
    'update_api_endpoint',
    {
      title: 'Update an API endpoint',
      description:
        'Patch any documented field of an API endpoint (method, path, name, description, headers, params, body, responses, or move it to another collection).',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const index = state.apiEndpoints.findIndex((e) => e.id === args.endpointId);
      if (index === -1) {
        return {
          isError: true,
          content: [{ type: 'text', text: `API endpoint not found: ${args.endpointId}` }],
        };
      }
      if (args.collectionId != null && !state.apiCollections.some((c) => c.id === args.collectionId)) {
        return {
          isError: true,
          content: [{ type: 'text', text: `API collection not found: ${args.collectionId}` }],
        };
      }
      const now = new Date().toISOString();
      const updated: ApiEndpoint = { ...state.apiEndpoints[index]!, updatedAt: now };
      if (args.collectionId !== undefined) updated.collectionId = args.collectionId;
      if (args.method !== undefined) updated.method = args.method;
      if (args.path !== undefined) updated.path = args.path.trim();
      if (args.name !== undefined) updated.name = args.name.trim();
      if (args.description !== undefined) updated.description = args.description;
      if (args.headers !== undefined) updated.headers = args.headers;
      if (args.params !== undefined) updated.params = args.params;
      if (args.body !== undefined) updated.body = args.body;
      if (args.responses !== undefined) updated.responses = args.responses;
      state.apiEndpoints[index] = updated;
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ id: args.endpointId, updatedAt: now }, null, 2),
          },
        ],
      };
    },
  );
}