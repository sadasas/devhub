import { z } from 'zod';
import { parseOrThrow } from '../../../shared/db.js';
import { config } from '../../../config.js';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../../shared/errors.js';
import { assertAdmin, getTeamWithRole } from '../../authorization/application/authz.js';
import { PAKASIR_PAY_BASE } from '../domain/billing.js';
import {
  findActivePackage,
  findActivePrice,
  findPaymentByOrderId,
  insertPendingPayment,
  listPaymentsByUser,
  listTeamPayments,
  markPaymentCompleted,
} from '../infrastructure/billingRepository.js';
import { activateTeamPackage, getEffectiveUsage } from '../../plans/application/quotaService.js';

const checkoutSchema = z.object({
  teamId: z.string().uuid(),
  packageId: z.string().uuid(),
  priceId: z.string().uuid(),
});

const webhookSchema = z.object({
  order_id: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  status: z.string().optional(),
});

function requirePakasirConfigured(): void {
  if (!config.PAKASIR_ENABLED || !config.PAKASIR_SLUG || !config.PAKASIR_API_KEY) {
    throw new ApiError(403, 'BILLING_DISABLED', 'Billing is not available yet');
  }
}

export interface CheckoutResult {
  orderId: string;
  url: string;
  amount: number;
  packageName: string;
  durationDays: number;
}

export async function startCheckout(userId: string, body: unknown): Promise<CheckoutResult> {
  requirePakasirConfigured();
  const { teamId, packageId, priceId } = parseOrThrow(checkoutSchema, body, 'Invalid checkout data');
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertAdmin(row.role);

  const pkg = await findActivePackage(packageId);
  if (!pkg) throw new ApiError(404, 'NOT_FOUND', 'Package not found');
  if (pkg.is_free) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The Free plan does not require a purchase');
  }
  const price = await findActivePrice(priceId, packageId);
  if (!price) throw new ApiError(404, 'NOT_FOUND', 'Price option not found');

  const orderId = `DH-${randomUUID()}`;
  await insertPendingPayment({
    teamId,
    orderId,
    packageId: pkg.id,
    packageName: pkg.name,
    durationDays: price.duration_days,
    amount: price.price_idr,
    createdBy: userId,
  });

  let url = `${PAKASIR_PAY_BASE}/pay/${config.PAKASIR_SLUG}/${price.price_idr}?order_id=${encodeURIComponent(orderId)}`;
  if (config.APP_PUBLIC_URL) {
    url += `&redirect=${encodeURIComponent(`${config.APP_PUBLIC_URL.replace(/\/$/, '')}/billing/${teamId}`)}`;
  }
  return {
    orderId,
    url,
    amount: price.price_idr,
    packageName: pkg.name,
    durationDays: price.duration_days,
  };
}

interface PakasirTransaction {
  transaction?: { status?: string; amount?: number; order_id?: string };
}

/** Webhook Pakasir tidak bertanda tangan — verifikasi wajib server-to-server. */
async function verifyWithPakasir(orderId: string, amount: number): Promise<boolean> {
  const url =
    `${PAKASIR_PAY_BASE}/api/transactiondetail?project=${encodeURIComponent(config.PAKASIR_SLUG)}` +
    `&amount=${amount}&order_id=${encodeURIComponent(orderId)}` +
    `&api_key=${encodeURIComponent(config.PAKASIR_API_KEY)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = (await res.json()) as PakasirTransaction;
    return (
      data.transaction?.status === 'completed' &&
      data.transaction.amount === amount &&
      data.transaction.order_id === orderId
    );
  } catch {
    return false;
  }
}

export async function handleWebhook(body: unknown): Promise<{ ok: boolean }> {
  // Payload tak dikenal / mismatch tetap 200 — jangan bocorkan keberadaan order.
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) return { ok: true };
  const { order_id, amount } = parsed.data;

  const payment = await findPaymentByOrderId(order_id);
  if (!payment || payment.amount !== amount) return { ok: true };
  if (payment.status === 'completed') return { ok: true };

  requirePakasirConfigured();
  if (!(await verifyWithPakasir(order_id, payment.amount))) return { ok: false };

  const completed = await markPaymentCompleted(order_id);
  if (completed && completed.package_id && completed.duration_days) {
    await activateTeamPackage(completed.team_id, completed.package_id, completed.duration_days);
  }
  return { ok: true };
}

function serializePayment(row: {
  order_id: string;
  package_name: string;
  duration_days: number | null;
  amount: number;
  status: string;
  created_at: Date;
  completed_at: Date | null;
  team_name?: string;
}) {
  return {
    orderId: row.order_id,
    packageName: row.package_name,
    durationDays: row.duration_days,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    ...(row.team_name !== undefined ? { teamName: row.team_name } : {}),
  };
}

export async function getBillingOverview(userId: string, teamId: string) {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');

  const usage = await getEffectiveUsage(teamId);
  const plan = usage?.plan ?? 'free';
  const payments = await listTeamPayments(teamId);

  return {
    team: {
      id: row.id,
      name: row.name,
      plan,
      planPackageName: usage?.packageName ?? 'Free',
      planExpiresAt: row.plan_expires_at ? row.plan_expires_at.toISOString() : null,
    },
    usage: {
      members: {
        used: usage?.memberCount ?? 0,
        limit: usage?.memberLimit ?? null,
      },
      projects: {
        used: usage?.projectCount ?? 0,
        limit: usage?.projectLimit ?? null,
      },
    },
    payments: payments.map(serializePayment),
  };
}

export async function getPaymentHistory(userId: string) {
  const payments = await listPaymentsByUser(userId);
  return { payments: payments.map(serializePayment) };
}
