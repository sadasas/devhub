import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Flag } from '@phosphor-icons/react';
import { Button } from './Button';

interface WizardFooterProps {
  /** Lewati seluruh tur — selalu terlihat, ghost sm kiri. */
  onSkip: () => void;
  skipLabel: ReactNode;
  /** aria-label Skip (mis. "Skip all" vs teks "Skip"). */
  skipAriaLabel?: string;
  autoFocusSkip?: boolean;
  /** Kait tour (`data-tour-id`); default `wizard-skip`. */
  skipTourId?: string;
  /** Kembali — `undefined` di langkah pertama (tombol hilang). */
  onBack?: () => void;
  backLabel?: ReactNode;
  /** Maju (Next) atau selesai (Finish) — lihat `advanceMode`. */
  onAdvance: () => void;
  advanceLabel: ReactNode;
  /** Varian eksplisit: `next` = panah kanan di belakang label,
      `finish` = bendera di depan label. */
  advanceMode: 'next' | 'finish';
  /** Gate keras (mis. belum ada team/project): tombol disabled. */
  advanceDisabled?: boolean;
  /** Alasan gate — jadi `title` saat disabled. */
  advanceDisabledReason?: string;
  autoFocusAdvance?: boolean;
  /** Kait tour; default `wizard-next` / `wizard-finish` per mode. */
  advanceTourId?: string;
}

/**
 * Footer wizard tur kanonis (Tier-1, pola `OnboardingWizard`):
 * `[ghost sm Skip][spacer][ghost sm Back?][primary sm Next|Finish]`.
 * Satu fragment dipakai dua host (`.tour-popover-foot` + modal-footer) —
 * jangan pecah per host. Ukuran sm disengaja (tour, bukan modal form md).
 */
export function WizardFooter({
  onSkip,
  skipLabel,
  skipAriaLabel,
  autoFocusSkip,
  skipTourId = 'wizard-skip',
  onBack,
  backLabel,
  onAdvance,
  advanceLabel,
  advanceMode,
  advanceDisabled = false,
  advanceDisabledReason,
  autoFocusAdvance,
  advanceTourId,
}: WizardFooterProps) {
  const tourId = advanceTourId ?? (advanceMode === 'finish' ? 'wizard-finish' : 'wizard-next');
  return (
    <>
      {/* Skip: always visible, one click, >=24px. */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onSkip}
        autoFocus={autoFocusSkip}
        aria-label={skipAriaLabel}
        className="tour-skip-btn"
        data-tour-id={skipTourId}
      >
        {skipLabel}
      </Button>
      <span className="tour-footer-spacer" aria-hidden="true" />
      {onBack && backLabel ? (
        <Button variant="ghost" size="sm" onClick={onBack} leftIcon={<ArrowLeft size={14} aria-hidden="true" />}>
          {backLabel}
        </Button>
      ) : null}
      {advanceMode === 'finish' ? (
        <Button
          variant="primary"
          size="sm"
          onClick={onAdvance}
          autoFocus={autoFocusAdvance}
          leftIcon={<Flag size={14} aria-hidden="true" />}
          data-tour-id={tourId}
        >
          {advanceLabel}
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={onAdvance}
          autoFocus={autoFocusAdvance}
          disabled={advanceDisabled}
          aria-disabled={advanceDisabled || undefined}
          title={advanceDisabled ? advanceDisabledReason : undefined}
          data-tour-id={tourId}
        >
          <span>{advanceLabel}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Button>
      )}
    </>
  );
}
