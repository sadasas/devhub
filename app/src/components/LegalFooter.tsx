import { useTranslation } from 'react-i18next';
import { EnvelopeSimple, ShieldCheck } from '@phosphor-icons/react';
import { openConsentSettings } from '../lib/consent';
import { DOCS_HOME_URL, DOCS_PRIVACY_URL, DOCS_TERMS_URL } from '../lib/docs-urls';

const SUPPORT_EMAIL = 'support@devhub.nrawangbatin.my.id';
const PRIVACY_EMAIL = 'privacy@devhub.nrawangbatin.my.id';

/**
 * LegalFooter — Terms, Privacy, Status/Backup, kontak support+privacy,
 * + link Pengaturan Cookie. Tanpa language switcher (pilihan bahasa ada di topbar).
 * Dipakai di Auth, Pricing, PublicProject, onboarding.
 */
export function LegalFooter({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'id' ? 'id' : 'en';

  return (
    <footer className={`legal-footer${compact ? ' legal-footer--compact' : ''}`} aria-label={t('legal.footerAria', { defaultValue: 'Legal & bantuan' })}>
      <nav className="legal-footer-links" aria-label={t('legal.navAria', { defaultValue: 'Tautan legal' })}>
        <a href={DOCS_TERMS_URL} target="_blank" rel="noopener">{t('legal.terms', { defaultValue: lang === 'id' ? 'Syarat' : 'Terms' })}</a>
        <span aria-hidden="true" className="legal-dot">·</span>
        <a href={DOCS_PRIVACY_URL} target="_blank" rel="noopener">{t('legal.privacy', { defaultValue: lang === 'id' ? 'Privasi' : 'Privacy' })}</a>
        <span aria-hidden="true" className="legal-dot">·</span>
        <a href={DOCS_HOME_URL} target="_blank" rel="noopener">{t('legal.status', { defaultValue: 'Status' })}</a>
        <span aria-hidden="true" className="legal-dot">·</span>
        <a href={DOCS_HOME_URL} target="_blank" rel="noopener">{t('legal.backup', { defaultValue: lang === 'id' ? 'Backup' : 'Backup' })}</a>
        <span aria-hidden="true" className="legal-dot">·</span>
        <button
          type="button"
          className="legal-cookie-btn"
          onClick={openConsentSettings}
        >
          {t('legal.cookieSettings', { defaultValue: lang === 'id' ? 'Pengaturan Cookie' : 'Cookie settings' })}
        </button>
      </nav>
      <p className="legal-footer-contacts">
        <span className="legal-contact">
          <EnvelopeSimple size={12} aria-hidden="true" />
          <a href={`mailto:${SUPPORT_EMAIL}`}>{lang === 'id' ? 'Dukungan' : 'Support'}</a>
        </span>
        <span aria-hidden="true" className="legal-dot">·</span>
        <span className="legal-contact">
          <ShieldCheck size={12} aria-hidden="true" />
          <a href={`mailto:${PRIVACY_EMAIL}`}>{lang === 'id' ? 'Privasi' : 'Privacy'}</a>
        </span>
      </p>
    </footer>
  );
}
