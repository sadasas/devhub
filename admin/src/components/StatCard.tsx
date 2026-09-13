import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  /** Angka/string tabular. null = loading skeleton per zona. */
  value: number | string | null;
  /** accent=true → revenue (aksen hijau). hero=true → KPI hero besar. */
  accent?: boolean;
  hero?: boolean;
  sub?: ReactNode;
  /** Render custom value (mis. formatIdr) — bila diisi, `value` hanya untuk a11y/skeleton check */
  renderValue?: ReactNode;
}

/** StatCard konsolidasi (Fase 1): 1 komponen + accent prop.
 *  Mengganti 3 varian: .stat-card, .stat-card--hero, .stat-card-revenue.
 */
export function StatCard({ icon, label, value, accent = false, hero = false, sub, renderValue }: StatCardProps) {
  const cls = hero ? 'stat-card stat-card--hero' : accent ? 'stat-card stat-card-revenue' : 'stat-card';
  return (
    <div className={cls}>
      <h3 className="stat-card-title">
        {icon && (
          <span className={hero ? 'stat-card-icon' : undefined} aria-hidden="true" style={hero ? undefined : { display: 'inline-flex' }}>
            {icon}
          </span>
        )}
        {label}
      </h3>
      <span className="stat-card-value tabular">
        {value === null ? <Skeleton style={{ width: hero ? 120 : 48, height: hero ? 30 : 22 }} /> : (renderValue ?? value)}
      </span>
      {sub && <span className="stat-card-sub">{sub}</span>}
    </div>
  );
}
