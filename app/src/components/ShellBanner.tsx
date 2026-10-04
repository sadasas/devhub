import type { ReactNode } from 'react';
import { CheckCircle, Info, Warning, XCircle } from '@phosphor-icons/react';
import { Button } from './Button';

export type ShellBannerTone = 'warn' | 'danger' | 'info' | 'success';

export interface ShellBannerAction {
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}

interface ShellBannerProps {
  tone?: ShellBannerTone;
  /** Baris utama tebal (mis. countdown "tersisa 3 hari"). ReactNode = dinamis. */
  lead: ReactNode;
  /** Baris kedua redup (mis. konsekuensi / tanggal). */
  message?: ReactNode;
  /** Satu aksi primer (mis. Kirim ulang). Ghost agar tak menyaingi CTA halaman. */
  primary?: ShellBannerAction;
  testId?: string;
}

const TONE_ICON = {
  warn: Warning,
  danger: XCircle,
  info: Info,
  success: CheckCircle,
} as const;

/**
 * Banner global-level (slot shell di atas topbar) — konten dinamis via props.
 * Lawan dari StatusBanner (section-level): ShellBanner untuk kondisi akun /
 * sistem lintas halaman (verifikasi email, billing, maintenance).
 * Nada -> warna `var(--status-*)` + ikon + `role` otomatis (`alert` untuk
 * danger/warn, `status` untuk info/success). Tanpa snooze by design —
 * banner reda hanya saat kondisinya hilang.
 */
export function ShellBanner({ tone = 'warn', lead, message, primary, testId }: ShellBannerProps) {
  const role = tone === 'danger' || tone === 'warn' ? 'alert' : 'status';
  const Icon = TONE_ICON[tone];
  return (
    <div
      className={`sbanner sbanner-${tone}`}
      role={role}
      data-testid={testId ?? 'shell-banner'}
    >
      <span className="sbanner-icon" aria-hidden="true">
        <Icon size={16} weight="bold" aria-hidden="true" />
      </span>
      <div className="sbanner-copy">
        <span className="sbanner-lead">{lead}</span>
        {message ? <span className="sbanner-message">{message}</span> : null}
      </div>
      {primary ? (
        <div className="sbanner-actions">
          <Button
            variant="ghost"
            size="sm"
            className="sbanner-btn"
            onClick={primary.onClick}
            loading={primary.busy}
            disabled={primary.disabled || primary.busy}
          >
            {primary.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
