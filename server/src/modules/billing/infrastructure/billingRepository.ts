import { pool } from '../../../db/pool.js';
import { withTransaction } from '../../../shared/db.js';
import type { PackagePriceRow, PackageRow, TeamPaymentRow } from '../domain/billing.js';

export interface InsertPaymentInput {
  teamId: string;
  orderId: string;
  packageId: string;
  packageName: string;
  durationDays: number;
  amount: number;
  createdBy: string;
}

export async function insertPendingPayment(input: InsertPaymentInput): Promise<TeamPaymentRow> {
  const result = await pool.query<TeamPaymentRow>(
    `INSERT INTO team_payments (team_id, order_id, package_id, package_name, duration_days, amount, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
     RETURNING *`,
    [
      input.teamId,
      input.orderId,
      input.packageId,
      input.packageName,
      input.durationDays,
      input.amount,
      input.createdBy,
    ],
  );
  return result.rows[0]!;
}

export async function findPaymentByOrderId(orderId: string): Promise<TeamPaymentRow | null> {
  const result = await pool.query<TeamPaymentRow>(
    'SELECT * FROM team_payments WHERE order_id = $1',
    [orderId],
  );
  return result.rows[0] ?? null;
}

export async function markPaymentCompleted(orderId: string): Promise<TeamPaymentRow | null> {
  const result = await pool.query<TeamPaymentRow>(
    `UPDATE team_payments
     SET status = 'completed', completed_at = now()
     WHERE order_id = $1 AND status = 'pending'
     RETURNING *`,
    [orderId],
  );
  return result.rows[0] ?? null;
}

