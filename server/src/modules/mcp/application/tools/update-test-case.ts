import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, nowIso, textContent } from '../../domain/entity.js';
import { LIMITS } from '../../../projects/domain/state.js';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  testCaseId: z.string().describe('UUID of the test case to update'),
  name: z.string().min(1).max(LIMITS.TESTCASE_NAME).optional(),
  taskId: z.string().uuid().nullable().optional().describe('UUID of the related task, or null to clear'),
  issueId: z.string().uuid().nullable().optional().describe('UUID of the related issue, or null to clear'),
  steps: z.string().max(LIMITS.TESTCASE_STEPS).optional(),
  expected: z.string().max(LIMITS.TESTCASE_EXPECTED).optional(),
  status: z.enum(['pass', 'fail', 'pending']).optional(),
  pinned: z.boolean().optional().describe('Pin or unpin the test case'),
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
      const testCase = findEntity(state.testCases, args.testCaseId, 'Test case');
      applyDefined(testCase, {
        name: args.name?.trim(),
        taskId: args.taskId,
        issueId: args.issueId,
        steps: args.steps,
        expected: args.expected,
        status: args.status,
        pinned: args.pinned,
      });
      testCase.updatedAt = nowIso();
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({ id: testCase.id, name: testCase.name, status: testCase.status, taskId: testCase.taskId ?? null }),
        ],
      };
    },
  );
}