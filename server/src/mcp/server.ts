import { Router } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { runMcpUser } from './context.js';
import { registerProjectState } from './tools/project-state.js';
import { registerUpdatePrd } from './tools/update-prd.js';
import { registerPlanProject } from './tools/plan-project.js';
import { registerCreateTask } from './tools/create-task.js';
import { registerUpdateTask } from './tools/update-task.js';
import { registerAddIssue } from './tools/add-issue.js';
import { registerUpdateIssue } from './tools/update-issue.js';
import { registerAddTestCase } from './tools/add-test-case.js';
import { registerUpdateTestCase } from './tools/update-test-case.js';
import { registerAddDecision } from './tools/add-decision.js';
import { registerAddMilestone } from './tools/add-milestone.js';
import { registerUpdateMilestone } from './tools/update-milestone.js';
import { registerAddTable } from './tools/add-table.js';
import { registerAddRelation } from './tools/add-relation.js';
import { registerDeleteRelation } from './tools/delete-relation.js';
import { registerAddTech } from './tools/add-tech.js';
import { registerAddApiCollection } from './tools/add-api-collection.js';
import { registerAddApiEndpoint } from './tools/add-api-endpoint.js';
import { registerUpdateApiEndpoint } from './tools/update-api-endpoint.js';
import { registerCreateWhiteboard } from './tools/create-whiteboard.js';
import { registerUpdateWhiteboard } from './tools/update-whiteboard.js';

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
