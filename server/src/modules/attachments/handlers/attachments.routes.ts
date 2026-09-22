import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { parseOrThrow } from '../../../shared/db.js';
import {
  confirmAttachmentSchema,
  linkAttachmentSchema,
  signUploadSchema,
} from '../domain/attachment.js';
import {
  abandonUpload,
  addLink,
  confirmAttachment,
  reconcileTeamStorage,
  removeAttachment,
  signDownload,
  signUpload,
} from '../application/attachmentService.js';

export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);

const signLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many upload requests, try again later' } },
});

attachmentsRouter.post('/sign-upload', signLimiter, async (req, res) => {
  const userId = getUserId(req);
  const input = parseOrThrow(signUploadSchema, req.body, 'Invalid upload data');
  res.json(await signUpload(userId, input));
});

attachmentsRouter.post('/confirm', async (req, res) => {
  const userId = getUserId(req);
  const input = parseOrThrow(confirmAttachmentSchema, req.body, 'Invalid attachment data');
  res.status(201).json(await confirmAttachment(userId, input));
});

attachmentsRouter.post('/link', async (req, res) => {
  const userId = getUserId(req);
  const input = parseOrThrow(linkAttachmentSchema, req.body, 'Invalid link data');
  res.status(201).json(await addLink(userId, input));
});

attachmentsRouter.get('/sign-download', async (req, res) => {
  const userId = getUserId(req);
  const projectId = String(req.query.projectId ?? '');
  const attachmentId = String(req.query.attachmentId ?? '');
  if (!projectId || !attachmentId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'projectId and attachmentId are required' } });
    return;
  }
  res.json(await signDownload(userId, projectId, attachmentId));
});

attachmentsRouter.delete('/:projectId/:entity/:entityId/:attachmentId', async (req, res) => {
  const userId = getUserId(req);
  const entity = req.params.entity;
  if (entity !== 'tasks' && entity !== 'issues') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown entity' } });
    return;
  }
  res.json(
    await removeAttachment(userId, req.params.projectId, entity, req.params.entityId, req.params.attachmentId),
  );
});

attachmentsRouter.post('/reconcile', async (req, res) => {
  const userId = getUserId(req);
  const teamId = String((req.body as { teamId?: unknown } | undefined)?.teamId ?? '');
  if (!teamId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'teamId is required' } });
    return;
  }
  res.json(await reconcileTeamStorage(userId, teamId));
});

attachmentsRouter.post('/abandon', signLimiter, async (req, res) => {
  const userId = getUserId(req);
  const body = (req.body ?? {}) as { projectId?: unknown; storageKey?: unknown };
  const projectId = String(body.projectId ?? '');
  const storageKey = String(body.storageKey ?? '');
  if (!projectId || !storageKey) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'projectId and storageKey are required' } });
    return;
  }
  res.json(await abandonUpload(userId, projectId, storageKey));
});
