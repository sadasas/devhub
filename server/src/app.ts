import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { authRouter } from './api/auth.routes.js';
import { projectsRouter } from './api/projects.routes.js';
import { teamsRouter } from './api/teams.routes.js';
import { keysRouter } from './api/keys.routes.js';
import { publicRouter } from './api/public.routes.js';
import { mcpRouter } from './mcp/server.js';
import { requireMcpKey } from './mcp/require-key.js';

export const SESSION_COOKIE = 'devhub_session';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }
  const status = typeof err === 'object' && err !== null
    ? ((err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode)
    : undefined;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({
      error: { code: 'BAD_REQUEST', message: (err as Error)?.message ?? 'Invalid request' },
    });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const mcpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many MCP requests, try again later' } },
});

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.NODE_ENV === 'test' || config.TRUST_PROXY) {
    app.set('trust proxy', true);
  }
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use('/api', limiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/keys', keysRouter);
  app.use('/api/public', publicRouter);

  app.use('/mcp', mcpLimiter);
  app.use('/mcp', requireMcpKey);
  app.use('/mcp', mcpRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
