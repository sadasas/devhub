import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent } from '../entity.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  name: z.string().min(1).max(300).describe('Name of the test case'),
  taskId: z.string().uuid().optional().describe('UUID of the related task, if any'),
  issueId: z.string().uuid().optional().describe('UUID of the related issue, if any'),
  steps: z.string().default('').describe('Steps to verify the behavior'),
  expected: z.string().default('').describe('Expected result'),
  status: z.enum(['pass', 'fail', 'pending']).default('pending'),
  pinned: z.boolean().default(false).describe('Pin the test case so it floats to the top of lists'),
});

export function registerAddTestCase(server: McpServer): void {
  server.registerTool(
    'add_test_case',
    {
      title: 'Add a test case',
      description:
        'Add a checklist test case to a DevHub project, optionally linked to a task or issue, with steps, expected result and status.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const now = nowIso();
      const testCase = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        name: args.name.trim(),
        taskId: args.taskId ?? null,
        issueId: args.issueId ?? null,
        steps: args.steps,
        expected: args.expected,
        status: args.status,
        pinned: args.pinned,
      };
      state.testCases.push(testCase);
      await saveState(args.projectId, state);
      return {
        content: [textContent({ id: testCase.id, name: testCase.name, status: testCase.status, taskId: testCase.taskId ?? null })],
      };
    },
  );
}