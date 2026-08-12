import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  testCaseId: z.string().describe('UUID of the test case to update'),
  name: z.string().min(1).max(300).optional(),
  taskId: z.string().uuid().nullable().optional().describe('UUID of the related task, or null to clear'),
  issueId: z.string().uuid().nullable().optional().describe('UUID of the related issue, or null to clear'),
  steps: z.string().optional(),
  expected: z.string().optional(),
  status: z.enum(['pass', 'fail', 'pending']).optional(),
});

export function registerUpdateTestCase(server: McpServer): void {
  server.registerTool(
    'update_test_case',
    {
      title: 'Update a test case',
      description:
        'Change a test case in a DevHub project: name, linked task/issue, steps, expected result or status (pass/fail/pending).',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const testCase = state.testCases.find((t) => t.id === args.testCaseId);
      if (!testCase) {
        throw new McpError(ErrorCode.InvalidParams, `Test case not found: ${args.testCaseId}`);
      }
      if (args.name !== undefined) testCase.name = args.name.trim();
      if (args.taskId !== undefined) testCase.taskId = args.taskId;
      if (args.issueId !== undefined) testCase.issueId = args.issueId;
      if (args.steps !== undefined) testCase.steps = args.steps;
      if (args.expected !== undefined) testCase.expected = args.expected;
      if (args.status !== undefined) testCase.status = args.status;
      testCase.updatedAt = new Date().toISOString();
      await saveState(args.projectId, state);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { id: testCase.id, name: testCase.name, status: testCase.status, taskId: testCase.taskId ?? null },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}