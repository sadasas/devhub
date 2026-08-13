import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  apiMethod,
  type ApiEndpoint,
} from '../../schema/state.js';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, nowIso, textContent, toolError } from '../entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  endpointId: z.string().describe('UUID of the endpoint to update'),
  collectionId: z.string().uuid().nullable().optional().describe('New collection UUID, or null to ungroup'),
  method: apiMethod.optional(),
  path: z.string().min(1).max(500).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  headers: z.array(z.object({ key: z.string().min(1).max(200), value: z.string().max(2_000).default(''), description: z.string().max(2_000).default('') })).max(100).optional(),
  params: z.array(apiParamLikeSchema()).max(100).optional(),
  responses: z.array(z.object({ status: z.number().int().min(100).max(599), contentType: z.string().max(100).default(''), description: z.string().max(5_000).default(''), body: z.string().max(50_000).default('') })).max(50).optional(),
});

function apiParamLikeSchema() {
  return z.object({
    name: z.string().min(1).max(200),
    in: z.enum(['path', 'query', 'header']),
    required: z.boolean().default(false),
    description: z.string().max(2_000).default(''),
  });
}

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
        return toolError(`API endpoint not found: ${args.endpointId}`);
      }
      if (args.collectionId != null && !state.apiCollections.some((c) => c.id === args.collectionId)) {
        return toolError(`API collection not found: ${args.collectionId}`);
      }
      const updated: ApiEndpoint = { ...state.apiEndpoints[index]!, updatedAt: nowIso() };
      applyDefined(updated, {
        collectionId: args.collectionId ?? null,
        method: args.method,
        path: args.path?.trim(),
        name: args.name?.trim(),
        description: args.description,
        headers: args.headers,
        params: args.params,
        responses: args.responses,
      });
      state.apiEndpoints[index] = updated;
      await saveState(args.projectId, state);
      return {
        content: [textContent({ id: args.endpointId, updatedAt: updated.updatedAt })],
      };
    },
  );
}