export async function listTeamPayments(teamId: string, limit = 10): Promise<TeamPaymentRow[]> {
  const result = await pool.query<TeamPaymentRow>(
    `SELECT * FROM team_payments WHERE team_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [teamId, limit],
  );
  return result.rows;
}

export async function listPaymentsByUser(userId: string, limit = 50): Promise<TeamPaymentRow[]> {
  const result = await pool.query<TeamPaymentRow>(
    `SELECT tp.*, t.name AS team_name
     FROM team_payments tp
     JOIN teams t ON t.id = tp.team_id
     WHERE tp.created_by = $1
     ORDER BY tp.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

// ---------- Packages ----------

interface PackageWithPrices extends PackageRow {
  prices: PackagePriceRow[];
}

export type { PackageWithPrices };

async function attachPrices(packages: PackageRow[]): Promise<PackageWithPrices[]> {
  if (packages.length === 0) return [];
  const priceRes = await pool.query<PackagePriceRow & { is_active: boolean }>(
    `SELECT id, package_id, duration_days, price_idr, original_price_idr, sort_order, is_active
     FROM billing_package_prices
     ORDER BY sort_order, duration_days`,
  );
  return packages.map((p) => ({
    ...p,
    prices: priceRes.rows.filter((pr) => pr.package_id === p.id),
  }));
}

/** Paket aktif + harga aktif — untuk permukaan publik (pricing, modal upgrade). */
export async function listActivePackages(): Promise<PackageWithPrices[]> {
  const res = await pool.query<PackageRow>(
    `SELECT id, name, description, is_free, max_members, max_projects, sort_order, is_active
     FROM billing_packages WHERE is_active ORDER BY sort_order, created_at`,
  );
  const withPrices = await attachPrices(res.rows);
  return withPrices.map((p) => ({
    ...p,
    prices: p.prices.filter((pr) => pr.is_active),
  }));
}

/** Semua paket termasuk nonaktif + semua harga — untuk admin. */
export async function listAllPackages(): Promise<PackageWithPrices[]> {
  const res = await pool.query<PackageRow>(
    `SELECT id, name, description, is_free, max_members, max_projects, sort_order, is_active
     FROM billing_packages ORDER BY sort_order, created_at`,
  );
  return attachPrices(res.rows);
}

export async function findActivePackage(
  packageId: string,
): Promise<PackageWithPrices | null> {
  const res = await pool.query<PackageRow>(
    `SELECT id, name, description, is_free, max_members, max_projects, sort_order, is_active
     FROM billing_packages WHERE id = $1 AND is_active`,
    [packageId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const [withPrices] = await attachPrices([row]);
  return withPrices ?? null;
}

export async function findActivePrice(
  priceId: string,
  packageId: string,
): Promise<PackagePriceRow | null> {
  const res = await pool.query<PackagePriceRow>(
    `SELECT id, package_id, duration_days, price_idr, original_price_idr, sort_order, is_active
     FROM billing_package_prices
     WHERE id = $1 AND package_id = $2 AND is_active`,
    [priceId, packageId],
  );
  return res.rows[0] ?? null;
}

export interface CreatePackageInput {
  name: string;
  description?: string;
  isFree?: boolean;
  maxMembers?: number | null;
  maxProjects?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createPackage(input: CreatePackageInput): Promise<PackageRow> {
  // Satu paket free dinegasi DB oleh partial-unique index; cek dulu agar 409 rapi.
  if (input.isFree) {
    const existing = await pool.query('SELECT 1 FROM billing_packages WHERE is_free');
    if (existing.rows.length > 0) {
      throw Object.assign(new Error('duplicate free'), { code: '23505' });
    }
  }
  const res = await pool.query<PackageRow>(
    `INSERT INTO billing_packages (name, description, is_free, max_members, max_projects, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, description, is_free, max_members, max_projects, sort_order, is_active`,
    [
      input.name,
      input.description ?? '',
      input.isFree ?? false,
      input.maxMembers ?? null,
      input.maxProjects ?? null,
      input.sortOrder ?? 0,
      input.isActive ?? true,
    ],
  );
  return res.rows[0]!;
}

export async function updatePackageFields(
  packageId: string,
  fields: Partial<{
    name: string;
    description: string;
    isFree: boolean;
    maxMembers: number | null;
    maxProjects: number | null;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<PackageRow | null> {
  const map: Record<string, string> = {
    name: 'name',
    description: 'description',
    isFree: 'is_free',
    maxMembers: 'max_members',
    maxProjects: 'max_projects',
    sortOrder: 'sort_order',
    isActive: 'is_active',
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, column] of Object.entries(map)) {
    if (!(key in fields)) continue;
    sets.push(`${column} = $${i}`);
    values.push((fields as Record<string, unknown>)[key]);
    i += 1;
  }
  if (sets.length === 0) return findPackageById(packageId);
  sets.push(`updated_at = now()`);
  values.push(packageId);
  const res = await pool.query<PackageRow>(
    `UPDATE billing_packages SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING id, name, description, is_free, max_members, max_projects, sort_order, is_active`,
    values,
  );
  return res.rows[0] ?? null;
}

export async function findPackageById(packageId: string): Promise<PackageRow | null> {
  const res = await pool.query<PackageRow>(
    `SELECT id, name, description, is_free, max_members, max_projects, sort_order, is_active
     FROM billing_packages WHERE id = $1`,
    [packageId],
  );
  return res.rows[0] ?? null;
}

/** Ganti daftar harga secara menyeluruh; baris lama yang hilang di-nonaktifkan (soft). */
export async function replacePackagePrices(
  packageId: string,
  prices: Array<{ durationDays: number; priceIdr: number; originalPriceIdr?: number | null }>,
): Promise<void> {
  for (const p of prices) {
    if (!Number.isInteger(p.durationDays) || p.durationDays <= 0 || !Number.isInteger(p.priceIdr) || p.priceIdr < 0) {
      throw Object.assign(new Error('Invalid price row'), { code: '22023' });
    }
    if (p.originalPriceIdr != null && (!Number.isInteger(p.originalPriceIdr) || p.originalPriceIdr <= p.priceIdr)) {
      throw Object.assign(new Error('Original price must be greater than selling price'), { code: '22023' });
    }
  }
  await withTransaction(pool, async (client) => {
    await client.query(
      `UPDATE billing_package_prices SET is_active = false WHERE package_id = $1`,
      [packageId],
    );
    let idx = 0;
    for (const p of prices) {
      const updated = await client.query(
        `UPDATE billing_package_prices SET price_idr = $3, original_price_idr = $5, is_active = true, sort_order = $4
         WHERE package_id = $1 AND duration_days = $2`,
        [packageId, p.durationDays, p.priceIdr, idx, p.originalPriceIdr ?? null],
      );
      if ((updated.rowCount ?? 0) === 0) {
        await client.query(
          `INSERT INTO billing_package_prices (package_id, duration_days, price_idr, original_price_idr, sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [packageId, p.durationDays, p.priceIdr, p.originalPriceIdr ?? null, idx],
        );
      }
      idx += 1;
    }
  });
}

/** Hapus fisik hanya boleh bila belum pernah dipakai transaksi / terpasang tim. */
export async function countPackageReferences(packageId: string): Promise<number> {
  const res = await pool.query<{ n: number }>(
    `SELECT (
       (SELECT count(*) FROM team_payments WHERE package_id = $1)
     + (SELECT count(*) FROM teams WHERE plan_package_id = $1)
     )::int AS n`,
    [packageId],
  );
  return res.rows[0]?.n ?? 0;
}

export async function deletePackage(packageId: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM billing_packages WHERE id = $1', [packageId]);
  return (res.rowCount ?? 0) > 0;
}
