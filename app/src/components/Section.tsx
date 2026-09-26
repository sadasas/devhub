import type { ReactNode } from 'react';

interface SectionProps {
  /** Isi judul `h2` (14px/650, Title Case natural dari i18n). */
  title: ReactNode;
  /** Id `h2` + `aria-labelledby` section (wajib — section harus berlabel). */
  titleId: string;
  /** Ikon depan judul (pola `.section-title`, 14px `aria-hidden`). */
  icon?: ReactNode;
  /** Aksi kanan (Edit/Add) — hanya bila ada, h2 dibungkus head-row. */
  actions?: ReactNode;
  /** Paragraf deskripsi section. */
  description?: ReactNode;
  /** `danger`: modifier section + judul merah status (danger zone). */
  variant?: 'default' | 'danger';
  /** Id section (deep-link/search target, mis. `dashboard-settings-usage`). */
  id?: string;
  /** Modifier section tambahan (`--integrations`, …). */
  className?: string;
  children: ReactNode;
}

/**
 * Seksi settings kanonis (Tier-1, §7 ritme antar-blok 12px):
 * `<section aria-labelledby> + head-row (bila actions) + desc + isi`.
 * Kelas judul dipertahankan (`dashboard__settings-section-title`, bukan
 * `.section-title`) — keduanya 14px/650 tapi margin berbeda (head-row vs
 * blok); konvergensi ikut migrasi per area, bukan pilot ini.
 */
export function Section({
  title,
  titleId,
  icon,
  actions,
  description,
  variant = 'default',
  id,
  className,
  children,
}: SectionProps) {
  const danger = variant === 'danger';
  const titleEl = (
    <h2
      id={titleId}
      tabIndex={-1}
      className={`dashboard__settings-section-title${danger ? ' dashboard__settings-section-title--danger' : ''}${icon ? ' dashboard__settings-section-title--with-icon' : ''}`}
    >
      {icon}
      {title}
    </h2>
  );
  return (
    <section
      id={id}
      className={`dashboard__settings-section${danger ? ' dashboard__settings-section--danger' : ''}${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
    >
      {actions ? (
        <div className="dashboard__settings-head">
          {titleEl}
          {actions}
        </div>
      ) : (
        titleEl
      )}
      {description ? <p className="dashboard__settings-section-desc">{description}</p> : null}
      {children}
    </section>
  );
}

export function SettingsRowGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`settings-row-group${className ? ` ${className}` : ''}`}>{children}</div>
  );
}
