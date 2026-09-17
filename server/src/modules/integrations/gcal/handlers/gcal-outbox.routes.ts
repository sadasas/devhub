/**
 * Endpoint internal worker GCal (tanpa cron lib baru).
 *
 * - POST /api/v1/integrations/gcal/outbox/process → jalankan processOutbox()
 *   untuk baris due (auth required; aman dipanggil manual / scheduler eksternal).
 * - Cara trigger yang didukung:
 *   a) Interval in-process di server/src/index.ts (default tiap 60s, skip saat test).
 *   b) Manual via endpoint ini (mis. `curl -X POST .../outbox/process?limit=50`
 *      dengan session cookie) atau scheduler eksternal (systemd timer / pg_cron /
 *      CI cron) yang memanggil endpoint yang sama.
 *
 * Respons: { processed, succeeded, failed, pending } (lihat sync-service).
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../auth/middleware/requireAuth.js';
import { processOutbox } from '../application/sync-service.js';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const gcalOutboxRouter = Router();
gcalOutboxRouter.use(requireAuth);

gcalOutboxRouter.post('/outbox/process', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 50;
  const result = await processOutbox(undefined, limit);
  res.json(result);
});

gcalOutboxRouter.get('/outbox/process', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 50;
  const result = await processOutbox(undefined, limit);
  res.json(result);
});
