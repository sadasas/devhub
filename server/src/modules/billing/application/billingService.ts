import { z } from 'zod';
import { parseOrThrow } from '../../../shared/db.js';
import { pool } from '../../../db/pool.js';
import { config } from '../../../config.js';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../../shared/errors.js';
import { assertAdmin, getTeamWithRole } from '../../authorization/application/authz.js';
import { PAKASIR_PAY_BASE, type TeamPaymentRow } from '../domain/billing.js';
import {
  cancelPendingPayment,
  findActivePackage,
  findActivePrice,
  findPaymentByOrderId,
  insertPendingPayment,
  listPaymentsByUser,
  listTeamPayments,
  markPaymentCompleted,
} from '../infrastructure/billingRepository.js';
import { activateTeamPackage, getEffectiveUsage } from '../../plans/application/quotaService.js';
import { isDowngrade, PLAN_LIMIT_CODE } from '../../plans/domain/plans.js';

const checkoutSchema = z.object({
  teamId: z.string().uuid(),
  packageId: z.string().uuid(),
  priceId: z.string().uuid(),
});

const webhookSchema = z.object({
  order_id: z.string().min(1).max(100),
  amount: z.coerce.number().int().positive(),
  status: z.string().max(20).optional(),
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

  // B2: cabang renewal/upgrade/downgrade + validasi over-limit untuk downgrade
  // isSame = paket sama → stack instan; isDowngrade = target limit < cur limit (null=infinity)
  const usage = await getEffectiveUsage(teamId);
  const teamResForCheckout = await pool.query<{ plan_package_id: string | null; plan_expires_at: Date | null }>(
    'SELECT plan_package_id, plan_expires_at FROM teams WHERE id = $1',
    [teamId],
  );
  let curPackageId: string | null = null;
  const trCheckout = teamResForCheckout.rows[0];
  if (trCheckout?.plan_package_id && (trCheckout.plan_expires_at === null || new Date(trCheckout.plan_expires_at as unknown as string) > new Date())) {
    curPackageId = trCheckout.plan_package_id;
  }
  const isSameCheckout = curPackageId !== null && curPackageId === pkg.id;
  const curLimitsCheckout = { maxMembers: usage?.memberLimit ?? null, maxProjects: usage?.projectLimit ?? null };
  const isDowngradeCheckout = !isSameCheckout && isDowngrade(curLimitsCheckout, pkg);
  if (isDowngradeCheckout && usage) {
    const overMembers = pkg.max_members !== null && usage.memberCount > pkg.max_members;
    const overProjects = pkg.max_projects !== null && usage.projectCount > pkg.max_projects;
    if (overMembers || overProjects) {
      const resource: 'members' | 'projects' = overMembers ? 'members' : 'projects';
      const limit = resource === 'members' ? pkg.max_members! : pkg.max_projects!;
      const used = resource === 'members' ? usage.memberCount : usage.projectCount;
      throw new ApiError(402, PLAN_LIMIT_CODE, `Downgrade blocked: workspace exceeds target ${resource} limit`, {
        resource,
        limit,
        used,
        pendingPackageName: pkg.name,
      });
    }
  }

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
    let origin: string;
    try {
      origin = new URL(config.APP_PUBLIC_URL).origin;
    } catch {
      origin = (config.APP_PUBLIC_URL.split(/[?#]/)[0] ?? config.APP_PUBLIC_URL).replace(/\/$/, '');
    }
    const redirect = `${origin}/billing/${teamId}?orderId=${encodeURIComponent(orderId)}`;
    url += `&redirect=${encodeURIComponent(redirect)}`;
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

/** Pembuat pembayaran boleh lanjut/batalkan; admin tim juga; orang luar → 404 (anti-enumeration). */
async function assertPaymentAccess(userId: string, payment: TeamPaymentRow): Promise<void> {
  if (payment.created_by === userId) return;
  const row = await getTeamWithRole(userId, payment.team_id);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
  assertAdmin(row.role);
}

function requirePending(payment: TeamPaymentRow): void {
  if (payment.status !== 'pending') {
    throw new ApiError(409, 'CONFLICT', `Payment is already ${payment.status}`);
  }
}

export async function resumePayment(userId: string, orderId: string): Promise<{ url: string }> {
  const payment = await findPaymentByOrderId(orderId);
  if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
  await assertPaymentAccess(userId, payment);
  requirePending(payment);
  requirePakasirConfigured();

  let url = `${PAKASIR_PAY_BASE}/pay/${config.PAKASIR_SLUG}/${payment.amount}?order_id=${encodeURIComponent(orderId)}`;
  if (config.APP_PUBLIC_URL) {
    let origin: string;
    try {
      origin = new URL(config.APP_PUBLIC_URL).origin;
    } catch {
      origin = (config.APP_PUBLIC_URL.split(/[?#]/)[0] ?? config.APP_PUBLIC_URL).replace(/\/$/, '');
    }
    const redirect = `${origin}/billing/${payment.team_id}?orderId=${encodeURIComponent(orderId)}`;
    url += `&redirect=${encodeURIComponent(redirect)}`;
  }
  return { url };
}

export async function cancelPayment(userId: string, orderId: string): Promise<{ ok: boolean }> {
  const payment = await findPaymentByOrderId(orderId);
  if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
  await assertPaymentAccess(userId, payment);
  requirePending(payment);
  await cancelPendingPayment(orderId);
  return { ok: true };
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
  // Idempoten: kedua kalinya markPaymentCompleted return null → skip aktivasi
  if (!completed || !completed.package_id || !completed.duration_days) {
    return { ok: true };
  }
  const teamId = completed.team_id;
  const packageId = completed.package_id;
  const duration = completed.duration_days;

  // Ambil target paket untuk tentukan downgrade (pakai query langsung agar tetap bisa meski is_active=false pasca-checkout)
  const targetRes = await pool.query<{ id: string; name: string; max_members: number | null; max_projects: number | null; is_free: boolean }>(
    'SELECT id, name, max_members, max_projects, is_free FROM billing_packages WHERE id = $1',
    [packageId],
  );
  const targetPkg = targetRes.rows[0];
  if (!targetPkg) return { ok: true };

  // Load usage efektif setelah lazy-activation (getEffectiveUsage sudah menangani pending expiry)
  const usage = await getEffectiveUsage(teamId);
  // Fresh team row setelah lazy-activation untuk tentukan curPackageId & permanent bypass
  const teamRes = await pool.query<{ plan_package_id: string | null; plan_expires_at: Date | null }>(
    'SELECT plan_package_id, plan_expires_at FROM teams WHERE id = $1',
    [teamId],
  );
  const tr = teamRes.rows[0];
  let curPackageId: string | null = null;
  if (tr?.plan_package_id && (tr.plan_expires_at === null || new Date(tr.plan_expires_at as unknown as string) > new Date())) {
    curPackageId = tr.plan_package_id;
  }
  const isSame = curPackageId !== null && curPackageId === packageId;
  const curLimits = { maxMembers: usage?.memberLimit ?? null, maxProjects: usage?.projectLimit ?? null };
  const downgrade = !isSame && isDowngrade(curLimits, targetPkg);

  if (!downgrade) {
    // isSame (renewal/stack instan) atau upgrade (new.max >= old.max) → instan via GREATEST
    await activateTeamPackage(teamId, packageId, duration);
    if (!isSame) {
      // Upgrade: clear pending downgrade yang mungkin ada (instan + clear pending)
      await pool.query(
        `UPDATE teams SET plan_pending_package_id = NULL, plan_pending_duration = NULL, plan_pending_created_at = NULL WHERE id = $1 AND plan_pending_package_id IS NOT NULL`,
        [teamId],
      );
    }
  } else {
    // Downgrade: jadwalkan ke pending, aktivasi lazy saat expiry (tanpa cron)
    // Jika plan_expires_at IS NULL → grant permanen bypass jadi instan
    if (tr?.plan_expires_at === null && tr?.plan_package_id !== null) {
      await activateTeamPackage(teamId, packageId, duration);
    } else {
      // Overwrite pending lama jika ada
      await pool.query(
        `UPDATE teams SET plan_pending_package_id = $2, plan_pending_duration = $3, plan_pending_created_at = now(), updated_at = now() WHERE id = $1`,
        [teamId, packageId, duration],
      );
    }
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
  team_id?: string;
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
    ...(row.team_id !== undefined ? { teamId: row.team_id } : {}),
    ...(row.team_name !== undefined ? { teamName: row.team_name } : {}),
  };
}

export async function getBillingOverview(userId: string, teamId: string) {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');

  const usage = await getEffectiveUsage(teamId);
  const plan = usage?.plan ?? 'free';
  const payments = await listTeamPayments(teamId);

  const extraRes = await pool.query<{
    plan_package_id: string | null;
    plan_pending_package_id: string | null;
    plan_pending_duration: number | null;
    plan_pending_created_at: Date | null;
  }>('SELECT plan_package_id, plan_pending_package_id, plan_pending_duration, plan_pending_created_at FROM teams WHERE id = $1', [teamId]);
  const extra = extraRes.rows[0];
  let effectivePackageId: string | null = null;
  if (extra?.plan_package_id && usage?.plan === 'pro') {
    effectivePackageId = extra.plan_package_id;
  }
  let pendingPackage: {
    id: string;
    name: string;
    maxMembers: number | null;
    maxProjects: number | null;
    durationDays: number;
    activateAt: string;
    createdAt: string;
  } | null = null;
  if (extra?.plan_pending_package_id && extra.plan_pending_duration && extra.plan_pending_created_at) {
    const pendRes = await pool.query<{ id: string; name: string; max_members: number | null; max_projects: number | null }>(
      'SELECT id, name, max_members, max_projects FROM billing_packages WHERE id = $1',
      [extra.plan_pending_package_id],
    );
    const pend = pendRes.rows[0];
    if (pend) {
      const activateAt = row.plan_expires_at ? row.plan_expires_at.toISOString() : extra.plan_pending_created_at.toISOString();
      pendingPackage = {
        id: pend.id,
        name: pend.name,
        maxMembers: pend.max_members,
        maxProjects: pend.max_projects,
        durationDays: extra.plan_pending_duration,
        activateAt,
        createdAt: extra.plan_pending_created_at.toISOString(),
      };
    }
  }

  return {
    team: {
      id: row.id,
      name: row.name,
      plan,
      planPackageName: usage?.packageName ?? 'Free',
      planExpiresAt: row.plan_expires_at ? row.plan_expires_at.toISOString() : null,
      planPackageId: effectivePackageId,
      pendingPackage,
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

export async function cancelScheduledDowngrade(userId: string, teamId: string): Promise<{ ok: boolean }> {
  const row = await getTeamWithRole(userId, teamId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertAdmin(row.role);
  const cur = await pool.query<{ plan_pending_package_id: string | null }>('SELECT plan_pending_package_id FROM teams WHERE id = $1', [teamId]);
  if (!cur.rows[0]?.plan_pending_package_id) throw new ApiError(404, 'NOT_FOUND', 'No scheduled downgrade');
  await pool.query(
    'UPDATE teams SET plan_pending_package_id = NULL, plan_pending_duration = NULL, plan_pending_created_at = NULL, updated_at = now() WHERE id = $1',
    [teamId],
  );
  return { ok: true };
}


export async function getPayment(userId: string, orderId: string) {
  const payment = await findPaymentByOrderId(orderId);
  if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
  await assertPaymentAccess(userId, payment);
  const teamRes = await pool.query<{ name: string }>('SELECT name FROM teams WHERE id = $1', [payment.team_id]);
  const teamName = teamRes.rows[0]?.name ?? null;
  return { payment: serializePayment({ ...payment, team_name: teamName ?? payment.team_id } as any) };
}

export async function getPaymentHistory(userId: string) {
  const payments = await listPaymentsByUser(userId);
  return { payments: payments.map(serializePayment) };
}
