/**
 * Endpoint internal worker mail outbox (tanpa cron lib baru).
 *
 * - POST /api/v1/mail/outbox/process → jalankan processMailOutbox()
 *   (auth required; aman dipanggil manual / scheduler eksternal).
 * - Cara trigger yang didukung:
 *   a) Interval in-process di server/src/index.ts (default tiap 60s, skip saat
 *      test, skip saat MAIL_ENABLED=false).
 *   b) Manual via endpoint ini atau scheduler eksternal.
 *
 * Respons: { processed, succeeded, failed, pending } (lihat outbox).
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { processMailOutbox } from '../outbox.js';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const mailOutboxRouter = Router();
mailOutboxRouter.use(requireAuth);

mailOutboxRouter.post('/outbox/process', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 50;
  res.json(await processMailOutbox(undefined, limit));
});

mailOutboxRouter.get('/outbox/process', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 50;
  res.json(await processMailOutbox(undefined, limit));
});
