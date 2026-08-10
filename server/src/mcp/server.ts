import { Router } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { runMcpUser } from './context.js';
import { registerProjectState } from './tools/project-state.js';
import { registerPlanProject } from './tools/plan-project.js';
import { registerCreateTask } from './tools/create-task.js';
import { registerUpdateTask } from './tools/update-task.js';
import { registerAddIssue } from './tools/add-issue.js';
import { registerAddDecision } from './tools/add-decision.js';
import { registerUpdateMilestone } from './tools/update-milestone.js';
import { registerAddTable } from './tools/add-table.js';
import { registerAddRelation } from './tools/add-relation.js';
import { registerAddTech } from './tools/add-tech.js';

export const mcpServer = new McpServer({ name: 'devhub', version: '0.1.0' });

registerProjectState(mcpServer);
registerPlanProject(mcpServer);
registerCreateTask(mcpServer);
registerUpdateTask(mcpServer);
registerAddIssue(mcpServer);
registerAddDecision(mcpServer);
registerUpdateMilestone(mcpServer);
registerAddTable(mcpServer);
registerAddRelation(mcpServer);
registerAddTech(mcpServer);

export const mcpRouter = Router();

mcpRouter.post('/mcp', async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid MCP API key' } });
    return;
  }
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
