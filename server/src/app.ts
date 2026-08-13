import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { pool } from './db/pool.js';
import { authRouter } from './api/auth.routes.js';
import { projectsRouter } from './api/projects.routes.js';
import { teamsRouter } from './api/teams.routes.js';
import { keysRouter } from './api/keys.routes.js';
import { publicRouter } from './api/public.routes.js';
import { mcpRouter } from './mcp/server.js';
import { requireMcpKey } from './mcp/require-key.js';
import { entityRouter } from './api/v1/entity-router.js';

export const SESSION_COOKIE = 'devhub_session';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

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
  req: Request,
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
  logger.error('Unhandled error', {
    requestId: req.id,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
  });
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

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('http request', {
      requestId: id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
    });
  });
  next();
}

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.NODE_ENV === 'test' || config.TRUST_PROXY) {
    app.set('trust proxy', true);
  }
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      strictTransportSecurity: config.NODE_ENV === 'production' ? { maxAge: 15_552_000 } : false,
    }),
  );
  if (config.CORS_ORIGIN.length > 0) {
    app.use(
      cors({
        origin: config.CORS_ORIGIN,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      }),
    );
  }
  app.use(requestLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use('/api/v1', limiter);

  app.get('/api/v1/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'unreachable', uptime: process.uptime() });
    }
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/projects', entityRouter);
  app.use('/api/v1/teams', teamsRouter);
  app.use('/api/v1/keys', keysRouter);
  app.use('/api/v1/public', publicRouter);

  app.use('/mcp', mcpLimiter);
  app.use('/mcp', requireMcpKey);
  app.use('/mcp', mcpRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
