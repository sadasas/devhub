import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '@phosphor-icons/react';
import { Button } from './Button';
import { LinkButton } from './LinkButton';
import { DoodleIllustration } from './DoodleIllustration';
import { dismissAnnounce, isAnnounceDismissed } from '../lib/announce';
import { isTourActive, subscribeTour } from '../features/onboarding/tour-events';

const SHOW_DELAY_MS = 1000;
const RETRY_MS = 1000;

interface IntegrationAnnounceSheetProps {
  /** Project tujuan CTA. Falsy (dashboard tanpa project) = tidak render. */
  projectId?: string | null;
}

/**
 * Announce sheet Opsi B — bottom sheet ala ConsentBanner untuk
 * pengumuman Integrations (GCal + GitHub) per-project.
 * - Sekali tampil per versi kunci (`devhub_announce_integrations_v1`).
 * - Delay ~1 dtk; ditekan saat tur aktif, ada modal/sheet bertumpuk
 *   (body scroll-lock), atau consent banner sedang tampil — retry tiap 1 dtk.
 * - ESC / klik backdrop / "Nanti saja" = dismiss (tulis kunci).
 * - CTA "Buka Integrations" = dismiss + navigasi ke section integrations.
 */
export function IntegrationAnnounceSheet({ projectId }: IntegrationAnnounceSheetProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!projectId || isAnnounceDismissed()) return;
    let timer: number | undefined;
    let cancelled = false;

    const blocked = (): boolean => {
      if (isTourActive()) return true;
      try {
        // Modal / sheet / bottom-sheet yang terbuka mengunci scroll body.
        if (document.body?.style.overflow === 'hidden') return true;
        // Jangan menumpuk consent banner.
        if (document.querySelector('[data-testid="consent-banner"]')) return true;
      } catch {
        /* DOM unavailable */
      }
      return false;
    };

    const attempt = () => {
      if (cancelled) return;
      if (isAnnounceDismissed()) return;
      if (blocked()) {
        timer = window.setTimeout(attempt, RETRY_MS);
        return;
      }
      setVisible(true);
    };

    timer = window.setTimeout(attempt, SHOW_DELAY_MS);
    // Tur yang mulai belakangan menyembunyikan + menjadwal ulang sheet.
    const unsubscribe = subscribeTour(() => {
      if (cancelled) return;
      if (isTourActive()) setVisible(false);
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(attempt, RETRY_MS);
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [projectId]);

  const handleDismiss = useCallback(() => {
    dismissAnnounce();
    setVisible(false);
  }, []);

  // ESC menutup + menulis kunci dismiss.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, handleDismiss]);

  if (!visible || !projectId) return null;

  const cta = `/project/${encodeURIComponent(projectId)}?tab=settings&section=integrations`;

  return (
    <div
      className="announce-backdrop"
      role="dialog"
      aria-modal="false"
      aria-labelledby="announce-integrations-heading"
      aria-describedby="announce-integrations-desc"
      data-testid="announce-integrations"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <section className="announce-sheet" aria-label={t('announce.integrations.heading', { defaultValue: 'Hubungkan Google dan GitHub' })}>
        <div className="announce-head">
          <span className="announce-art" aria-hidden="true">
            <DoodleIllustration variant="tour-api" size={64} />
          </span>
          <div className="announce-copy">
            <h2 id="announce-integrations-heading" className="announce-heading">
              {t('announce.integrations.heading', { defaultValue: 'Hubungkan Google dan GitHub' })}
            </h2>
            <p id="announce-integrations-desc" className="announce-desc">
              {t('announce.integrations.desc', {
                defaultValue: 'Sinkronkan kalender dan tautkan repo — semua pengaturan ada di satu tempat.',
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="btn-icon announce-close"
            onClick={handleDismiss}
            aria-label={t('announce.integrations.close', { defaultValue: 'Tutup pengumuman' })}
          >
            <X size={14} aria-hidden="true" />
          </Button>
        </div>
        <div className="announce-actions" role="group" aria-label={t('announce.integrations.choiceAria', { defaultValue: 'Pengumuman integrasi' })}>
          <LinkButton to={cta} variant="primary" size="md" className="announce-btn" onClick={handleDismiss}>
            {t('announce.integrations.open', { defaultValue: 'Buka Integrations' })}
          </LinkButton>
          <Button variant="ghost" size="md" className="announce-btn" onClick={handleDismiss}>
            {t('announce.integrations.later', { defaultValue: 'Nanti saja' })}
          </Button>
        </div>
      </section>
    </div>
  );
}
