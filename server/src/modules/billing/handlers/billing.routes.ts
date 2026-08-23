import { Router } from 'express';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { getBillingOverview, handleWebhook, startCheckout } from '../application/billingService.js';
import { listPublicPackages } from '../application/packagesPublic.js';

/** Webhook Pakasir + daftar paket — TANPA requireAuth. */
export const billingPublicRouter = Router();

billingPublicRouter.post('/webhook', async (req, res) => {
  res.json(await handleWebhook(req.body));
});

billingPublicRouter.get('/packages', async (_req, res) => {
  res.json({ packages: await listPublicPackages() });
});

export const billingRouter = Router();
billingRouter.use(requireAuth);

billingRouter.post('/checkout', async (req, res) => {
  const userId = getUserId(req);
  res.json(await startCheckout(userId, req.body));
});

billingRouter.get('/status/:teamId', async (req, res) => {
  const userId = getUserId(req);
  res.json(await getBillingOverview(userId, req.params.teamId ?? ''));
});
