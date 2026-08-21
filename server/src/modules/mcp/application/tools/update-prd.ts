import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { updatePrd } from '../state-db.js';
import { textContent } from '../../domain/entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  purpose: z.string().max(5_000).describe('Why the project exists and what problem it solves').optional(),
  goals: z.string().max(5_000).describe('Key goals the project should achieve').optional(),
  features: z.string().max(5_000).describe('Planned or in-scope features').optional(),
  scope: z.string().max(5_000).describe('What is included in scope').optional(),
  outOfScope: z.string().max(5_000).describe('What is explicitly out of scope').optional(),
});

export function registerUpdatePrd(server: McpServer): void {
  server.registerTool(
    'update_prd',
    {
      title: 'Update project PRD',
      description:
        'Edit the product brief (PRD) of a DevHub project: purpose, goals, features, scope or out-of-scope. Only the sections you provide change; pass an empty string to clear a section. Read the current PRD first with project_state. All text fields support markdown: "- bullet, 1. numbered, **bold**, _italic_, `code`", which the app renders on the About tab.',
      inputSchema,
    },
    async (args) => {
      const prd = await updatePrd(args.projectId, {
        purpose: args.purpose,
        goals: args.goals,
        features: args.features,
        scope: args.scope,
        outOfScope: args.outOfScope,
      });
      return { content: [textContent(prd)] };
    },
  );
}
