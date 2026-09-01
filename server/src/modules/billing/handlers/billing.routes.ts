import { Router } from 'express';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { cancelPayment, cancelScheduledDowngrade, getBillingOverview, getPayment, getPaymentHistory, handleWebhook, resumePayment, startCheckout } from '../application/billingService.js';
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

billingRouter.get('/resume/:orderId', async (req, res) => {
  const userId = getUserId(req);
  res.json(await resumePayment(userId, req.params.orderId ?? ''));
});

billingRouter.post('/cancel/:orderId', async (req, res) => {
  const userId = getUserId(req);
  res.json(await cancelPayment(userId, req.params.orderId ?? ''));
});

billingRouter.get('/status/:teamId', async (req, res) => {
  const userId = getUserId(req);
  res.json(await getBillingOverview(userId, req.params.teamId ?? ''));
});

billingRouter.post('/scheduled/cancel', async (req, res) => {
  const userId = getUserId(req);
  const body = req.body as { teamId?: string } | undefined;
  const teamId = body?.teamId ?? '';
  if (!teamId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'teamId required' } });
    return;
  }
  res.json(await cancelScheduledDowngrade(userId, teamId));
});

billingRouter.get('/payments', async (req, res) => {
  const userId = getUserId(req);
  res.json(await getPaymentHistory(userId));
});

billingRouter.get('/payments/:orderId', async (req, res) => {
  const userId = getUserId(req);
  res.json(await getPayment(userId, req.params.orderId ?? ''));
});
