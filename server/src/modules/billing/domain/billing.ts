export const PAKASIR_PAY_BASE = 'https://app.pakasir.com';

export interface TeamPaymentRow {
  id: string;
  team_id: string;
  order_id: string;
  package_id: string | null;
  package_name: string;
  duration_days: number | null;
  amount: number;
  status: 'pending' | 'completed';
  created_by: string;
  created_at: Date;
  completed_at: Date | null;
}

export interface PackageRow {
  id: string;
  name: string;
  description: string;
  is_free: boolean;
  max_members: number | null;
  max_projects: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface PackagePriceRow {
  id: string;
  package_id: string;
  duration_days: number;
  price_idr: number;
  sort_order: number;
  is_active: boolean;
}
