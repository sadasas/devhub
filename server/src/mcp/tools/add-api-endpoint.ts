import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  apiHeaderSchema,
  apiMethod,
  apiParamSchema,
  apiResponseSchema,
} from '../../schema/state.js';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent, toolError } from '../entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  collectionId: z.string().uuid().nullable().describe('UUID of the API collection, or null for ungrouped').optional(),
  method: apiMethod,
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
  description: z.string().max(10_000).default(''),
  headers: z.array(apiHeaderSchema).max(100).default([]),
  params: z.array(apiParamSchema).max(100).default([]),
  body: z.string().max(50_000).default(''),
  responses: z.array(apiResponseSchema).max(50).default([]),
});

export function registerAddApiEndpoint(server: McpServer): void {
  server.registerTool(
    'add_api_endpoint',
    {
      title: 'Add an API endpoint',
      description:
        'Document an API endpoint (method, path, description, headers, params, request body and example responses) in the DevHub project API documentation.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      if (args.collectionId != null && !state.apiCollections.some((c) => c.id === args.collectionId)) {
        return toolError(`API collection not found: ${args.collectionId}`);
      }
      const now = nowIso();
      const endpoint = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        collectionId: args.collectionId ?? null,
        method: args.method,
        path: args.path.trim(),
        name: args.name.trim(),
        description: args.description,
        headers: args.headers,
        params: args.params,
        body: args.body,
        responses: args.responses,
      };
      state.apiEndpoints.push(endpoint);
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({ id: endpoint.id, method: endpoint.method, path: endpoint.path, updatedAt: now }),
        ],
      };
    },
  );
}