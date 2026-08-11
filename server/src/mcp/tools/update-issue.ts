import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  issueId: z.string().describe('UUID of the issue to update'),
  title: z.string().min(1).max(500).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'reproduced', 'fixing', 'resolved', 'wontfix']).optional(),
  reproduction: z.string().optional(),
  linkedTaskId: z.string().uuid().nullable().optional().describe('UUID of a related task, or null to clear'),
});

export function registerUpdateIssue(server: McpServer): void {
  server.registerTool(
    'update_issue',
    {
      title: 'Update an issue',
      description:
        'Change a bug or issue in a DevHub project: status, severity, title, reproduction steps or linked task. Agents should call this after fixing an issue (e.g. status: "resolved").',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const issue = state.issues.find((i) => i.id === args.issueId);
      if (!issue) {
        throw new McpError(ErrorCode.InvalidParams, `Issue not found: ${args.issueId}`);
      }
      if (args.title !== undefined) issue.title = args.title.trim();
      if (args.severity !== undefined) issue.severity = args.severity;
      if (args.status !== undefined) issue.status = args.status;
      if (args.reproduction !== undefined) issue.reproduction = args.reproduction;
      if (args.linkedTaskId !== undefined) issue.linkedTaskId = args.linkedTaskId;
      issue.updatedAt = new Date().toISOString();
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { id: issue.id, title: issue.title, status: issue.status, severity: issue.severity, linkedTaskId: issue.linkedTaskId ?? null },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}