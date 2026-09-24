import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { ApiError } from "../../../../shared/errors.js";
import { handleWebhook } from "../application/webhook-service.js";

/**
 * Webhook publik GitHub (tanpa sesi — verifikasi HMAC sha256 + dedupe
 * X-GitHub-Delivery). Mount di app.ts dengan express.raw SEBELUM
 * express.json agar HMAC dihitung dari bytes persis yang dikirim GitHub.
 */

export const githubWebhookRouter = Router();

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: "RATE_LIMITED", message: "Too many webhook deliveries" } },
});

githubWebhookRouter.use(webhookLimiter);

githubWebhookRouter.post("/", async (req: Request, res: Response) => {
  const event = req.header("x-github-event") ?? "";
  const deliveryId = req.header("x-github-delivery") ?? "";
  if (!event || !deliveryId) {
    throw new ApiError(400, "GITHUB_BAD_PAYLOAD", "Missing GitHub event headers");
  }
  if (!Buffer.isBuffer(req.body)) {
    throw new ApiError(500, "INTERNAL", "Webhook raw body unavailable");
  }
  const result = await handleWebhook({
    event,
    deliveryId,
    raw: req.body as Buffer,
    signature: req.header("x-hub-signature-256") ?? undefined,
  });
  res.json({ ok: true, ...result });
});
