import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent } from '../entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  title: z.string().min(1).max(500),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  status: z.enum(['open', 'reproduced', 'fixing', 'resolved', 'wontfix']).default('open'),
  description: z.string().default(''),
  reproduction: z.string().default(''),
  linkedTaskId: z.string().uuid().optional(),
  pinned: z.boolean().default(false).describe('Pin the issue so it floats to the top of lists'),
});

export function registerAddIssue(server: McpServer): void {
  server.registerTool(
    'add_issue',
    {
      title: 'Add an issue',
      description:
        'File a bug or issue in a DevHub project with severity, status and reproduction steps.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const now = nowIso();
      const issue = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        title: args.title.trim(),
        severity: args.severity,
        status: args.status,
        description: args.description,
        reproduction: args.reproduction,
        linkedTaskId: args.linkedTaskId ?? null,
        pinned: args.pinned,
      };
      state.issues.push(issue);
      await saveState(args.projectId, state);
      return {
        content: [textContent({ id: issue.id, title: issue.title, severity: issue.severity })],
      };
    },
  );
}