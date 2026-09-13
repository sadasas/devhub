import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { House, ArrowLeft } from '@phosphor-icons/react';
import { Button } from '../components/Button';

/** 404 proper Bahasa Indonesia — ganti wildcard *→/ agar deep-link salah tidak diam-diam ke dashboard. */
export function NotFoundPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [path, setPath] = useState('');

  useEffect(() => {
    try {
      setPath(window.location.pathname);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="notfound-root">
      <main className="page" aria-labelledby="notfound-title">
        <article className="pcard">
          <div className="pcard-body">
            <div className="narrow-center notfound-body">
              <p className="notfound-code" aria-hidden="true">404</p>
              <h1 id="notfound-title" className="page-title">
                {t('notFound.title', { defaultValue: lang === 'id' ? 'Halaman tidak ditemukan' : 'Page not found' })}
              </h1>
              <p className="page-subtitle">
                {t('notFound.desc', {
                  defaultValue:
                    lang === 'id'
                      ? 'Alamat yang Anda buka tidak ada atau sudah dipindah. Periksa kembali tautan Anda.'
                      : 'The address you opened does not exist or was moved. Double-check your link.',
                })}
              </p>
              {path && (
                <p className="notfound-path" title={path}>
                  <code className="font-mono">{path}</code>
                </p>
              )}
              <div className="notfound-actions">
                <Button variant="secondary" onClick={() => navigate(-1)} leftIcon={<ArrowLeft size={14} aria-hidden="true" />}>
                  {t('notFound.back', { defaultValue: lang === 'id' ? 'Kembali' : 'Go back' })}
                </Button>
                <Button variant="primary" onClick={() => navigate('/', { replace: true })} leftIcon={<House size={14} aria-hidden="true" />}>
                  {t('notFound.dashboard', { defaultValue: 'Dashboard' })}
                </Button>
              </div>
              <p className="notfound-help">
                {t('notFound.help', { defaultValue: lang === 'id' ? 'Butuh bantuan? Hubungi ' : 'Need help? Contact ' })}
                <a href="mailto:support@devhub.nrawangbatin.my.id">support@devhub.nrawangbatin.my.id</a>
                {' · '}
                <Link to="/docs">{t('legal.status', { defaultValue: 'Status' })}</Link>
              </p>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
