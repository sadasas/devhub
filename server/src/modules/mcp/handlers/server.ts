import { Router } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { runMcpUser } from '../application/context.js';
import { registerProjectState } from '../application/tools/project-state.js';
import { registerUpdatePrd } from '../application/tools/update-prd.js';
import { registerPlanProject } from '../application/tools/plan-project.js';
import { registerCreateTask } from '../application/tools/create-task.js';
import { registerUpdateTask } from '../application/tools/update-task.js';
import { registerAddIssue } from '../application/tools/add-issue.js';
import { registerUpdateIssue } from '../application/tools/update-issue.js';
import { registerAddTestCase } from '../application/tools/add-test-case.js';
import { registerUpdateTestCase } from '../application/tools/update-test-case.js';
import { registerAddDecision } from '../application/tools/add-decision.js';
import { registerAddMilestone } from '../application/tools/add-milestone.js';
import { registerUpdateMilestone } from '../application/tools/update-milestone.js';
import { registerAddTable } from '../application/tools/add-table.js';
import { registerAddRelation } from '../application/tools/add-relation.js';
import { registerDeleteRelation } from '../application/tools/delete-relation.js';
import { registerAddTech } from '../application/tools/add-tech.js';
import { registerAddApiCollection } from '../application/tools/add-api-collection.js';
import { registerAddApiEndpoint } from '../application/tools/add-api-endpoint.js';
import { registerUpdateApiEndpoint } from '../application/tools/update-api-endpoint.js';
import { registerCreateWhiteboard } from '../application/tools/create-whiteboard.js';
import { registerUpdateWhiteboard } from '../application/tools/update-whiteboard.js';

export const mcpRouter = Router();

// MCP stateless POST-only (audit 2026-08b, MCP-5): GET/SSE tidak didukung —
// 405 dengan Allow header, bukan 404 yang menyesatkan.
mcpRouter.get('/', (_req, res) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'MCP streamable HTTP supports POST only (stateless mode)' },
  });
});

mcpRouter.post('/', async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid MCP API key' } });
    return;
  }
  const mcpServer = new McpServer({ name: 'devhub', version: '0.1.0' });
  registerProjectState(mcpServer);
  registerUpdatePrd(mcpServer);
  registerPlanProject(mcpServer);
  registerCreateTask(mcpServer);
  registerUpdateTask(mcpServer);
  registerAddIssue(mcpServer);
  registerUpdateIssue(mcpServer);
  registerAddTestCase(mcpServer);
  registerUpdateTestCase(mcpServer);
  registerAddDecision(mcpServer);
  registerAddMilestone(mcpServer);
  registerUpdateMilestone(mcpServer);
  registerAddTable(mcpServer);
  registerAddRelation(mcpServer);
  registerDeleteRelation(mcpServer);
  registerAddTech(mcpServer);
  registerAddApiCollection(mcpServer);
  registerAddApiEndpoint(mcpServer);
  registerUpdateApiEndpoint(mcpServer);
  registerCreateWhiteboard(mcpServer);
  registerUpdateWhiteboard(mcpServer);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await mcpServer.connect(transport);
    await runMcpUser(userId, () =>
      transport.handleRequest(
        req as never as Parameters<typeof transport.handleRequest>[0],
        res as never as Parameters<typeof transport.handleRequest>[1],
        req.body,
      ),
    );
  } finally {
    await mcpServer.close().catch(() => {});
  }
});
