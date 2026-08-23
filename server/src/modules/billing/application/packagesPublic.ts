import { listActivePackages } from '../infrastructure/billingRepository.js';
import type { PackagePriceRow } from '../domain/billing.js';
import type { PackageWithPrices } from '../infrastructure/billingRepository.js';

export interface PublicPackage {
  id: string;
  name: string;
  description: string;
  isFree: boolean;
  maxMembers: number | null;
  maxProjects: number | null;
  prices: Array<{ id: string; durationDays: number; priceIdr: number }>;
}

export function serializePackagePublic(row: PackageWithPrices): PublicPackage {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isFree: row.is_free,
    maxMembers: row.max_members,
    maxProjects: row.max_projects,
    prices: row.prices
      .filter((p: PackagePriceRow) => p.is_active)
      .map((p: PackagePriceRow) => ({ id: p.id, durationDays: p.duration_days, priceIdr: p.price_idr })),
  };
}

export async function listPublicPackages(): Promise<PublicPackage[]> {
  return (await listActivePackages()).map(serializePackagePublic);
}
