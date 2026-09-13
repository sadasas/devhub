import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * ExternalRedirect — redirect instan ke URL kanonis docs site.
 * Saat mount langsung window.location.replace(to).
 * Fallback <p> + <a href> biasa untuk no-JS/crawler.
 */
export function ExternalRedirect({ to }: { to: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'id' ? 'id' : 'en';

  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <main className="page" aria-labelledby="external-redirect-title">
      <article className="pcard">
        <div className="pcard-body">
          <div className="narrow-center">
            <p id="external-redirect-title">
              {t('legal.continueTo', {
                defaultValue: lang === 'id' ? 'Lanjut ke dokumentasi' : 'Continue to documentation',
              })}{' '}
              <a href={to} rel="noopener">
                {to}
              </a>
            </p>
          </div>
        </div>
      </article>
    </main>
  );
}
