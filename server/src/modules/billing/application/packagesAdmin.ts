import { z } from 'zod';
import { ApiError } from '../../../shared/errors.js';
import { parseOrThrow } from '../../../shared/db.js';
import {
  countPackageReferences,
  createPackage,
  deletePackage,
  findPackageById,
  listAllPackages,
  replacePackagePrices,
  updatePackageFields,
} from '../infrastructure/billingRepository.js';

const packageInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional(),
  isFree: z.boolean().optional(),
  maxMembers: z.number().int().positive().nullable().optional(),
  maxProjects: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

const createSchema = packageInputSchema.extend({
  prices: z
    .array(
      z.object({
        durationDays: z.number().int().min(1).max(3_650),
        priceIdr: z.number().int().min(0),
        originalPriceIdr: z.number().int().min(0).nullable().optional(),
      }),
    )
    .default([]),
});

const patchSchema = packageInputSchema.partial().extend({
  prices: z
    .array(
      z.object({
        durationDays: z.number().int().min(1).max(3_650),
        priceIdr: z.number().int().min(0),
        originalPriceIdr: z.number().int().min(0).nullable().optional(),
      }),
    )
    .optional(),
});

export function serializePackage(row: {
  id: string;
  name: string;
  description: string;
  is_free: boolean;
  max_members: number | null;
  max_projects: number | null;
  sort_order: number;
  is_active: boolean;
  prices: Array<{ id: string; duration_days: number; price_idr: number; original_price_idr: number | null; sort_order: number; is_active: boolean }>;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isFree: row.is_free,
    maxMembers: row.max_members,
    maxProjects: row.max_projects,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    prices: row.prices.map((p) => ({
      id: p.id,
      durationDays: p.duration_days,
      priceIdr: p.price_idr,
      originalPriceIdr: p.original_price_idr,
      sortOrder: p.sort_order,
      isActive: p.is_active,
    })),
  };
}

export async function listPackagesForAdmin() {
  const rows = await listAllPackages();
  return { packages: rows.map(serializePackage) };
}

function mapDuplicate(err: unknown): never {
  if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
    throw new ApiError(409, 'CONFLICT', 'A free plan already exists');
  }
  throw err as Error;
}

export async function createNewPackage(body: unknown) {
  const input = parseOrThrow(createSchema, body, 'Invalid package data');
  let row;
  try {
    row = await createPackage(input);
  } catch (err) {
    mapDuplicate(err);
  }
  if (input.prices.length > 0) {
    await replacePackagePrices(row.id, input.prices);
  }
  return getAdminPackage(row.id);
}

async function requireExisting(packageId: string) {
  const row = await findPackageById(packageId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Package not found');
  return row;
}

export async function patchPackage(packageId: string, body: unknown) {
  await requireExisting(packageId);
  const input = parseOrThrow(patchSchema, body, 'Invalid package data');
  const { prices, ...fields } = input;
  try {
    await updatePackageFields(packageId, fields);
  } catch (err) {
    mapDuplicate(err);
  }
  if (prices !== undefined) {
    await replacePackagePrices(packageId, prices);
  }
  return getAdminPackage(packageId);
}

export async function getAdminPackage(packageId: string) {
  const all = await listAllPackages();
  const found = all.find((p) => p.id === packageId);
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Package not found');
  return serializePackage(found);
}

export async function removePackage(packageId: string): Promise<void> {
  await requireExisting(packageId);
  const refs = await countPackageReferences(packageId);
  if (refs > 0) {
    throw new ApiError(
      409,
      'CONFLICT',
      'Package is referenced by teams or payments — deactivate it instead',
    );
  }
  await deletePackage(packageId);
}
