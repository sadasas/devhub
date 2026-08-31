import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, nowIso, textContent } from '../../domain/entity.js';
import { LIMITS } from '../../../projects/domain/state.js';

const inputSchema = z.object({
  projectId: z.string().uuid().describe('UUID of the target project'),
  issueId: z.string().uuid().describe('UUID of the issue to update'),
  title: z.string().min(1).max(LIMITS.ISSUE_TITLE).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'reproduced', 'fixing', 'resolved', 'wontfix']).optional(),
  description: z.string().max(LIMITS.ISSUE_DESCRIPTION).optional(),
  reproduction: z.string().max(LIMITS.ISSUE_REPRODUCTION).optional(),
  linkedTaskId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().optional().describe('Pin or unpin the issue'),
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
      const issue = findEntity(state.issues, args.issueId, 'Issue');
      applyDefined(issue, {
        title: args.title?.trim(),
        severity: args.severity,
        status: args.status,
        description: args.description,
        reproduction: args.reproduction,
        linkedTaskId: args.linkedTaskId,
        pinned: args.pinned,
      });
      issue.updatedAt = nowIso();
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({
            id: issue.id,
            title: issue.title,
            status: issue.status,
            severity: issue.severity,
            linkedTaskId: issue.linkedTaskId ?? null,
          }),
        ],
      };
    },
  );
}