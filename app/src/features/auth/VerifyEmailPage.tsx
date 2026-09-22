import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { InlineError } from '../../components/InlineError';
import { Logo } from '../../components/Logo';

/**
 * Handler link verifikasi email (T6/T7): /verify-email?token=...
 * - Auto-verify saat mount; sukses → arahkan ke login.
 * - Gagal/expired → form kirim ulang via email.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation('account');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [phase, setPhase] = useState<'working' | 'done' | 'error'>('working');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        const result = await api.verifyEmail(token);
        // T9: bawa email ke login (prefill) — panduan jelas, tanpa ketik ulang.
        setPhase('done');
        setTimeout(
          () => navigate(`/?email=${encodeURIComponent(result.email)}`, { replace: true }),
          2500,
        );
      } catch (err) {
        setError(getErrorMessage(err, t('auth.error.generic')));
        setPhase('error');
      }
    })();
  }, [token, navigate, t]);

  async function onResend(e: FormEvent) {
    e.preventDefault();
    if (!email || resending) return;
    setResending(true);
    setError(null);
    try {
      await api.resendVerification(email.trim());
      setResent(true);
    } catch (err) {
      setError(getErrorMessage(err, t('auth.error.generic')));
    } finally {
      setResending(false);
    }
  }

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
          <div>
            <h2 className="auth-form-title">{t('auth.verify.title', 'Verify your email')}</h2>
            <p className="auth-form-sub">
              {phase === 'done'
                ? t(
                    'auth.verify.successNext',
                    'Email verified! One last step — sign in with your password. Redirecting to login...',
                  )
                : phase === 'error'
                  ? t('auth.verify.failedSub', 'This link is invalid or expired. Request a new one below.')
                  : t('auth.verify.working', 'Verifying your email...')}
            </p>
          </div>

          {phase === 'done' && (
            <div role="status" style={{ padding: 10, borderRadius: 8, background: 'var(--status-success-soft)', color: 'var(--status-success)', fontSize: 13 }}>
              {t('auth.verify.success', 'Email verified — redirecting to login...')}
            </div>
          )}
          {phase === 'error' && error && <InlineError>{error}</InlineError>}

          {phase === 'error' && (
            <form onSubmit={onResend} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                label={t('auth.field.email')}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" loading={resending} disabled={resending || !email || resent}>
                {t('auth.verify.resend', 'Resend verification link')}
                {!resending && <ArrowRight size={14} weight="bold" aria-hidden="true" />}
              </Button>
              {resent && (
                <div role="status" style={{ padding: 10, borderRadius: 8, background: 'var(--status-success-soft)', color: 'var(--status-success)', fontSize: 13 }}>
                  {t('auth.verify.resent', 'If that email exists and is unverified, a verification link has been sent.')}
                </div>
              )}
            </form>
          )}

          <Button onClick={() => navigate('/')}>Back to login</Button>
        </div>
      </main>
    </div>
  );
}
