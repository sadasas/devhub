import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { logger } from './shared/logger.js';
import { ApiError } from './shared/errors.js';
import { getBaseUrl } from './shared/baseUrl.js';
import { pool } from './db/pool.js';
import { authRouter } from './modules/auth/handlers/auth.routes.js';
import { projectsRouter } from './modules/projects/handlers/projects.routes.js';
import { teamsRouter } from './modules/teams/handlers/teams.routes.js';
import { chatRouter } from './modules/teams/handlers/chat.routes.js';
import { keysRouter } from './modules/keys/handlers/keys.routes.js';
import { publicRouter } from './modules/public/handlers/public.routes.js';
import { templatesRouter } from './modules/templates/handlers/templates.routes.js';
import { mcpRouter } from './modules/mcp/handlers/server.js';
import { requireMcpKey } from './modules/mcp/handlers/require-key.js';
import { hashMcpKey } from './modules/keys/infrastructure/keys.js';
import { oauthRouter } from './modules/oauth/oauth.routes.js';
import { entityRouter } from './modules/projects/handlers/v1/entity-router.js';
import { searchRouter } from './modules/search/handlers/v1/search.routes.js';
import { activityRouter } from './modules/activity/handlers/v1/activity.routes.js';
import { adminRouter } from './modules/admin/handlers/admin.routes.js';
import { billingPublicRouter, billingRouter } from './modules/billing/handlers/billing.routes.js';
import { socialRouter } from './modules/auth/handlers/social.routes.js';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
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
    // RFC9728: MCP 401 should hint resource_metadata for OAuth discovery
    if (err.status === 401 && req.path.startsWith('/mcp')) {
      const base = getBaseUrl(req);
      res.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      );
    }
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }
  const status = typeof err === 'object' && err !== null
    ? ((err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode)
    : undefined;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const tooLarge = (err as { type?: unknown }).type === 'entity.too.large' || status === 413;
    res.status(status).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: tooLarge ? 'Request payload too large' : ((err as Error)?.message ?? 'Invalid request'),
      },
    });
    return;
  }
  // Mapping SQLSTATE PostgreSQL → HTTP (audit 2026-08b, DB-4):
  // mencegah 500 mentah untuk 22P02 (bad uuid), 23503 (FK), 23505 (unique), 23514 (CHECK).
  const pgCode = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  if (typeof pgCode === 'string' && /^[0-9A-Z]{5}$/.test(pgCode)) {
    const map: Record<string, { status: number; code: string; message: string }> = {
      '22P02': { status: 404, code: 'NOT_FOUND', message: 'Invalid identifier' },
      '23503': { status: 409, code: 'CONFLICT', message: 'Referenced record is still in use' },
      '23505': { status: 409, code: 'CONFLICT', message: 'Duplicate value violates a unique constraint' },
      '23514': { status: 400, code: 'VALIDATION_ERROR', message: 'Value violates a database constraint' },
    };
    const mapped = map[pgCode];
    if (mapped) {
      logger.warn('PostgreSQL error mapped to HTTP', {
        requestId: req.id,
        pgCode,
        path: req.path,
      });
      res.status(mapped.status).json({ error: mapped });
      return;
    }
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
  validate: { trustProxy: false },
});

const mcpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many MCP requests, try again later' } },
});

// Limiter per-key MCP (audit 2026-08b, MCP-4): membatasi per API key, bukan hanya per IP.
const mcpKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => {
    const auth = req.headers.authorization ?? '';
    const key = auth.startsWith('Bearer ') ? hashMcpKey(auth.slice(7)) : '';
    return key ? `key:${key}` : `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;
  },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many MCP requests for this key, try again later' } },
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
      path: req.path,
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
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  // OAuth discovery + DCR + authorize/token (must be before MCP, no auth)
  app.use(oauthRouter);
  app.use('/api/v1', limiter);
  app.use('/api/v1', oauthRouter);

  app.get('/api/v1/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'unreachable', uptime: process.uptime() });
    }
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/auth', socialRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/projects', entityRouter);
  app.use('/api/v1/projects', activityRouter);
  app.use('/api/v1/teams', teamsRouter);
  app.use('/api/v1/teams', chatRouter);
  app.use('/api/v1/keys', keysRouter);
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/templates', templatesRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/billing', billingPublicRouter);
  app.use('/api/v1/billing', billingRouter);

  app.use('/mcp', mcpLimiter);
  app.use('/mcp', requireMcpKey);
  app.use('/mcp', mcpKeyLimiter);
  app.use('/mcp', mcpRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}


