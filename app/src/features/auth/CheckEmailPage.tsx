import { useEffect, useState } from 'react';
import { ArrowRight, EnvelopeSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, Link } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Logo } from '../../components/Logo';

type CheckCase = 'register' | 'forgot';

const RESEND_COOLDOWN_S = 60;

function validEmail(raw: string | null): string | null {
  const email = (raw ?? '').trim().toLowerCase();
  if (email.length >= 3 && email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return email;
  return null;
}

/**
 * Layar konfirmasi "cek email" (T10) — dipakai 2 kasus:
 * - register: setelah akun dibuat, sebelum verifikasi
 * - forgot: setelah link reset diminta
 * Satu komponen, judul/copy/tombol per kasus. Bukan banner di halaman login.
 */
export function CheckEmailPage() {
  const { t } = useTranslation('account');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawCase = searchParams.get('case');
  const kind: CheckCase = rawCase === 'forgot' ? 'forgot' : 'register';
  const email = validEmail(searchParams.get('email'));

  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onResend() {
    if (!email || resending || cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      if (kind === 'forgot') await api.forgotPassword(email);
      else await api.resendVerification(email);
      setResent(true);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(getErrorMessage(err, t('auth.error.generic')));
    } finally {
      setResending(false);
    }
  }

  const title =
    kind === 'forgot'
      ? t('auth.checkEmail.forgotTitle', 'Check your email')
      : t('auth.checkEmail.registerTitle', 'Check your email');
  const body =
    kind === 'forgot'
      ? t(
          'auth.checkEmail.forgotBody',
          'If that email exists, a reset link is on its way (valid 60 minutes). Check spam too.',
        )
      : t(
          'auth.checkEmail.registerBody',
          'We sent a verification link (valid 24 hours). Check spam too.',
        );

  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-brand-mark">
          <Logo size={20} />
          <span>DevHub</span>
        </div>
        <div className="auth-brand-copy">
          <h1>{t('auth.brand.title')}</h1>
          <p>{t('auth.brand.subtitle')}</p>
        </div>
      </aside>
      <main className="auth-form-wrap">
        <div className="auth-form" style={{ gap: 12 }}>
          <EnvelopeSimple size={32} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <div>
            <h2 className="auth-form-title" style={{ fontSize: 15 }}>{title}</h2>
            <p className="auth-form-sub" style={{ fontSize: 13 }}>
              {body}
              {email && (
                <>
                  {' '}
                  <strong style={{ fontSize: 14 }}>{email}</strong>
                </>
              )}
            </p>
          </div>

          {error && <InlineError>{error}</InlineError>}
          {resent && (
            <div
              role="status"
              style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--status-success-soft)', color: 'var(--status-success)', fontSize: 13 }}
            >
              {t('auth.checkEmail.resent', 'Sent — check your inbox (and spam).')}
            </div>
          )}

          <Button onClick={onResend} loading={resending} disabled={!email || resending || cooldown > 0}>
            {cooldown > 0
              ? t('auth.checkEmail.resendCooldown', `Resend (${cooldown})`)
              : t('auth.checkEmail.resend', 'Resend email')}
            {!resending && <ArrowRight size={14} weight="bold" aria-hidden="true" />}
          </Button>

          <p className="auth-switch" style={{ fontSize: 13 }}>
            {kind === 'register' ? (
              <>
                {t('auth.checkEmail.wrongEmail', 'Wrong address?')}{' '}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/?mode=register')}>
                  {t('auth.checkEmail.registerAgain', 'Register again')}
                </button>
              </>
            ) : (
              <>
                {t('auth.checkEmail.useAnother', 'Use another email?')}{' '}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/?mode=forgot')}>
                  {t('auth.checkEmail.tryAgain', 'Try again')}
                </button>
              </>
            )}
          </p>
          <p className="auth-switch" style={{ fontSize: 13 }}>
            <Link to="/" className="btn btn-ghost btn-sm">
              {t('auth.action.signIn')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
