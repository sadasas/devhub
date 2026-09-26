import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Isi `h1.page-title`. */
  title: ReactNode;
  /** Isi `p.page-subtitle` (opsional). */
  subtitle?: ReactNode;
  /** Sisi kanan: count (`data-list-count`) atau aksi. */
  actions?: ReactNode;
  /** Modifier halaman (`billing-header`, `pricing-header`, …). */
  className?: string;
}

/**
 * Header halaman kanonis (Tier-1, §4b `toolbar-header`):
 * judul + subjudul di kiri, aksi/count di kanan (`space-between + wrap`).
 * Mobile: turun 2 baris via CSS yang sama (bukan varian komponen).
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={`page-header${className ? ` ${className}` : ''}`}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}
