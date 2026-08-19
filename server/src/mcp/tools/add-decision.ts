import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent } from '../entity.js';
import { isoDate, LIMITS } from '../../schema/state.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  title: z.string().min(1).max(LIMITS.DECISION_TITLE),
  status: z.enum(['proposed', 'accepted', 'rejected', 'superseded']).default('proposed'),
  date: isoDate.default(new Date().toISOString().slice(0, 10)).describe('Decision date YYYY-MM-DD'),
  context: z.string().max(LIMITS.DECISION_CONTEXT).default(''),
  options: z.array(z.string().max(LIMITS.DECISION_OPTION)).max(LIMITS.DECISION_OPTIONS).default([]),
  decision: z.string().max(LIMITS.DECISION_TEXT).default(''),
  consequences: z.string().max(LIMITS.DECISION_CONSEQUENCES).default(''),
  pinned: z.boolean().default(false).describe('Pin the decision so it floats to the top of lists'),
});

export function registerAddDecision(server: McpServer): void {
  server.registerTool(
    'add_decision',
    {
      title: 'Add a decision',
      description:
        'Record an architecture decision (ADR) in a DevHub project: context, options considered, the decision and its consequences.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const now = nowIso();
      const decision = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        title: args.title.trim(),
        status: args.status,
        date: args.date,
        context: args.context,
        options: args.options,
        decision: args.decision,
        consequences: args.consequences,
        pinned: args.pinned,
      };
      state.decisions.push(decision);
      await saveState(args.projectId, state);
      return {
        content: [textContent({ id: decision.id, title: decision.title, status: decision.status })],
      };
    },
  );
}