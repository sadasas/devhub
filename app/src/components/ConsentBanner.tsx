import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cookie } from '@phosphor-icons/react';
import { Button } from './Button';
import {
  CONSENT_OPEN_EVENT,
  readConsent,
  acceptAllConsent,
  rejectAllConsent,
  saveCustomConsent,
  type ConsentState,
} from '../lib/consent';

/**
 * Consent banner BI — bottom sheet, no dark pattern, no pre-ticked.
 * - Terima Semua / Tolak Semua / Kelola setara (ukuran & gaya setara).
 * - Toggle Necessary disabled (selalu aktif) vs Analitik default MATI.
 * - Simpan ke localStorage devhub_consent_v1.
 */
export function ConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [saved, setSaved] = useState<ConsentState | null>(null);

  useEffect(() => {
    let current: ConsentState | null = null;
    try {
      current = readConsent();
    } catch {
      current = null;
    }
    setSaved(current);
    // Tampil hanya jika belum ada pilihan tersimpan.
    if (!current) {
      const id = window.setTimeout(() => setVisible(true), 600);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, []);

  const reopen = useCallback(() => {
    try {
      const cur = readConsent();
      setSaved(cur);
      setAnalytics(cur?.analytics === true);
    } catch {
      setAnalytics(false);
    }
    setManage(true);
    setVisible(true);
  }, []);

  useEffect(() => {
    const onOpen = () => reopen();
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, [reopen]);

  // ESC menutup panel Kelola tanpa menyimpan (bukan consent).
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && manage) {
        e.preventDefault();
        setManage(false);
        // Jika sudah pernah menyimpan, tutup penuh; jika belum, kembali ke pilihan utama.
        if (saved) setVisible(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, manage, saved]);

  if (!visible) return null;

  const handleAccept = () => {
    const next = acceptAllConsent();
    setSaved(next);
    setVisible(false);
    setManage(false);
  };

  const handleReject = () => {
    const next = rejectAllConsent();
    setSaved(next);
    setVisible(false);
    setManage(false);
  };

  const handleSaveCustom = () => {
    const next = saveCustomConsent(analytics);
    setSaved(next);
    setVisible(false);
    setManage(false);
  };

  return (
    <div
      className="consent-backdrop"
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
      data-testid="consent-banner"
    >
      <section className="consent-sheet" aria-label={t('consent.title', { defaultValue: 'Pilihan privasi' })}>
        <div className="consent-head">
          <span className="consent-icon" aria-hidden="true">
            <Cookie size={18} weight="duotone" />
          </span>
          <h2 id="consent-title" className="consent-title">
            {t('consent.title', { defaultValue: 'Kami menghargai privasi Anda' })}
          </h2>
        </div>
        <p id="consent-desc" className="consent-desc">
          {t('consent.desc', {
            defaultValue:
              'DevHub memakai cookie yang diperlukan agar bisa masuk. Analitik opsional dan mati secara default — aktif hanya jika Anda setuju.',
          })}
        </p>

        {!manage ? (
          <>
            <div className="consent-actions" role="group" aria-label={t('consent.choiceAria', { defaultValue: 'Pilihan persetujuan' })}>
              <Button variant="secondary" size="md" className="consent-btn" onClick={handleAccept}>
                {t('consent.acceptAll', { defaultValue: 'Terima Semua' })}
              </Button>
              <Button variant="secondary" size="md" className="consent-btn" onClick={handleReject}>
                {t('consent.rejectAll', { defaultValue: 'Tolak Semua' })}
              </Button>
              <Button variant="ghost" size="md" className="consent-btn" onClick={() => setManage(true)} aria-expanded={manage}>
                {t('consent.manage', { defaultValue: 'Kelola' })}
              </Button>
            </div>
            <p className="consent-note">
              {t('consent.note', {
                defaultValue: 'Tanpa pola menipu: ketiga tombol setara, tanpa centang awal. Baca ',
              })}
              <a href="/privacy">{t('consent.privacyLink', { defaultValue: 'Kebijakan Privasi' })}</a>.
            </p>
          </>
        ) : (
          <>
            <div className="consent-toggles" role="group" aria-label={t('consent.manageTitle', { defaultValue: 'Kelola persetujuan' })}>
              <div className="consent-toggle-row">
                <div className="consent-toggle-main">
                  <span className="consent-toggle-title">
                    {t('consent.necessary', { defaultValue: 'Diperlukan' })}
                  </span>
                  <span className="consent-toggle-desc">
                    {t('consent.necessaryDesc', {
                      defaultValue: 'Login & keamanan (devhub_session, 24 jam). Selalu aktif.',
                    })}
                  </span>
                </div>
                <label className="consent-switch">
                  <input type="checkbox" checked disabled aria-label={t('consent.necessary', { defaultValue: 'Diperlukan' })} />
                  <span aria-hidden="true" className="consent-switch-ui consent-switch-ui--on" />
                </label>
              </div>
              <div className="consent-toggle-row">
                <div className="consent-toggle-main">
                  <span className="consent-toggle-title">
                    {t('consent.analytics', { defaultValue: 'Analitik' })}
                  </span>
                  <span className="consent-toggle-desc">
                    {t('consent.analyticsDesc', {
                      defaultValue: 'GA4 anonim untuk perbaikan produk. Mati secara default.',
                    })}
                  </span>
                </div>
                <label className="consent-switch">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    aria-label={t('consent.analytics', { defaultValue: 'Analitik' })}
                  />
                  <span aria-hidden="true" className={`consent-switch-ui${analytics ? ' consent-switch-ui--on' : ''}`} />
                </label>
              </div>
            </div>
            <div className="consent-actions" role="group" aria-label={t('consent.choiceAria', { defaultValue: 'Pilihan persetujuan' })}>
              <Button variant="secondary" size="md" className="consent-btn" onClick={handleAccept}>
                {t('consent.acceptAll', { defaultValue: 'Terima Semua' })}
              </Button>
              <Button variant="secondary" size="md" className="consent-btn" onClick={handleReject}>
                {t('consent.rejectAll', { defaultValue: 'Tolak Semua' })}
              </Button>
              <Button variant="primary" size="md" className="consent-btn" onClick={handleSaveCustom}>
                {t('consent.saveChoice', { defaultValue: 'Simpan pilihan' })}
              </Button>
            </div>
            <p className="consent-note">
              {t('consent.manageNote', {
                defaultValue: 'Mencabut analitik menghapus cookie _ga* dari perangkat ini.',
              })}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
